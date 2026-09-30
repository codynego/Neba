import secrets
from datetime import timedelta
from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import Avg
from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, serializers
from rest_framework.exceptions import PermissionDenied, ValidationError, Throttled
from rest_framework.response import Response
from rest_framework.views import APIView
from bookings.models import Application
from tasks.models import Task
from .models import User, PhoneChallenge, PhoneSendAttempt, CaptureChallenge, IdentityVerification, Block, SafetyReport, Review, TrustAudit
from .trust import normalize_phone, destination_hash, twilio_request, phone_configured, encrypt_image, decrypt_image, require_phone, are_blocked
from . import r2


def trust_summary(user):
    reviews = user.reviews_received.filter(visible=True, reviewer__is_active=True)
    return {"public_id": str(user.public_id), "username": user.username, "phone_verified": bool(user.is_active and user.phone and user.phone_verified_at),
            "identity_verified": bool(user.is_active and user.phone and user.phone_verified_at and user.identity_verified_at),
            "photo_available": bool(user.is_active and user.photo_visible and (user.profile_photo_key or user.profile_photo)),
            "profile_complete": bool(user.is_active and user.profile_complete),
            "review_count": reviews.count(), "rating": reviews.aggregate(value=Avg("rating"))["value"]}


class PrivateView(APIView):
    permission_classes = [permissions.IsAuthenticated]


def numeric_id(value):
    return serializers.IntegerField(min_value=1).run_validation(value)


class VerificationStatus(PrivateView):
    def get(self, request):
        latest = request.user.identity_submissions.first()
        return Response({**trust_summary(request.user), "phone": request.user.phone,
            "sms_available": phone_configured(), "uploads_available": bool(settings.VERIFICATION_ENCRYPTION_KEY),
            "retention_days": settings.VERIFICATION_RETENTION_DAYS,
            "submission": {"id": latest.id, "status": latest.status, "review_note": latest.review_note,
                "created_at": latest.created_at} if latest else None})


class SendPhoneCode(PrivateView):
    throttle_scope = "phone_send"
    def post(self, request):
        phone = normalize_phone(request.data.get("phone", ""))
        now = timezone.now()
        # Lock one user row across send/check so concurrent requests cannot bypass limits.
        with transaction.atomic():
            user = User.objects.select_for_update().get(pk=request.user.pk)
            if user.phone_verified_at:
                raise ValidationError("Your phone is already verified. Contact support to change it.")
            recent = PhoneChallenge.objects.filter(user=user).first()
            if recent and recent.sent_at > now - timedelta(seconds=60):
                raise Throttled(wait=60, detail="Wait a minute before requesting another code.")
            attempts = PhoneSendAttempt.objects.filter(created_at__gte=now - timedelta(hours=1))
            hashed = destination_hash(phone)
            if attempts.filter(user=user).count() >= 5 or attempts.filter(destination_hash=hashed).count() >= 5:
                raise Throttled(wait=3600, detail="Too many code requests. Try again later.")
            PhoneSendAttempt.objects.create(user=user, destination_hash=hashed)
            result = twilio_request("Verifications", {"To": phone, "Channel": "sms"})
            if result.get("status") != "pending" or result.get("to") != phone or not str(result.get("sid", "")).startswith("VE"):
                raise ValidationError("The verification service did not start a valid challenge.")
            PhoneChallenge.objects.update_or_create(user=user, defaults={"phone": phone,
                "provider_sid": result["sid"], "sent_at": now, "expires_at": now + timedelta(minutes=10), "checks": 0, "consumed": False})
        return Response({"detail": "Code sent. It expires in 10 minutes."})


class CheckPhoneCode(PrivateView):
    throttle_scope = "phone_check"
    def post(self, request):
        code = str(request.data.get("code", ""))
        if not code.isdigit() or not 4 <= len(code) <= 10:
            raise ValidationError("Enter the code from your SMS.")
        with transaction.atomic():
            user = User.objects.select_for_update().get(pk=request.user.pk)
            challenge = PhoneChallenge.objects.select_for_update().filter(user=user).first()
            if not challenge or challenge.consumed or challenge.expires_at <= timezone.now() or challenge.checks >= 5:
                raise ValidationError("This code expired or reached its attempt limit. Request a new code.")
            challenge.checks += 1
            challenge.save(update_fields=("checks",))
        # Persist the attempt before contacting the provider, including failed/outage attempts.
        result = twilio_request("VerificationCheck", {"VerificationSid": challenge.provider_sid, "Code": code})
        if result.get("status") != "approved" or result.get("to") != challenge.phone or result.get("sid") != challenge.provider_sid:
            raise ValidationError("The code could not be verified. Check it and try again.")
        with transaction.atomic():
            user = User.objects.select_for_update().get(pk=request.user.pk)
            current = PhoneChallenge.objects.select_for_update().get(user=user)
            if current.provider_sid != challenge.provider_sid or current.consumed or current.expires_at <= timezone.now():
                raise ValidationError("This challenge is no longer valid. Request a new code.")
            if User.objects.filter(phone=challenge.phone).exclude(pk=user.pk).exists():
                raise ValidationError("This phone cannot be linked to this account. Contact support.")
            user.phone = challenge.phone
            user.phone_verified_at = timezone.now()
            try:
                with transaction.atomic():
                    user.save(update_fields=("phone", "phone_verified_at"))
            except IntegrityError:
                raise ValidationError("This phone cannot be linked to this account. Contact support.") from None
            current.consumed = True
            current.save(update_fields=("consumed",))
            TrustAudit.objects.create(actor=user, subject=user, action="phone_verified")
        return Response({"detail": "Phone verified."})


class StartCapture(PrivateView):
    throttle_scope = "capture_challenge"
    def post(self, request):
        require_phone(request.user)
        challenge = CaptureChallenge.objects.create(user=request.user,
            instruction=f"Hold up {secrets.choice((2, 3, 4, 5))} fingers beside your face, with your face clearly visible.",
            expires_at=timezone.now() + timedelta(minutes=10))
        return Response({"id": challenge.id, "instruction": challenge.instruction, "expires_at": challenge.expires_at}, status=201)


class IdentityInput(serializers.Serializer):
    full_name = serializers.CharField(max_length=140, min_length=3)
    document_type = serializers.ChoiceField(choices=("national_id", "passport", "drivers_license"))
    challenge_id = serializers.UUIDField()
    document_image = serializers.FileField()
    portrait_image = serializers.FileField()
    challenge_image = serializers.FileField()
    consent = serializers.BooleanField()
    adult_confirmed = serializers.BooleanField()
    publish_photo = serializers.BooleanField(default=False)
    def validate(self, data):
        if not data["consent"] or not data["adult_confirmed"]:
            raise ValidationError("Consent and confirmation that you are at least 18 are required.")
        return data


class SubmitIdentity(PrivateView):
    throttle_scope = "identity_submit"
    def post(self, request):
        require_phone(request.user)
        serializer = IdentityInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        images = {name: encrypt_image(data.pop(name)) for name in ("document_image", "portrait_image", "challenge_image")}
        with transaction.atomic():
            user = User.objects.select_for_update().get(pk=request.user.pk)
            require_phone(user)
            if user.identity_verified_at or user.identity_submissions.filter(status="pending").exists():
                raise ValidationError("You already have an approved or pending identity review.")
            challenge = get_object_or_404(CaptureChallenge.objects.select_for_update(), pk=data.pop("challenge_id"), user=user)
            if challenge.consumed or challenge.expires_at <= timezone.now():
                raise ValidationError("Your camera challenge expired. Start again.")
            data.pop("consent")
            submission = IdentityVerification.objects.create(user=user, capture_instruction=challenge.instruction, **data, **images)
            challenge.consumed = True
            challenge.save(update_fields=("consumed",))
            TrustAudit.objects.create(actor=user, subject=user, action="identity_submitted")
        return Response({"id": submission.pk, "status": "pending", "detail": "Submitted for manual review. You are not yet identity verified."}, status=201)


class WithdrawIdentity(PrivateView):
    def post(self, request):
        with transaction.atomic():
            user = User.objects.select_for_update().get(pk=request.user.pk)
            user.identity_verified_at = None
            if not user.profile_photo_key:
                user.profile_photo = b""
                user.photo_visible = False
            user.save(update_fields=("identity_verified_at", "profile_photo", "photo_visible"))
            user.identity_submissions.update(status="revoked", full_name="", document_image=b"", portrait_image=b"", challenge_image=b"")
            CaptureChallenge.objects.filter(user=user).update(consumed=True)
            TrustAudit.objects.create(actor=user, subject=user, action="identity_consent_withdrawn")
        return Response(status=204)


def private_image_response(value):
    response = HttpResponse(decrypt_image(value), content_type="image/jpeg")
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    return response


class EvidenceImage(PrivateView):
    def get(self, request, pk, kind):
        if not request.user.is_staff or not request.user.has_perm("accounts.review_identityverification"):
            raise PermissionDenied("Private evidence is restricted to authorized reviewers.")
        submission = get_object_or_404(IdentityVerification, pk=pk)
        if kind not in ("document", "portrait", "challenge"):
            raise ValidationError("Unknown evidence type.")
        value = getattr(submission, kind + "_image")
        if not value:
            return Response({"detail": "This evidence has been removed."}, status=404)
        TrustAudit.objects.create(actor=request.user, subject=submission.user, action="evidence_viewed", note=f"submission {pk}: {kind}")
        return private_image_response(value)


def resolve_user_identifier(identifier):
    import uuid
    try:
        return User.objects.get(public_id=uuid.UUID(str(identifier)), is_active=True)
    except (ValueError, TypeError, AttributeError, User.DoesNotExist):
        try:
            return User.objects.get(username__iexact=str(identifier), is_active=True)
        except User.DoesNotExist:
            if str(identifier).isdigit():
                return get_object_or_404(User, pk=identifier, is_active=True)
            raise Http404


class ProfilePhoto(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, identifier):
        user = resolve_user_identifier(identifier)
        if not user.photo_visible:
            return Response(status=404)
        if request.user.is_authenticated and are_blocked(request.user, user):
            return Response(status=404)
        if user.profile_photo_key:
            if not r2.configured():
                return Response({"detail": "Profile photos are temporarily unavailable."}, status=503)
            return Response({"url": r2.download_url(user.profile_photo_key)})
        if not user.profile_photo:
            return Response(status=404)
        return private_image_response(user.profile_photo)


class PublicProfile(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, identifier):
        user = resolve_user_identifier(identifier)
        if request.user.is_authenticated and are_blocked(request.user, user):
            return Response(status=404)
        reviews = user.reviews_received.filter(visible=True, reviewer__is_active=True).select_related("reviewer")[:20]
        from offers.product_api import OfferSerializer
        offers = user.offers.filter(active=True) if user.profile_complete else user.offers.none()
        return Response({"id": user.pk, "public_id": str(user.public_id), "username": user.username, "display_name": user.display_name, "city": user.city, "state": user.state,
            "bio": user.bio, "skills": user.skills, "neighborhood": user.neighborhood, "availability": user.availability,
            "offers": OfferSerializer(offers, many=True).data, **trust_summary(user),
            "completed_tasks": Application.objects.filter(applicant=user, status="accepted", task__status="completed").count(),
            "reviews": [{"rating": review.rating, "comment": review.comment, "created_at": review.created_at,
                "reviewer_username": review.reviewer.username, "reviewer_public_id": str(review.reviewer.public_id),
                "reviewer_photo_available": bool(review.reviewer.photo_visible and (review.reviewer.profile_photo_key or review.reviewer.profile_photo))} for review in reviews]})


class Blocks(PrivateView):
    throttle_scope = "block_user"
    def get(self, request):
        return Response([{"id": block.blocked_id, "display_name": block.blocked.display_name} for block in request.user.blocks_made.select_related("blocked")])
    def post(self, request):
        user = get_object_or_404(User, pk=numeric_id(request.data.get("user")))
        if user == request.user:
            raise ValidationError("You cannot block yourself.")
        Block.objects.get_or_create(blocker=request.user, blocked=user)
        return Response({"detail": "Blocked. New interactions are prevented in both directions."}, status=201)
    def delete(self, request):
        Block.objects.filter(blocker=request.user, blocked_id=numeric_id(request.data.get("user"))).delete()
        return Response(status=204)


class ReportInput(serializers.ModelSerializer):
    class Meta:
        model = SafetyReport
        fields = ("reported_user", "task", "reason", "details")
    def validate(self, data):
        if data["reported_user"] == self.context["request"].user:
            raise ValidationError("You cannot report yourself.")
        task = data.get("task")
        if task and not (task.requester_id == data["reported_user"].pk or task.applications.filter(applicant=data["reported_user"]).exists()):
            raise ValidationError("The reported member is not associated with this task.")
        return data


class Reports(PrivateView):
    throttle_scope = "safety_report"
    def get(self, request):
        return Response(list(request.user.reports_made.values("id", "reported_user_id", "reason", "status", "created_at")[:50]))
    def post(self, request):
        serializer = ReportInput(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        report = serializer.save(reporter=request.user)
        return Response({"id": report.pk, "status": report.status, "detail": "Report sent to the moderation queue."}, status=201)


class Reviews(PrivateView):
    def post(self, request):
        try:
            rating = int(request.data.get("rating"))
        except (TypeError, ValueError):
            raise ValidationError("Choose a rating from 1 to 5.") from None
        comment = str(request.data.get("comment", "")).strip()
        if rating not in range(1, 6) or len(comment) > 800:
            raise ValidationError("Choose a rating from 1 to 5 and keep the comment under 800 characters.")
        with transaction.atomic():
            task = get_object_or_404(Task.objects.select_for_update(), pk=numeric_id(request.data.get("task")), status="completed")
            accepted = task.applications.filter(status="accepted").first()
            if not accepted:
                raise ValidationError("There is no completed booking to review.")
            if request.user.pk == task.requester_id:
                subject = accepted.applicant
            elif request.user.pk == accepted.applicant_id:
                subject = task.requester
            else:
                raise PermissionDenied("Only participants in this completed task can review it.")
            if are_blocked(request.user, subject):
                raise PermissionDenied("Reviews are unavailable between blocked members.")
            if Review.objects.filter(task=task, reviewer=request.user).exists():
                raise ValidationError("You already reviewed this task.")
            review = Review.objects.create(task=task, reviewer=request.user, subject=subject, rating=rating, comment=comment)
        return Response({"id": review.pk, "detail": "Review published."}, status=201)

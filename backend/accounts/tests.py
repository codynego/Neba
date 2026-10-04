import io
from datetime import timedelta
from unittest.mock import patch
from cryptography.fernet import Fernet
from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework.exceptions import PermissionDenied, ValidationError
from .models import User, PhoneChallenge, IdentityVerification, Block, SafetyReport, Review, PushSubscription
from .trust import review_identity
from tasks.models import Task
from bookings.models import Application
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.authtoken.models import Token


def photo():
    output = io.BytesIO()
    Image.new("RGB", (400, 400), "green").save(output, "JPEG")
    return SimpleUploadedFile("test.jpg", output.getvalue(), content_type="image/jpeg")


@override_settings(VERIFICATION_ENCRYPTION_KEY=Fernet.generate_key().decode(), REST_FRAMEWORK={
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework.authentication.TokenAuthentication", "rest_framework.authentication.SessionAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticatedOrReadOnly"],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination", "PAGE_SIZE": 20,
})
class TrustFlowTests(APITestCase):
    def setUp(self):
        cache.clear()  # Throttling state must not leak between independently reset test databases.
        self.member = User.objects.create_user(username="member", display_name="Member", password="test-password-123")
        self.other = User.objects.create_user(username="other", display_name="Other", password="test-password-123", phone="+2348012345670", phone_verified_at=timezone.now(), identity_verified_at=timezone.now(), profile_photo_key="profile-photos/2/test.jpg", photo_visible=True, address="12 Test Street", neighborhood="Garki", city="Abuja", state="FCT")
        self.admin = User.objects.create_superuser(username="reviewer", email="review@example.test", password="test-password-123")
        self.client.force_authenticate(self.member)

    def verify_member_phone(self):
        self.member.phone = "+2348012345671"
        self.member.phone_verified_at = timezone.now()
        self.member.save()

    def task(self, status="open"):
        return Task.objects.create(requester=self.other, title="Help move a table", description="One table to move", category="moving", city="Abuja", state="FCT", reward_amount=5000, status=status)

    def submission(self, challenge_id=None):
        challenge_id = challenge_id or self.client.post("/api/auth/verification/capture/").data["id"]
        return self.client.post("/api/auth/verification/identity/", {"full_name": "Test Member", "document_type": "national_id", "challenge_id": str(challenge_id),
            "consent": "true", "adult_confirmed": "true", "publish_photo": "true", "document_image": photo(), "portrait_image": photo(), "challenge_image": photo()}, format="multipart")

    def test_incomplete_accounts_cannot_work_but_can_add_an_unverified_phone(self):
        task = self.task()
        self.assertEqual(self.client.post("/api/tasks/", {"title": "A task", "description": "A task description", "category": "moving", "city": "Abuja", "state": "FCT", "reward_amount": "5000", "policy_confirmed": True}).status_code, 403)
        self.assertEqual(self.client.post("/api/applications/", {"task": task.pk, "message": "Hello"}).status_code, 403)
        response = self.client.patch("/api/auth/me/", {"identity_verified": True, "phone_verified": True, "phone": "08012345671"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.member.refresh_from_db()
        self.assertIsNone(self.member.identity_verified_at)
        self.assertEqual(self.member.phone, "+2348012345671")
        self.assertIsNone(self.member.phone_verified_at)

    def test_profile_becomes_complete_after_core_opportunity_details(self):
        profile = self.client.patch("/api/auth/me/", {
            "country": "Nigeria", "education_level": "Undergraduate", "opportunity_interests": ["Scholarships", "Internships"],
        }, format="json")
        self.assertEqual(profile.status_code, 200)
        self.assertTrue(profile.data["profile_complete"])
        with patch("accounts.views.r2.configured", return_value=True), patch("accounts.views.r2.upload_url", return_value="https://upload.example.test/signed"):
            ticket = self.client.post("/api/auth/profile-photo/upload/", {"content_type": "image/jpeg", "size": 2048}, format="json")
        self.assertEqual(ticket.status_code, 200)
        key = ticket.data["key"]
        image_bytes = photo().read()
        with patch("accounts.views.r2.object_metadata", return_value={"ContentLength": len(image_bytes), "ContentType": "image/jpeg"}), patch("accounts.views.r2.object_bytes", return_value=image_bytes):
            confirmed = self.client.post("/api/auth/profile-photo/confirm/", {"key": key}, format="json")
        self.assertEqual(confirmed.status_code, 200)
        self.assertTrue(confirmed.data["photo_available"])
        self.assertTrue(confirmed.data["profile_complete"])
        self.assertFalse(confirmed.data["photo_visible"])
        visible = self.client.patch("/api/auth/me/", {"photo_visible": True}, format="json")
        self.assertTrue(visible.data["photo_visible"])

    @patch("accounts.views.send_verification_email")
    def test_registration_requires_and_records_current_legal_acceptance(self, send_verification):
        self.client.force_authenticate(None)
        payload = {"username": "new-member", "email": "new@example.test", "password": "safe-example-password-394"}
        rejected = self.client.post("/api/auth/register/", payload, format="json")
        self.assertEqual(rejected.status_code, 400)
        accepted = self.client.post("/api/auth/register/", {**payload, "terms_accepted": True}, format="json")
        self.assertEqual(accepted.status_code, 201, accepted.data)
        member = User.objects.get(username="new-member")
        self.assertEqual(member.display_name, "new-member")
        self.assertIsNotNone(member.terms_accepted_at)
        self.assertEqual(member.legal_policy_version, "2026-09-30")
        send_verification.assert_called_once_with(member)

    def test_email_verification_and_password_reset_revoke_existing_tokens(self):
        self.member.email = "member@example.test"
        self.member.save(update_fields=("email",))
        uid = urlsafe_base64_encode(force_bytes(self.member.pk))
        verification_token = default_token_generator.make_token(self.member)

        self.client.force_authenticate(None)
        verified = self.client.post("/api/auth/email/verify/", {"uid": uid, "token": verification_token}, format="json")
        self.assertEqual(verified.status_code, 200, verified.data)
        self.member.refresh_from_db()
        self.assertIsNotNone(self.member.email_verified_at)

        auth_token = Token.objects.create(user=self.member)
        reset_token = default_token_generator.make_token(self.member)
        reset = self.client.post("/api/auth/password-reset/confirm/", {
            "uid": uid,
            "token": reset_token,
            "password": "new-safe-password-583",
        }, format="json")
        self.assertEqual(reset.status_code, 200, reset.data)
        self.member.refresh_from_db()
        self.assertTrue(self.member.check_password("new-safe-password-583"))
        self.assertFalse(Token.objects.filter(pk=auth_token.pk).exists())
        self.assertEqual(self.client.post("/api/auth/password-reset/confirm/", {
            "uid": uid, "token": reset_token, "password": "another-safe-password-864",
        }, format="json").status_code, 400)

    @patch("accounts.views.send_password_reset_email")
    def test_password_reset_request_is_enumeration_safe(self, send_reset):
        self.member.email = "member@example.test"
        self.member.save(update_fields=("email",))
        self.client.force_authenticate(None)
        known = self.client.post("/api/auth/password-reset/", {"email": "MEMBER@example.test"}, format="json")
        unknown = self.client.post("/api/auth/password-reset/", {"email": "missing@example.test"}, format="json")
        self.assertEqual(known.status_code, 200)
        self.assertEqual(known.data, unknown.data)
        send_reset.assert_called_once_with(self.member)

    @override_settings(TWILIO_ACCOUNT_SID="", TWILIO_AUTH_TOKEN="", TWILIO_VERIFY_SERVICE_SID="")
    def test_sms_without_provider_fails_closed(self):
        self.assertEqual(self.client.post("/api/auth/verification/phone/send/", {"phone": "08012345671"}).status_code, 503)
        self.member.refresh_from_db()
        self.assertIsNone(self.member.phone_verified_at)

    @patch("accounts.safety_views.twilio_request")
    def test_phone_approval_requires_matching_provider_result_and_is_single_use(self, provider):
        sid = "VE" + "a" * 32
        provider.return_value = {"sid": sid, "to": "+2348012345671", "status": "pending"}
        self.assertEqual(self.client.post("/api/auth/verification/phone/send/", {"phone": "08012345671"}).status_code, 200)
        self.assertEqual(self.client.post("/api/auth/verification/phone/send/", {"phone": "08012345671"}).status_code, 429)
        provider.return_value = {"sid": sid, "to": "+2348012345671", "status": "failed"}
        self.assertEqual(self.client.post("/api/auth/verification/phone/check/", {"code": "000000"}).status_code, 400)
        self.member.refresh_from_db()
        self.assertIsNone(self.member.phone_verified_at)
        provider.return_value = {"sid": sid, "to": "+2348012345671", "status": "approved"}
        self.assertEqual(self.client.post("/api/auth/verification/phone/check/", {"code": "123456"}).status_code, 200)
        self.assertEqual(self.client.post("/api/auth/verification/phone/check/", {"code": "123456"}).status_code, 400)
        self.member.refresh_from_db()
        self.assertEqual(self.member.phone, "+2348012345671")

    @patch("accounts.safety_views.twilio_request")
    def test_phone_attempt_limit_persists_failures(self, provider):
        PhoneChallenge.objects.create(user=self.member, phone="+2348012345671", provider_sid="VEtest", sent_at=timezone.now(), expires_at=timezone.now() + timedelta(minutes=10))
        provider.return_value = {"status": "failed"}
        for _ in range(6):
            self.assertEqual(self.client.post("/api/auth/verification/phone/check/", {"code": "000000"}).status_code, 400)
        self.assertEqual(provider.call_count, 5)
        self.assertEqual(PhoneChallenge.objects.get(user=self.member).checks, 5)

    def test_identity_submission_requires_review_private_permission_and_opt_in_photo(self):
        self.verify_member_phone()
        result = self.submission()
        self.assertEqual(result.status_code, 201, result.data)
        submission = IdentityVerification.objects.get(pk=result.data["id"])
        self.assertFalse(bytes(submission.document_image).startswith(b"\xff\xd8"))
        self.member.refresh_from_db()
        self.assertIsNone(self.member.identity_verified_at)
        self.assertEqual(self.client.get(f"/api/auth/verification/{submission.pk}/evidence/document/").status_code, 403)
        with self.assertRaises(PermissionDenied):
            review_identity(submission, self.member, True)
        with self.assertRaises(ValidationError):
            review_identity(submission, self.admin, True)
        submission.document_checked = submission.face_matched = submission.challenge_matched = submission.adult_checked = True
        submission.save()
        review_identity(submission, self.admin, True)
        self.member.refresh_from_db()
        self.assertIsNotNone(self.member.identity_verified_at)
        self.assertEqual(self.client.get(f"/api/auth/members/{self.member.pk}/photo/").status_code, 200)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f"/api/auth/members/{self.member.pk}/photo/").status_code, 200)
        self.client.force_authenticate(self.admin)
        evidence = self.client.get(f"/api/auth/verification/{submission.pk}/evidence/document/")
        self.assertEqual(evidence.status_code, 200)
        self.assertEqual(evidence["Cache-Control"], "private, no-store")
        self.client.force_authenticate(self.member)
        self.assertEqual(self.client.post("/api/auth/verification/withdraw/").status_code, 204)
        self.member.refresh_from_db(); submission.refresh_from_db()
        self.assertFalse(self.member.profile_photo)
        self.assertFalse(submission.document_image)
        self.assertIsNone(self.member.identity_verified_at)

    def test_challenge_cannot_be_reused_or_used_after_expiry(self):
        from .models import CaptureChallenge
        self.verify_member_phone()
        challenge = self.client.post("/api/auth/verification/capture/").data["id"]
        CaptureChallenge.objects.filter(pk=challenge).update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.submission(challenge).status_code, 400)
        self.assertEqual(self.submission().status_code, 201)
        self.assertEqual(self.submission().status_code, 400)

    def test_block_hides_both_directions_and_prevents_work_and_reports_are_private(self):
        self.verify_member_phone()
        self.member.identity_verified_at = timezone.now(); self.member.save()
        task = self.task()
        self.assertEqual(self.client.post("/api/auth/blocks/", {"user": self.other.pk}).status_code, 201)
        self.assertEqual(self.client.get(f"/api/tasks/{task.pk}/").status_code, 404)
        self.assertEqual(self.client.post("/api/applications/", {"task": task.pk, "message": "Hi"}).status_code, 403)
        report = self.client.post("/api/auth/reports/", {"reported_user": self.other.pk, "task": task.pk, "reason": "unsafe", "details": "Test private report"})
        self.assertEqual(report.status_code, 201)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get("/api/auth/reports/").data, [])
        self.assertEqual(self.client.get(f"/api/auth/members/{self.member.pk}/").status_code, 404)

    def test_reviews_only_completed_participants_once_and_cannot_pick_subject(self):
        task = self.task(status="completed")
        Application.objects.create(task=task, applicant=self.member, message="Test", status="accepted", contact_phone="+2348012345671")
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.post("/api/auth/reviews/", {"task": task.pk, "rating": 5}).status_code, 403)
        self.client.force_authenticate(self.member)
        self.assertEqual(self.client.post("/api/auth/reviews/", {"task": task.pk, "rating": 5, "subject": self.admin.pk}).status_code, 201)
        self.assertEqual(Review.objects.get().subject_id, self.other.pk)
        self.assertEqual(self.client.post("/api/auth/reviews/", {"task": task.pk, "rating": 5}).status_code, 400)
        open_task = self.task()
        self.assertEqual(self.client.post("/api/auth/reviews/", {"task": open_task.pk, "rating": 5}).status_code, 404)

    def test_profile_and_reviewer_identity_are_public_without_private_fields(self):
        task = self.task(status="completed")
        Review.objects.create(task=task, reviewer=self.member, subject=self.other, rating=5, comment="Reliable and helpful.")
        self.client.force_authenticate(None)
        response = self.client.get(f"/api/auth/members/{self.other.username}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["X-Neba-Cache"], "MISS")
        self.assertEqual(self.client.get(f"/api/auth/members/{self.other.username}/")["X-Neba-Cache"], "HIT")
        self.assertEqual(response.data["username"], self.other.username)
        self.assertNotIn("phone", response.data)
        self.assertNotIn("address", response.data)
        self.assertEqual(response.data["reviews"][0]["reviewer_username"], self.member.username)
        self.assertEqual(response.data["reviews"][0]["reviewer_public_id"], str(self.member.public_id))
        self.assertFalse(response.data["reviews"][0]["reviewer_photo_available"])
        self.other.bio = "Updated public profile"
        self.other.save(update_fields=("bio",))
        refreshed = self.client.get(f"/api/auth/members/{self.other.username}/")
        self.assertEqual(refreshed["X-Neba-Cache"], "MISS")
        self.assertEqual(refreshed.data["bio"], "Updated public profile")
        self.assertEqual(self.client.get("/api/auth/members/not-a-real-member/").status_code, 404)

    def test_contact_hidden_until_acceptance_and_suspended_helpers_cannot_be_accepted(self):
        self.verify_member_phone()
        task = self.task()
        application = Application.objects.create(task=task, applicant=self.member, message="Test", contact_phone=self.member.phone)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get("/api/applications/?received=true").data["results"][0]["contact_phone"], "")
        self.assertEqual(self.client.post(f"/api/applications/{application.pk}/shortlist/").status_code, 200)
        self.member.is_active = False; self.member.save()
        self.assertEqual(self.client.post(f"/api/applications/{application.pk}/offer/", {"booking_note": "Confirmed task details for testing."}, format="json").status_code, 403)

    def test_push_subscriptions_are_private_to_the_signed_in_member(self):
        payload = {
            "endpoint": "https://push.example.test/subscriptions/member-device",
            "keys": {"p256dh": "test-public-key", "auth": "test-auth-key"},
        }
        self.assertEqual(self.client.post("/api/notifications/push-subscription/", payload, format="json").status_code, 204)
        subscription = PushSubscription.objects.get()
        self.assertEqual(subscription.user, self.member)

        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.delete("/api/notifications/push-subscription/", {"endpoint": payload["endpoint"]}, format="json").status_code, 204)
        self.assertTrue(PushSubscription.objects.filter(pk=subscription.pk).exists())

        self.client.force_authenticate(self.member)
        self.assertEqual(self.client.delete("/api/notifications/push-subscription/", {"endpoint": payload["endpoint"]}, format="json").status_code, 204)
        self.assertFalse(PushSubscription.objects.exists())

    def test_unread_notification_counts_split_messages_from_activity(self):
        from .models import Notification
        Notification.objects.create(recipient=self.member, title="New task message", path="/messages/example#message-1")
        Notification.objects.create(recipient=self.member, title="Booking confirmed", path="/tasks/example")
        response = self.client.get("/api/notifications/unread/")
        self.assertEqual(response.data, {"count": 2, "message_count": 1, "activity_count": 1})

    def test_evidence_retention_expires_pending_without_granting_approval(self):
        self.verify_member_phone()
        result = self.submission()
        IdentityVerification.objects.filter(pk=result.data["id"]).update(created_at=timezone.now() - timedelta(days=31))
        call_command("purge_verification_evidence", stdout=io.StringIO())
        submission = IdentityVerification.objects.get()
        self.assertEqual(submission.status, "expired")
        self.assertFalse(submission.document_image)
        self.assertEqual(submission.full_name, "")
        self.member.refresh_from_db()
        self.assertIsNone(self.member.identity_verified_at)

    def test_invalid_image_and_missing_consent_cannot_enter_review_queue(self):
        self.verify_member_phone()
        challenge = self.client.post("/api/auth/verification/capture/").data["id"]
        data = {"full_name": "Test Member", "document_type": "national_id", "challenge_id": str(challenge), "consent": "true", "adult_confirmed": "true",
            "document_image": SimpleUploadedFile("fake.jpg", b"not an image"), "portrait_image": photo(), "challenge_image": photo()}
        self.assertEqual(self.client.post("/api/auth/verification/identity/", data, format="multipart").status_code, 400)
        self.assertFalse(IdentityVerification.objects.exists())
        self.assertEqual(self.client.post("/api/auth/blocks/", {"user": "bad-id"}).status_code, 400)

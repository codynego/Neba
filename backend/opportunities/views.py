from collections import Counter
from datetime import timedelta
import ipaddress
import re
import socket
from html.parser import HTMLParser
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from django.db import transaction
from django.db.models import Count, F, Prefetch, Q
from django.utils import timezone
from rest_framework import mixins, permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from accounts.models import User
from accounts.notifications import notify
from .matching import build_match_context, diverse_recommendations, match_for, rank_opportunities
from .checks import CheckError, normalized_input_hash, run_opportunity_check
from .models import Opportunity, OpportunityApplication, OpportunityCheck, OpportunityCorrection, OpportunityMessage, OpportunityThanks, SavedOpportunity


class OpportunityPageParser(HTMLParser):
    """Read public metadata without depending on a third-party scraping package."""

    def __init__(self):
        super().__init__()
        self.meta = {}
        self.title = ""
        self._in_title = False
        self._title_parts = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "meta":
            key = attrs.get("property") or attrs.get("name")
            value = attrs.get("content")
            if key and value:
                self.meta[key.lower()] = value.strip()
        elif tag == "title":
            self._in_title = True

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
            self.title = " ".join(self._title_parts).strip()

    def handle_data(self, data):
        if self._in_title:
            self._title_parts.append(data.strip())


def _safe_fetch_url(url):
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise serializers.ValidationError({"url": "Enter a complete public http(s) link."})
    hostname = parsed.hostname
    try:
        addresses = socket.getaddrinfo(hostname, None)
        for address in addresses:
            ip = ipaddress.ip_address(address[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                raise serializers.ValidationError({"url": "That link points to a private address."})
    except socket.gaierror:
        raise serializers.ValidationError({"url": "We could not find that website."})
    request = Request(url, headers={"User-Agent": "GetNebaOpportunityImporter/1.0"})
    try:
        with urlopen(request, timeout=8) as response:
            content_type = response.headers.get("Content-Type", "")
            if "text/html" not in content_type:
                raise serializers.ValidationError({"url": "That link does not contain a readable web page."})
            return response.read(1_500_000).decode(response.headers.get_content_charset() or "utf-8", errors="replace")
    except serializers.ValidationError:
        raise
    except Exception:
        raise serializers.ValidationError({"url": "We could not read that page. Check the link and try again."})


def _infer_category(text):
    choices = ("scholarship", "grant", "internship", "fellowship", "competition", "training", "startup", "funding", "tender", "job")
    lowered = text.lower()
    for choice in choices:
        if choice in lowered:
            return choice
    return "job"


def _extract_opportunity_from_url(url):
    parser = OpportunityPageParser()
    parser.feed(_safe_fetch_url(url))
    meta = parser.meta
    title = meta.get("og:title") or meta.get("twitter:title") or parser.title
    summary = meta.get("og:description") or meta.get("description") or meta.get("twitter:description") or ""
    provider = meta.get("author") or meta.get("og:site_name") or urlparse(url).netloc.removeprefix("www.")
    page_text = " ".join((title, summary, provider))
    deadline = None
    deadline_match = re.search(r"(?:deadline|closes?|closing date)\D{0,30}(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})", page_text, re.I)
    if deadline_match:
        raw = deadline_match.group(1).replace("/", "-")
        parts = raw.split("-")
        if len(parts[0]) == 4:
            deadline = f"{parts[0]}-{int(parts[1]):02d}-{int(parts[2]):02d}T23:59"
        else:
            year = int(parts[2]) + (2000 if int(parts[2]) < 100 else 0)
            deadline = f"{year:04d}-{int(parts[1]):02d}-{int(parts[0]):02d}T23:59"
    if not title:
        raise serializers.ValidationError({"url": "We could not find an opportunity title on that page."})
    return {"title": title[:220], "summary": summary[:1800], "provider": provider[:180], "category": _infer_category(page_text), "application_mode": "external", "application_url": url, "source_url": url, "deadline": deadline, "location_label": "", "is_remote": False, "requires_physical_presence": False, "requires_local_residency": False, "benefit": "", "eligibility_notes": "", "eligible_countries": [], "education_levels": [], "fields_of_study": [], "employment_statuses": [], "min_age": None, "max_age": None, "requires_business": False}


class OpportunitySerializer(serializers.ModelSerializer):
    match = serializers.SerializerMethodField()
    saved_status = serializers.SerializerMethodField()
    application_status = serializers.SerializerMethodField()
    application_count = serializers.SerializerMethodField()
    verification = serializers.SerializerMethodField()
    contributor = serializers.SerializerMethodField()
    thanks_count = serializers.SerializerMethodField()
    thanked_by_me = serializers.SerializerMethodField()

    class Meta:
        model = Opportunity
        fields = ("public_id", "title", "provider", "summary", "category", "application_mode", "application_channel", "application_url", "application_email", "application_phone", "deadline", "country", "location_label", "is_remote", "requires_physical_presence", "requires_local_residency", "benefit", "eligibility_notes", "eligible_countries", "education_levels", "fields_of_study", "employment_statuses", "min_age", "max_age", "requires_business", "tracker_only", "source_url", "share_note", "view_count", "application_count", "created_at", "updated_at", "match", "saved_status", "application_status", "verification", "contributor", "thanks_count", "thanked_by_me")

    def get_verification(self, opportunity):
        if opportunity.created_by_id and opportunity.created_by and opportunity.created_by.is_staff and not opportunity.organization_id:
            return {"kind": "neba", "label": "Neba Verified"}
        if opportunity.organization_id and opportunity.organization and opportunity.organization.status == "verified":
            return {"kind": "organization", "label": "Verified organization"}
        return None

    def get_contributor(self, opportunity):
        if opportunity.tracker_only:
            return None
        contributor = opportunity.created_by
        if not contributor or contributor.is_staff or opportunity.organization_id:
            return None
        return {
            "name": contributor.display_name or contributor.username,
            "public_id": str(contributor.public_id),
            "identity_checked": bool(contributor.identity_verified_at),
        }

    def get_thanks_count(self, opportunity):
        value = getattr(opportunity, "thanks_count_value", None)
        return value if value is not None else opportunity.thanks.count()

    def get_thanked_by_me(self, opportunity):
        user = self.context["request"].user
        return bool(user.is_authenticated and opportunity.thanks.filter(user=user).exists())

    def get_match(self, opportunity):
        user = self.context["request"].user
        if not user.is_authenticated:
            return None
        context = self.context.get("match_context")
        if context is None:
            context = getattr(self.context["request"], "_opportunity_match_context", None)
        if context is None:
            context = build_match_context(user)
            self.context["request"]._opportunity_match_context = context
        return match_for(user, opportunity, context)

    def get_saved_status(self, opportunity):
        if not self.context["request"].user.is_authenticated:
            return None
        user = self.context["request"].user
        if not user.is_authenticated: return None
        item = next((save for save in getattr(opportunity, "user_saves", []) if save.user_id == user.pk), None)
        return item.status if item else None

    def get_application_status(self, opportunity):
        if not self.context["request"].user.is_authenticated:
            return None
        user = self.context["request"].user
        if not user.is_authenticated: return None
        item = next((application for application in getattr(opportunity, "user_applications", []) if application.user_id == user.pk), None)
        return item.status if item else None

    def get_application_count(self, opportunity):
        return opportunity.applications.filter(status__in=("applied", "shortlisted", "interview", "awarded", "unsuccessful", "withdrawn")).count()


class SavedOpportunitySerializer(serializers.ModelSerializer):
    opportunity = OpportunitySerializer(read_only=True)
    opportunity_id = serializers.UUIDField(source="opportunity.public_id", read_only=True)
    class Meta:
        model = SavedOpportunity
        fields = ("id", "opportunity_id", "opportunity", "status", "note", "saved_at", "updated_at")


def shared_profile_snapshot(user, shared_fields):
    shared = set(shared_fields or [])
    profile = {}
    if "profile" in shared:
        profile["profile"] = {"name": user.display_name or user.username, "country": user.country, "city": user.city, "bio": user.bio}
    if "skills" in shared:
        profile["skills"] = user.skills or []
        profile["experience"] = user.years_experience
    if "education" in shared:
        profile["education"] = {"level": user.education_level, "institution": user.institution, "field": user.field_of_study, "graduation_year": user.graduation_year}
    if "business" in shared:
        profile["business"] = {"name": user.business_name, "stage": user.business_status, "industry": user.business_industry or user.industry, "description": user.business_description, "website": user.business_website}
    if "documents" in shared:
        profile["documents"] = [{"name": document.name, "type": document.get_document_type_display(), "created_at": document.created_at.isoformat()} for document in user.profile_documents.all()]
    return profile


class OpportunityApplicationSerializer(serializers.ModelSerializer):
    opportunity = OpportunitySerializer(read_only=True)
    opportunity_id = serializers.UUIDField(source="opportunity.public_id", read_only=True)
    applicant_name = serializers.SerializerMethodField()
    is_poster = serializers.SerializerMethodField()
    messages = serializers.SerializerMethodField()
    shared_profile = serializers.SerializerMethodField()
    unread_message_count = serializers.SerializerMethodField()
    unread_activity_count = serializers.SerializerMethodField()
    def get_applicant_name(self, application): return application.user.display_name or application.user.username
    def get_is_poster(self, application): return application.opportunity.organization_id == getattr(getattr(self.context["request"].user, "organization", None), "id", None)
    def get_messages(self, application): return [{"id": message.id, "sender": message.sender_id, "sender_name": message.sender.display_name or message.sender.username, "text": message.text, "created_at": message.created_at, "is_mine": message.sender_id == self.context["request"].user.id} for message in application.messages.select_related("sender").all()]
    def get_unread_message_count(self, application): return application.messages.filter(read_at__isnull=True).exclude(sender=self.context["request"].user).count()
    def get_unread_activity_count(self, application):
        unread_messages = self.get_unread_message_count(application)
        is_poster = self.get_is_poster(application)
        seen_at = application.poster_updates_seen_at if is_poster else application.applicant_updates_seen_at
        unread_status = bool(application.status_updated_at and (not seen_at or application.status_updated_at > seen_at)) if is_poster is False else False
        return unread_messages + (1 if unread_status else 0)
    def get_shared_profile(self, application):
        if application.shared_profile_snapshot:
            return application.shared_profile_snapshot
        return shared_profile_snapshot(application.user, application.shared_fields)
    def to_representation(self, instance):
        data = super().to_representation(instance)
        if self.get_is_poster(instance):
            data["notes"] = ""
        return data
    class Meta:
        model = OpportunityApplication
        fields = ("id", "public_id", "opportunity_id", "opportunity", "status", "applied_at", "next_action", "next_action_at", "notes", "application_message", "additional_information", "shared_fields", "shared_profile", "applicant_name", "is_poster", "messages", "unread_message_count", "unread_activity_count", "created_at", "updated_at")


class OpportunityCheckSerializer(serializers.ModelSerializer):
    class Meta:
        model = OpportunityCheck
        fields = ("public_id", "input_type", "submitted_url", "submitted_text", "status", "verdict", "evidence_confidence", "risk_level", "title", "organization", "opportunity_type", "report_summary", "recommended_action", "deterministic_checks", "claims", "sources", "warnings", "extracted_data", "failure_reason", "checked_at", "created_at")
        read_only_fields = fields


class OpportunityCheckViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = OpportunityCheckSerializer
    permission_classes = (permissions.IsAuthenticated,)
    lookup_field = "public_id"
    throttle_scope = None

    def get_throttles(self):
        self.throttle_scope = "opportunity_check" if self.action == "create" else None
        return super().get_throttles()

    def get_queryset(self):
        return OpportunityCheck.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        from billing.entitlements import opportunity_check_usage
        usage = opportunity_check_usage(request.user)
        if usage["remaining"] <= 0:
            return Response({"detail": f"You have used all {usage['limit']} opportunity checks for this month.", "usage": usage}, status=status.HTTP_402_PAYMENT_REQUIRED)
        submitted_url = str(request.data.get("url", "")).strip()
        submitted_text = str(request.data.get("text", "")).strip()
        if bool(submitted_url) == bool(submitted_text):
            raise serializers.ValidationError({"detail": "Submit either one opportunity link or pasted text."})
        if submitted_text and len(submitted_text) < 40:
            raise serializers.ValidationError({"text": "Paste at least 40 characters so Neba has enough evidence to inspect."})
        if len(submitted_text) > 12000:
            raise serializers.ValidationError({"text": "Pasted text must be 12,000 characters or fewer."})
        if submitted_url:
            submitted_url = serializers.URLField(max_length=1000).run_validation(submitted_url)
        input_type = OpportunityCheck.InputType.URL if submitted_url else OpportunityCheck.InputType.TEXT
        value = submitted_url or submitted_text
        digest = normalized_input_hash(input_type, value)
        cached = self.get_queryset().filter(input_hash=digest, status=OpportunityCheck.Status.COMPLETED, checked_at__gte=timezone.now() - timedelta(hours=24)).first()
        if cached:
            return Response(self.get_serializer(cached).data)
        check = OpportunityCheck.objects.create(user=request.user, input_type=input_type, submitted_url=submitted_url, submitted_text=submitted_text, input_hash=digest)
        try:
            result = run_opportunity_check(input_type, value)
        except CheckError as exc:
            check.status = OpportunityCheck.Status.FAILED
            check.failure_reason = str(exc)[:500]
            check.save(update_fields=("status", "failure_reason", "updated_at"))
            return Response({"detail": check.failure_reason, "check": self.get_serializer(check).data}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        for field, field_value in result.items():
            setattr(check, field, field_value)
        check.status = OpportunityCheck.Status.COMPLETED
        check.checked_at = timezone.now()
        check.save()
        return Response(self.get_serializer(check).data, status=status.HTTP_201_CREATED)


class OpportunityViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = OpportunitySerializer
    lookup_field = "public_id"

    def get_permissions(self):
        return [permissions.AllowAny()] if self.action in ("list", "retrieve") else [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        queryset = Opportunity.objects.filter(review_status=Opportunity.ReviewStatus.APPROVED, is_published=True).select_related("created_by", "organization").annotate(thanks_count_value=Count("thanks", distinct=True))
        if self.action in ("list", "matches", "dashboard"):
            queryset = queryset.filter(Q(deadline__isnull=True) | Q(deadline__gte=timezone.now()))
        if user.is_authenticated:
            queryset = queryset.prefetch_related(
                Prefetch("saves", queryset=SavedOpportunity.objects.filter(user=user), to_attr="user_saves"),
                Prefetch("applications", queryset=OpportunityApplication.objects.filter(user=user), to_attr="user_applications"),
            )
        query = self.request.query_params.get("search", "").strip()
        category = self.request.query_params.get("category", "").strip()
        if query: queryset = queryset.filter(Q(title__icontains=query) | Q(provider__icontains=query) | Q(summary__icontains=query))
        if category: queryset = queryset.filter(category=category)
        return queryset

    def retrieve(self, request, *args, **kwargs):
        opportunity = self.get_object()
        Opportunity.objects.filter(pk=opportunity.pk).update(view_count=F("view_count") + 1)
        opportunity.refresh_from_db(fields=("view_count",))
        return Response(self.get_serializer(opportunity).data)

    @action(detail=False, methods=["get"])
    def matches(self, request):
        context = build_match_context(request.user)
        request._opportunity_match_context = context
        ranked = rank_opportunities(request.user, self.get_queryset(), context)
        opportunities = [item[1] for item in ranked]
        page = self.paginate_queryset(opportunities)
        return self.get_paginated_response(self.get_serializer(page, many=True).data) if page is not None else Response(self.get_serializer(opportunities, many=True).data)

    @action(detail=False, methods=["get"])
    def dashboard(self, request):
        now = timezone.now()
        opportunities = list(self.get_queryset())
        context = build_match_context(request.user)
        request._opportunity_match_context = context
        ranked = rank_opportunities(request.user, opportunities, context, now)
        top_ranked = diverse_recommendations(ranked, 5)
        urgent = sorted((item for _, item, _ in ranked if item.deadline and item.deadline >= now), key=lambda item: item.deadline)[:3]
        saved = SavedOpportunity.objects.filter(user=request.user).select_related("opportunity")[:4]
        all_applications = OpportunityApplication.objects.filter(user=request.user).select_related("opportunity")
        applications = all_applications[:5]
        profile_fields = ("display_name", "country", "education_level", "field_of_study", "employment_status", "skills", "opportunity_interests", "goals")
        complete = sum(bool(getattr(request.user, field)) for field in profile_fields)
        readiness = {"profile": bool(request.user.display_name and request.user.skills and request.user.opportunity_interests), "eligibility": bool(request.user.country and request.user.education_level and request.user.field_of_study), "statement": any(application.notes.strip() for application in applications), "interview": any(application.status in ("interview", "awarded") for application in applications)}
        application_summary = {status: all_applications.filter(status=status).count() for status, _ in OpportunityApplication.Status.choices}
        upcoming_deadlines = sum(1 for _, item, _ in ranked if item.deadline and item.deadline >= now)
        new_this_week = sum(1 for _, item, _ in ranked if item.created_at >= now - timedelta(days=7))
        return Response({"match_count": len(ranked), "new_this_week": new_this_week, "upcoming_deadlines": upcoming_deadlines, "application_summary": application_summary, "top_matches": self.get_serializer([item for _, item, _ in top_ranked], many=True).data, "urgent": self.get_serializer(urgent, many=True).data, "saved": SavedOpportunitySerializer(saved, many=True, context={"request": request}).data, "applications": OpportunityApplicationSerializer(applications, many=True, context={"request": request}).data, "profile_completion": round(complete / len(profile_fields) * 100), "missing_profile_fields": [field for field in profile_fields if not getattr(request.user, field)], "readiness": readiness})

    @action(detail=True, methods=["post", "delete"])
    def save(self, request, public_id=None):
        opportunity = self.get_object()
        if request.method == "DELETE":
            SavedOpportunity.objects.filter(user=request.user, opportunity=opportunity).delete()
            return Response(status=204)
        serializer = serializers.Serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        saved, _ = SavedOpportunity.objects.get_or_create(user=request.user, opportunity=opportunity)
        status = request.data.get("status")
        if status in dict(SavedOpportunity.Status.choices): saved.status = status; saved.save(update_fields=("status", "updated_at"))
        return Response(SavedOpportunitySerializer(saved, context={"request": request}).data, status=201)

    @action(detail=True, methods=["post", "delete"])
    def thank(self, request, public_id=None):
        opportunity = self.get_object()
        if request.method == "DELETE":
            OpportunityThanks.objects.filter(user=request.user, opportunity=opportunity).delete()
        else:
            OpportunityThanks.objects.get_or_create(user=request.user, opportunity=opportunity)
        return Response({
            "thanked": request.method == "POST",
            "thanks_count": opportunity.thanks.count(),
        }, status=201 if request.method == "POST" else 200)

    @action(detail=True, methods=["post"])
    def correction(self, request, public_id=None):
        opportunity = self.get_object()
        payload = serializers.Serializer(data=request.data)
        payload.fields["reason"] = serializers.ChoiceField(choices=OpportunityCorrection.Reason.choices)
        payload.fields["details"] = serializers.CharField(max_length=1000, allow_blank=True, required=False)
        payload.is_valid(raise_exception=True)
        report = OpportunityCorrection.objects.create(
            opportunity=opportunity,
            reporter=request.user,
            reason=payload.validated_data["reason"],
            details=payload.validated_data.get("details", ""),
        )
        return Response({"id": report.id, "status": report.status}, status=201)


class SavedOpportunityViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SavedOpportunitySerializer
    http_method_names = ["get", "patch", "delete", "head", "options"]
    def get_queryset(self): return SavedOpportunity.objects.filter(user=self.request.user).select_related("opportunity")


class OpportunityApplicationViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OpportunityApplicationSerializer
    lookup_field = "public_id"
    def get_queryset(self): return OpportunityApplication.objects.filter(Q(user=self.request.user) | Q(opportunity__organization__owner=self.request.user)).select_related("opportunity", "user").prefetch_related("messages__sender").distinct()
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        opportunity_id = request.data.get("opportunity_id")
        opportunity = Opportunity.objects.filter(public_id=opportunity_id, review_status=Opportunity.ReviewStatus.APPROVED, is_published=True).first() if opportunity_id else None
        if opportunity_id and not opportunity:
            raise serializers.ValidationError({"opportunity_id": "Choose a valid opportunity."})
        status = request.data.get("status", "preparing")
        if status not in dict(OpportunityApplication.Status.choices):
            raise serializers.ValidationError({"status": "Choose a valid application status."})
        submitted = status in ("applied", "shortlisted", "interview", "awarded")
        now = timezone.now()
        next_action_at = serializers.DateTimeField(allow_null=True).run_validation(request.data.get("next_action_at") or None)
        if not opportunity:
            payload = serializers.Serializer(data=request.data)
            payload.fields["title"] = serializers.CharField(max_length=220)
            payload.fields["provider"] = serializers.CharField(max_length=180)
            payload.fields["application_url"] = serializers.URLField(max_length=500, required=False, allow_blank=True)
            payload.fields["category"] = serializers.ChoiceField(choices=Opportunity.Category.choices, default=Opportunity.Category.JOB)
            payload.fields["deadline"] = serializers.DateTimeField(required=False, allow_null=True)
            payload.fields["location_label"] = serializers.CharField(max_length=140, required=False, allow_blank=True)
            payload.fields["next_action"] = serializers.CharField(max_length=240, required=False, allow_blank=True)
            payload.fields["next_action_at"] = serializers.DateTimeField(required=False, allow_null=True)
            payload.fields["notes"] = serializers.CharField(max_length=2000, required=False, allow_blank=True)
            payload.is_valid(raise_exception=True)
            external = payload.validated_data
            opportunity = Opportunity.objects.create(
                title=external["title"],
                provider=external["provider"],
                summary="Private opportunity added directly to the application tracker.",
                category=external["category"],
                application_mode=Opportunity.ApplicationMode.EXTERNAL,
                application_url=external.get("application_url", ""),
                source_url=external.get("application_url", ""),
                deadline=external.get("deadline"),
                location_label=external.get("location_label", ""),
                tracker_only=True,
                is_published=False,
                review_status=Opportunity.ReviewStatus.DRAFT,
                created_by=request.user,
            )
        internal = opportunity.application_mode == Opportunity.ApplicationMode.INTERNAL
        if internal and not opportunity.organization_id:
            raise serializers.ValidationError("This listing is not connected to an authorised application recipient.")
        shared_fields = request.data.get("shared_fields", []) if internal else []
        item, created = OpportunityApplication.objects.get_or_create(user=request.user, opportunity=opportunity, defaults={"status": status, "applied_at": now if submitted else None, "next_action": str(request.data.get("next_action", ""))[:240], "next_action_at": next_action_at, "notes": str(request.data.get("notes", ""))[:2000], "application_message": str(request.data.get("application_message", ""))[:2000] if internal else "", "additional_information": str(request.data.get("additional_information", ""))[:3000] if internal else "", "shared_fields": shared_fields, "shared_profile_snapshot": shared_profile_snapshot(request.user, shared_fields) if internal else {}, "status_updated_at": now, "applicant_updates_seen_at": now})
        if not created: raise serializers.ValidationError("This opportunity is already in your application tracker.")
        if not opportunity.tracker_only:
            SavedOpportunity.objects.update_or_create(user=request.user, opportunity=opportunity, defaults={"status": "applied" if submitted else "preparing"})
        return Response(self.get_serializer(item).data, status=201)

    def destroy(self, request, *args, **kwargs):
        application = self.get_object()
        if application.user_id != request.user.id:
            raise permissions.PermissionDenied("Only the applicant can remove this tracker entry.")
        if application.opportunity.tracker_only:
            application.opportunity.delete()
            return Response(status=204)
        return super().destroy(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        application = self.get_object()
        is_poster = application.opportunity.organization_id == getattr(getattr(request.user, "organization", None), "id", None)
        if is_poster:
            if set(request.data) - {"status"}: raise permissions.PermissionDenied("Posters can update application status only.")
        elif request.data.get("status") in ("applied", "shortlisted", "interview", "awarded"):
            request.data["applied_at"] = request.data.get("applied_at") or timezone.now().isoformat()
        updated = super().update(request, *args, **kwargs)
        if is_poster and "status" in request.data:
            OpportunityApplication.objects.filter(pk=application.pk).update(status_updated_at=timezone.now())
            notify(application.user, f"Application update: {application.opportunity.title}", f"/applications/{application.public_id}", f"Your application is now {updated.data.get('status', application.status)}.")
        return updated

    @action(detail=False, methods=["get"])
    def unread(self, request):
        applications = self.get_queryset().filter(user=request.user)
        total = 0
        for application in applications:
            total += self.get_serializer(application).data["unread_activity_count"]
        return Response({"count": total})

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, public_id=None):
        application = self.get_object()
        now = timezone.now()
        if self.get_serializer(application).data["is_poster"]:
            application.poster_updates_seen_at = now
            application.save(update_fields=("poster_updates_seen_at", "updated_at"))
        else:
            application.applicant_updates_seen_at = now
            application.save(update_fields=("applicant_updates_seen_at", "updated_at"))
        return Response({"ok": True})

    @action(detail=True, methods=["get", "post"])
    def messages(self, request, public_id=None):
        application = self.get_object()
        if application.opportunity.application_mode != Opportunity.ApplicationMode.INTERNAL:
            raise permissions.PermissionDenied("Messages are available only for applications submitted inside Getneba.")
        if request.method == "GET":
            application.messages.filter(read_at__isnull=True).exclude(sender=request.user).update(read_at=timezone.now())
            return Response(self.get_serializer(application).data["messages"])
        if application.status in (OpportunityApplication.Status.UNSUCCESSFUL, OpportunityApplication.Status.WITHDRAWN) and application.user_id == request.user.id:
            raise permissions.PermissionDenied("Messaging is closed for this application.")
        text = serializers.CharField(max_length=2000).run_validation(request.data.get("text"))
        message = OpportunityMessage.objects.create(application=application, sender=request.user, text=text)
        recipient = application.user if request.user.id != application.user_id else getattr(getattr(application.opportunity, "organization", None), "owner", None)
        if recipient and recipient.id != request.user.id:
            notify(recipient, f"New message about {application.opportunity.title}", f"/opportunity-applications/{application.public_id}/messages", "You have a new message about an application.")
        return Response({"id": message.id, "sender": message.sender_id, "sender_name": message.sender.display_name or request.user.username, "text": message.text, "created_at": message.created_at, "is_mine": True}, status=201)


class OrganizationOpportunitySerializer(serializers.ModelSerializer):
    def validate(self, attrs):
        mode = attrs.get("application_mode", getattr(self.instance, "application_mode", Opportunity.ApplicationMode.EXTERNAL))
        channel = attrs.get("application_channel", getattr(self.instance, "application_channel", Opportunity.ApplicationChannel.WEBSITE))
        url = attrs.get("application_url", getattr(self.instance, "application_url", ""))
        email = attrs.get("application_email", getattr(self.instance, "application_email", ""))
        phone = attrs.get("application_phone", getattr(self.instance, "application_phone", ""))
        if mode == Opportunity.ApplicationMode.EXTERNAL:
            if channel == Opportunity.ApplicationChannel.WEBSITE and not url:
                raise serializers.ValidationError({"application_url": "Add the official application website."})
            if channel == Opportunity.ApplicationChannel.EMAIL and not email:
                raise serializers.ValidationError({"application_email": "Add the application email address."})
            if channel == Opportunity.ApplicationChannel.PHONE:
                phone = str(phone).strip()
                if not re.fullmatch(r"\+?[0-9()\-\s]{7,32}", phone):
                    raise serializers.ValidationError({"application_phone": "Enter a valid application phone number."})
                attrs["application_phone"] = phone
            if channel == Opportunity.ApplicationChannel.WEBSITE:
                attrs["application_email"] = ""
                attrs["application_phone"] = ""
            elif channel == Opportunity.ApplicationChannel.EMAIL:
                attrs["application_url"] = ""
                attrs["application_phone"] = ""
            else:
                attrs["application_url"] = ""
                attrs["application_email"] = ""
        else:
            attrs["application_channel"] = Opportunity.ApplicationChannel.WEBSITE
            attrs["application_url"] = ""
            attrs["application_email"] = ""
            attrs["application_phone"] = ""
        is_remote = attrs.get("is_remote", getattr(self.instance, "is_remote", False))
        requires_local_residency = attrs.get(
            "requires_local_residency", getattr(self.instance, "requires_local_residency", False)
        )
        if requires_local_residency:
            attrs["requires_physical_presence"] = True
        if is_remote:
            attrs["requires_physical_presence"] = False
            attrs["requires_local_residency"] = False
        return attrs

    class Meta:
        model = Opportunity
        fields = ("public_id", "title", "provider", "summary", "category", "application_mode", "application_channel", "application_url", "application_email", "application_phone", "deadline", "country", "location_label", "is_remote", "requires_physical_presence", "requires_local_residency", "benefit", "eligibility_notes", "eligible_countries", "education_levels", "fields_of_study", "employment_statuses", "min_age", "max_age", "requires_business", "source_url", "share_note", "review_status", "review_note", "is_published", "view_count", "created_at", "updated_at")
        read_only_fields = ("public_id", "provider", "review_status", "review_note", "is_published", "created_at", "updated_at")


class OrganizationOpportunityViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OrganizationOpportunitySerializer
    lookup_field = "public_id"
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        return Opportunity.objects.filter(organization__owner=self.request.user).order_by("-updated_at")

    def _organization(self):
        organization = getattr(self.request.user, "organization", None)
        if not organization:
            raise serializers.ValidationError("Organization setup is required.")
        return organization

    def _applicant_rows(self, opportunity):
        applications = OpportunityApplication.objects.filter(opportunity=opportunity, status__in=("applied", "shortlisted", "interview", "awarded", "unsuccessful", "withdrawn")).select_related("user")
        rows = []
        for application in applications:
            match = match_for(application.user, opportunity)
            rows.append({"id": application.id, "application_id": str(application.public_id), "applicant_id": application.user.id, "name": application.user.display_name or application.user.username, "country": application.user.country, "status": application.status, "match_score": match["score"], "match_reasons": match["reasons"], "missing": match["missing"], "application_message": application.application_message, "additional_information": application.additional_information, "shared_fields": application.shared_fields, "created_at": application.created_at})
        return sorted(rows, key=lambda row: (-row["match_score"], row["created_at"]))

    def _audience(self, opportunity):
        eligible = [user for user in User.objects.filter(is_active=True) if match_for(user, opportunity)["score"] >= 55]
        countries = Counter(user.country or "Not specified" for user in eligible)
        interests = Counter(interest for user in eligible for interest in (user.opportunity_interests or []))
        age_bands = Counter()
        for user in eligible:
            age = profile_age(user)
            band = "Not specified" if age is None else "18–24" if age <= 24 else "25–34" if age <= 34 else "35+"
            age_bands[band] += 1
        return {"total_matches": len(eligible), "high_confidence": sum(1 for user in eligible if match_for(user, opportunity)["score"] >= 75), "countries": [{"label": label, "count": count} for label, count in countries.most_common(8)], "age_bands": [{"label": label, "count": count} for label, count in age_bands.most_common()], "interests": [{"label": label, "count": count} for label, count in interests.most_common(8)]}

    @action(detail=True, methods=["get"])
    def workspace(self, request, public_id=None):
        opportunity = self.get_object()
        applicants = self._applicant_rows(opportunity)
        audience = self._audience(opportunity)
        application_count = len(applicants)
        qualified_count = sum(1 for applicant in applicants if applicant["status"] in ("shortlisted", "interview", "awarded"))
        return Response({"opportunity": OrganizationOpportunitySerializer(opportunity).data, "metrics": {"matches": audience["total_matches"], "applications": application_count, "qualified": qualified_count, "shortlisted": sum(1 for applicant in applicants if applicant["status"] == "shortlisted"), "views": opportunity.view_count, "application_rate": round(application_count / audience["total_matches"] * 100, 1) if audience["total_matches"] else 0}, "applicants": applicants, "audience": audience})

    @action(detail=False, methods=["get"])
    def applicants(self, request):
        organization = self._organization()
        applications = OpportunityApplication.objects.filter(opportunity__organization=organization, status__in=("applied", "shortlisted", "interview", "awarded", "unsuccessful", "withdrawn")).select_related("user", "opportunity")
        rows = [{"id": application.id, "opportunity_id": str(application.opportunity.public_id), "opportunity_title": application.opportunity.title, "name": application.user.display_name or application.user.username, "status": application.status, "match_score": match_for(application.user, application.opportunity)["score"], "country": application.user.country} for application in applications]
        return Response(rows)

    @action(detail=False, methods=["get"])
    def overview(self, request):
        organization = getattr(request.user, "organization", None)
        if not organization:
            return Response({"detail": "Organization setup is required."}, status=404)
        opportunities = list(self.get_queryset())
        published = [item for item in opportunities if item.review_status == Opportunity.ReviewStatus.APPROVED]
        applications = OpportunityApplication.objects.filter(opportunity__organization=organization, status__in=("applied", "shortlisted", "interview", "awarded", "unsuccessful", "withdrawn"))
        application_count = applications.count()
        qualified_count = applications.filter(status__in=("shortlisted", "interview", "awarded")).count()
        matched_people = {user.id for opportunity in published for user in User.objects.filter(is_active=True) if match_for(user, opportunity)["score"] >= 55}
        now = timezone.now()
        deadlines = [{"title": item.title, "days": max(0, (item.deadline - now).days)} for item in published if item.deadline and item.deadline >= now][:5]
        rows = OrganizationOpportunitySerializer(opportunities, many=True).data
        for row, opportunity in zip(rows, opportunities):
            opportunity_applications = applications.filter(opportunity=opportunity)
            row["application_count"] = opportunity_applications.count()
            row["qualified_count"] = opportunity_applications.filter(status__in=("shortlisted", "interview", "awarded")).count()
        return Response({"organization": {"name": organization.name, "status": organization.status}, "metrics": {"active_opportunities": len(published), "matched_people": len(matched_people), "applications": application_count, "qualified_applicants": qualified_count, "application_rate": round(application_count / len(matched_people) * 100, 1) if matched_people else 0}, "opportunities": rows, "deadlines": deadlines})

    @action(detail=False, methods=["post"], url_path="fetch-link")
    def fetch_link(self, request):
        content = str(request.data.get("content", "")).strip()
        if content:
            from accounts.staff_views import _paste_fields
            fields, confidence, warnings = _paste_fields(content)
            return Response({"fields": fields, "confidence": confidence, "warnings": warnings, "message": "We structured the pasted opportunity. Review every field before submitting."})
        url = str(request.data.get("url", "")).strip()
        fields = _extract_opportunity_from_url(url)
        return Response({"fields": fields, "message": "We filled the form with details found on that page. Please review every field before submitting."})

    def perform_create(self, serializer):
        organization = getattr(self.request.user, "organization", None)
        if not organization or organization.status != organization.Status.VERIFIED:
            raise PermissionDenied("Your organization must be verified before submitting an opportunity.")
        serializer.save(organization=organization, provider=organization.name, review_status=Opportunity.ReviewStatus.PENDING, is_published=False)

    def perform_update(self, serializer):
        if serializer.instance.review_status == Opportunity.ReviewStatus.APPROVED:
            raise PermissionDenied("Published opportunities are locked. Approved opportunities can only be edited by an administrator.")
        serializer.save(review_status=Opportunity.ReviewStatus.PENDING, is_published=False, review_note="")


class PersonalOpportunitySerializer(OrganizationOpportunitySerializer):
    def validate(self, attrs):
        attrs["application_mode"] = Opportunity.ApplicationMode.EXTERNAL
        if not attrs.get("provider", getattr(self.instance, "provider", "")):
            raise serializers.ValidationError({"provider": "Add the organisation offering this opportunity."})
        return super().validate(attrs)

    class Meta(OrganizationOpportunitySerializer.Meta):
        read_only_fields = ("public_id", "review_status", "review_note", "is_published", "created_at", "updated_at")


class PersonalOpportunityViewSet(OrganizationOpportunityViewSet):
    serializer_class = PersonalOpportunitySerializer
    def get_queryset(self):
        return Opportunity.objects.filter(created_by=self.request.user, tracker_only=False).order_by("-updated_at")

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user,
            application_mode=Opportunity.ApplicationMode.EXTERNAL,
            review_status=Opportunity.ReviewStatus.PENDING,
            is_published=False,
        )

    def perform_update(self, serializer):
        if serializer.instance.review_status == Opportunity.ReviewStatus.APPROVED:
            raise PermissionDenied("Published opportunities are locked. Approved opportunities cannot be edited.")
        serializer.save(is_published=False, review_status=Opportunity.ReviewStatus.PENDING, review_note="")

    @action(detail=False, methods=["get"])
    def overview(self, request):
        opportunities = list(self.get_queryset())
        applications = OpportunityApplication.objects.filter(opportunity__in=opportunities, status__in=("applied", "shortlisted", "interview", "awarded", "unsuccessful", "withdrawn"))
        rows = OrganizationOpportunitySerializer(opportunities, many=True).data
        for row, opportunity in zip(rows, opportunities):
            opportunity_applications = applications.filter(opportunity=opportunity)
            row["application_count"] = opportunity_applications.count()
            row["qualified_count"] = opportunity_applications.filter(status__in=("shortlisted", "interview", "awarded")).count()
        return Response({"opportunities": rows})

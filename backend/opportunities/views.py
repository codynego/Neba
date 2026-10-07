from collections import Counter
from datetime import date
import ipaddress
import re
import socket
from html.parser import HTMLParser
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from django.db.models import F, Prefetch, Q
from django.utils import timezone
from rest_framework import permissions, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from accounts.models import User
from .models import Opportunity, OpportunityApplication, OpportunityMessage, SavedOpportunity


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
    return {"title": title[:220], "summary": summary[:1800], "provider": provider[:180], "category": _infer_category(page_text), "application_mode": "external", "application_url": url, "source_url": url, "deadline": deadline, "location_label": "", "is_remote": False, "benefit": "", "eligibility_notes": "", "eligible_countries": [], "education_levels": [], "fields_of_study": [], "employment_statuses": [], "min_age": None, "max_age": None, "requires_business": False}


def profile_age(user):
    if not user.date_of_birth:
        return None
    today = date.today()
    return today.year - user.date_of_birth.year - ((today.month, today.day) < (user.date_of_birth.month, user.date_of_birth.day))


def normalized(values):
    return {str(value).strip().lower() for value in values if str(value).strip()}


def matches_text(values, text):
    return any(value in text for value in normalized(values))


INTENT_CATEGORIES = {
    "work": {"job", "internship"},
    "learn": {"scholarship", "fellowship", "training"},
    "build": {"startup", "competition"},
    "fund": {"grant", "funding"},
}

INTEREST_TERMS = {
    "software-&-technology": {"software", "technology", "tech", "developer", "coding", "engineering"},
    "business": {"business", "entrepreneur", "company", "enterprise"},
    "finance": {"finance", "financial", "accounting", "investment", "fintech"},
    "design": {"design", "designer", "creative"},
    "engineering": {"engineering", "engineer", "technical"},
    "marketing": {"marketing", "brand", "communications", "growth"},
    "healthcare": {"healthcare", "health", "medical", "clinical"},
    "education": {"education", "teaching", "learning", "academic"},
    "creative-work": {"creative", "media", "content", "writing", "arts"},
    "agriculture": {"agriculture", "farming", "agribusiness"},
    "social-impact": {"social impact", "nonprofit", "ngo", "community", "development"},
}


def match_for(user, opportunity):
    score, reasons, missing = 52, [], []
    countries = normalized(opportunity.eligible_countries)
    if countries:
        if user.country.strip().lower() in countries:
            score += 16; reasons.append(f"Open to applicants in {user.country}")
        else: missing.append("Country eligibility needs checking")
    levels = normalized(opportunity.education_levels)
    if levels:
        if user.education_level.strip().lower() in levels:
            score += 13; reasons.append(f"Matches your {user.education_level.lower()} education level")
        else: missing.append("Education level needs checking")
    fields = normalized(opportunity.fields_of_study)
    if fields:
        if user.field_of_study and any(field in user.field_of_study.lower() for field in fields):
            score += 10; reasons.append("Connects with your field of study")
        else: missing.append("Field of study needs checking")
    statuses = normalized(opportunity.employment_statuses)
    if statuses:
        if user.employment_status.strip().lower() in statuses:
            score += 7; reasons.append("Fits your current work status")
        else: missing.append("Employment status needs checking")
    age = profile_age(user)
    if opportunity.min_age or opportunity.max_age:
        if age is None: missing.append("Age eligibility needs checking")
        elif (opportunity.min_age and age < opportunity.min_age) or (opportunity.max_age and age > opportunity.max_age):
            return {"score": 0, "reasons": reasons, "missing": ["Outside the published age range"]}
        else:
            score += 8; reasons.append("Age requirement met")
    if opportunity.requires_business:
        if user.business_status: score += 6; reasons.append("Relevant to your business status")
        else: missing.append("Business status needs checking")
    interests = normalized(user.opportunity_interests)
    if opportunity.category in interests or f"{opportunity.category}s" in interests:
        score += 8; reasons.append(f"You’re looking for {opportunity.get_category_display().lower()} opportunities")
    intent_match = next((intent for intent, categories in INTENT_CATEGORIES.items() if intent in interests and opportunity.category in categories), None)
    if intent_match:
        score += 7; reasons.append(f"Fits your {intent_match} direction")
    opportunity_text = f"{opportunity.title} {opportunity.summary} {opportunity.provider} {opportunity.benefit} {opportunity.eligibility_notes} {opportunity.fields_of_study} {opportunity.location_label}".lower()
    matched_interests = [interest for interest in interests if interest != "remote" and any(term in opportunity_text for term in INTEREST_TERMS.get(interest, {interest.replace("-", " ")}))]
    if matched_interests:
        score += min(8, 3 + len(matched_interests) * 2); reasons.append("Connects with your interest areas")
    if user.skills and matches_text(user.skills, opportunity_text):
        score += 6; reasons.append("Uses skills in your profile")
    if user.goals and matches_text(user.goals, opportunity_text):
        score += 4; reasons.append("Connects with one of your goals")
    if user.state and user.state.strip().lower() in f"{opportunity.location_label} {opportunity.country}".lower():
        score += 4; reasons.append(f"Available near {user.state}")
    if opportunity.is_remote and "remote" in interests:
        score += 4; reasons.append("Matches your remote preference")
    return {"score": min(score, 98), "reasons": reasons[:3], "missing": missing[:2]}


class OpportunitySerializer(serializers.ModelSerializer):
    match = serializers.SerializerMethodField()
    saved_status = serializers.SerializerMethodField()
    application_status = serializers.SerializerMethodField()
    application_count = serializers.SerializerMethodField()

    class Meta:
        model = Opportunity
        fields = ("public_id", "title", "provider", "summary", "category", "application_mode", "application_url", "deadline", "country", "location_label", "is_remote", "benefit", "eligibility_notes", "eligible_countries", "education_levels", "fields_of_study", "employment_statuses", "min_age", "max_age", "requires_business", "source_url", "view_count", "application_count", "created_at", "match", "saved_status", "application_status")

    def get_match(self, opportunity):
        user = self.context["request"].user
        if not user.is_authenticated:
            return None
        return match_for(user, opportunity) if user.is_authenticated else None

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


class OpportunityApplicationSerializer(serializers.ModelSerializer):
    opportunity = OpportunitySerializer(read_only=True)
    opportunity_id = serializers.UUIDField(source="opportunity.public_id", read_only=True)
    applicant_name = serializers.SerializerMethodField()
    is_poster = serializers.SerializerMethodField()
    messages = serializers.SerializerMethodField()
    shared_profile = serializers.SerializerMethodField()
    unread_message_count = serializers.SerializerMethodField()
    def get_applicant_name(self, application): return application.user.display_name or application.user.username
    def get_is_poster(self, application): return application.opportunity.created_by_id == self.context["request"].user.id or application.opportunity.organization_id == getattr(getattr(self.context["request"].user, "organization", None), "id", None)
    def get_messages(self, application): return [{"id": message.id, "sender": message.sender_id, "sender_name": message.sender.display_name or message.sender.username, "text": message.text, "created_at": message.created_at, "is_mine": message.sender_id == self.context["request"].user.id} for message in application.messages.select_related("sender").all()]
    def get_unread_message_count(self, application): return application.messages.filter(read_at__isnull=True).exclude(sender=self.context["request"].user).count()
    def get_shared_profile(self, application):
        user = application.user
        shared = set(application.shared_fields or [])
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
            profile["documents"] = [{"name": document.name, "type": document.get_document_type_display(), "created_at": document.created_at} for document in user.profile_documents.all()]
        return profile
    class Meta:
        model = OpportunityApplication
        fields = ("id", "public_id", "opportunity_id", "opportunity", "status", "applied_at", "next_action", "next_action_at", "notes", "application_message", "additional_information", "shared_fields", "shared_profile", "applicant_name", "is_poster", "messages", "unread_message_count", "created_at", "updated_at")


class OpportunityViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = OpportunitySerializer
    lookup_field = "public_id"

    def get_permissions(self):
        return [permissions.AllowAny()] if self.action in ("list", "retrieve") else [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        queryset = Opportunity.objects.filter(review_status=Opportunity.ReviewStatus.APPROVED)
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
        rows = []
        for opportunity in self.get_queryset():
            match = match_for(request.user, opportunity)
            if match["score"] >= 55: rows.append((match["score"], opportunity))
        rows.sort(key=lambda row: (-row[0], row[1].deadline.timestamp() if row[1].deadline else float("inf")))
        page = self.paginate_queryset([item[1] for item in rows])
        return self.get_paginated_response(self.get_serializer(page, many=True).data) if page is not None else Response(self.get_serializer([item[1] for item in rows], many=True).data)

    @action(detail=False, methods=["get"])
    def dashboard(self, request):
        now = timezone.now()
        opportunities = list(self.get_queryset())
        matched = [(match_for(request.user, item)["score"], item) for item in opportunities]
        matched = [(score, item) for score, item in matched if score >= 55]
        matched.sort(key=lambda row: (-row[0], row[1].deadline.timestamp() if row[1].deadline else float("inf")))
        urgent = [item for _, item in matched if item.deadline and item.deadline >= now][:3]
        saved = SavedOpportunity.objects.filter(user=request.user).select_related("opportunity")[:4]
        all_applications = OpportunityApplication.objects.filter(user=request.user).select_related("opportunity")
        applications = all_applications[:5]
        profile_fields = ("display_name", "country", "education_level", "field_of_study", "employment_status", "skills", "opportunity_interests", "goals")
        complete = sum(bool(getattr(request.user, field)) for field in profile_fields)
        readiness = {"profile": bool(request.user.display_name and request.user.skills and request.user.opportunity_interests), "eligibility": bool(request.user.country and request.user.education_level and request.user.field_of_study), "statement": any(application.notes.strip() for application in applications), "interview": any(application.status in ("interview", "awarded") for application in applications)}
        application_summary = {status: all_applications.filter(status=status).count() for status, _ in OpportunityApplication.Status.choices}
        upcoming_deadlines = sum(1 for _, item in matched if item.deadline and item.deadline >= now)
        return Response({"match_count": len(matched), "new_this_week": len(matched), "upcoming_deadlines": upcoming_deadlines, "application_summary": application_summary, "top_matches": self.get_serializer([item for _, item in matched[:5]], many=True).data, "urgent": self.get_serializer(urgent, many=True).data, "saved": SavedOpportunitySerializer(saved, many=True, context={"request": request}).data, "applications": OpportunityApplicationSerializer(applications, many=True, context={"request": request}).data, "profile_completion": round(complete / len(profile_fields) * 100), "missing_profile_fields": [field for field in profile_fields if not getattr(request.user, field)], "readiness": readiness})

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


class SavedOpportunityViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SavedOpportunitySerializer
    http_method_names = ["get", "patch", "delete", "head", "options"]
    def get_queryset(self): return SavedOpportunity.objects.filter(user=self.request.user).select_related("opportunity")


class OpportunityApplicationViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OpportunityApplicationSerializer
    lookup_field = "public_id"
    def get_queryset(self): return OpportunityApplication.objects.filter(Q(user=self.request.user) | Q(opportunity__created_by=self.request.user) | Q(opportunity__organization__owner=self.request.user)).select_related("opportunity", "user").prefetch_related("messages__sender").distinct()
    def create(self, request, *args, **kwargs):
        opportunity = Opportunity.objects.filter(public_id=request.data.get("opportunity_id"), review_status=Opportunity.ReviewStatus.APPROVED).first()
        if not opportunity: raise serializers.ValidationError({"opportunity_id": "Choose a valid opportunity."})
        status = request.data.get("status", "preparing")
        submitted = status in ("applied", "shortlisted", "interview", "awarded")
        item, created = OpportunityApplication.objects.get_or_create(user=request.user, opportunity=opportunity, defaults={"status": status, "applied_at": timezone.now() if submitted else None, "application_message": str(request.data.get("application_message", ""))[:2000], "additional_information": str(request.data.get("additional_information", ""))[:3000], "shared_fields": request.data.get("shared_fields", [])})
        if not created: raise serializers.ValidationError("This opportunity is already in your application tracker.")
        SavedOpportunity.objects.update_or_create(user=request.user, opportunity=opportunity, defaults={"status": "applied" if submitted else "preparing"})
        return Response(self.get_serializer(item).data, status=201)

    def update(self, request, *args, **kwargs):
        application = self.get_object()
        is_poster = application.opportunity.created_by_id == request.user.id or application.opportunity.organization_id == getattr(getattr(request.user, "organization", None), "id", None)
        if is_poster:
            if set(request.data) - {"status"}: raise permissions.PermissionDenied("Posters can update application status only.")
        elif request.data.get("status") in ("applied", "shortlisted", "interview", "awarded"):
            request.data["applied_at"] = request.data.get("applied_at") or timezone.now().isoformat()
        return super().update(request, *args, **kwargs)

    @action(detail=True, methods=["get", "post"])
    def messages(self, request, public_id=None):
        application = self.get_object()
        if request.method == "GET":
            application.messages.filter(read_at__isnull=True).exclude(sender=request.user).update(read_at=timezone.now())
            return Response(self.get_serializer(application).data["messages"])
        if application.status in (OpportunityApplication.Status.UNSUCCESSFUL, OpportunityApplication.Status.WITHDRAWN) and application.user_id == request.user.id:
            raise permissions.PermissionDenied("Messaging is closed for this application.")
        text = serializers.CharField(max_length=2000).run_validation(request.data.get("text"))
        message = OpportunityMessage.objects.create(application=application, sender=request.user, text=text)
        return Response({"id": message.id, "sender": message.sender_id, "sender_name": message.sender.display_name or request.user.username, "text": message.text, "created_at": message.created_at, "is_mine": True}, status=201)


class OrganizationOpportunitySerializer(serializers.ModelSerializer):
    def validate(self, attrs):
        mode = attrs.get("application_mode", getattr(self.instance, "application_mode", Opportunity.ApplicationMode.EXTERNAL))
        url = attrs.get("application_url", getattr(self.instance, "application_url", ""))
        if mode == Opportunity.ApplicationMode.EXTERNAL and not url:
            raise serializers.ValidationError({"application_url": "Add an application URL for an external application."})
        return attrs

    class Meta:
        model = Opportunity
        fields = ("public_id", "title", "provider", "summary", "category", "application_mode", "application_url", "deadline", "country", "location_label", "is_remote", "benefit", "eligibility_notes", "eligible_countries", "education_levels", "fields_of_study", "employment_statuses", "min_age", "max_age", "requires_business", "source_url", "review_status", "review_note", "is_published", "view_count", "created_at", "updated_at")
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
            rows.append({"id": application.id, "application_id": str(application.public_id), "applicant_id": application.user.id, "name": application.user.display_name or application.user.username, "country": application.user.country, "status": application.status, "match_score": match["score"], "match_reasons": match["reasons"], "missing": match["missing"], "notes": application.notes, "application_message": application.application_message, "additional_information": application.additional_information, "shared_fields": application.shared_fields, "created_at": application.created_at})
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
        url = str(request.data.get("url", "")).strip()
        fields = _extract_opportunity_from_url(url)
        return Response({"fields": fields, "message": "We filled the form with details found on that page. Please review every field before submitting."})

    def perform_create(self, serializer):
        organization = getattr(self.request.user, "organization", None)
        if not organization or organization.status != organization.Status.VERIFIED:
            raise PermissionDenied("Your organization must be verified before submitting an opportunity.")
        serializer.save(organization=organization, provider=organization.name, review_status=Opportunity.ReviewStatus.PENDING, is_published=False)

    def perform_update(self, serializer):
        serializer.save(review_status=Opportunity.ReviewStatus.PENDING, is_published=False, review_note="")


class PersonalOpportunityViewSet(OrganizationOpportunityViewSet):
    def get_queryset(self):
        return Opportunity.objects.filter(created_by=self.request.user).order_by("-updated_at")

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user,
            provider=self.request.user.display_name or self.request.user.username,
            review_status=Opportunity.ReviewStatus.PENDING,
            is_published=False,
        )

    def perform_update(self, serializer):
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

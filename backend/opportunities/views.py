from datetime import date

from django.db.models import Prefetch, Q
from django.utils import timezone
from rest_framework import permissions, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from accounts.models import User
from .models import Opportunity, OpportunityApplication, SavedOpportunity


def profile_age(user):
    if not user.date_of_birth:
        return None
    today = date.today()
    return today.year - user.date_of_birth.year - ((today.month, today.day) < (user.date_of_birth.month, user.date_of_birth.day))


def normalized(values):
    return {str(value).strip().lower() for value in values if str(value).strip()}


def matches_text(values, text):
    return any(value in text for value in normalized(values))


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
    opportunity_text = f"{opportunity.title} {opportunity.summary} {opportunity.fields_of_study} ".lower()
    if user.skills and matches_text(user.skills, opportunity_text):
        score += 6; reasons.append("Uses skills in your profile")
    if user.goals and matches_text(user.goals, opportunity_text):
        score += 4; reasons.append("Connects with one of your goals")
    if opportunity.is_remote: score += 2; reasons.append("Available remotely")
    return {"score": min(score, 98), "reasons": reasons[:3], "missing": missing[:2]}


class OpportunitySerializer(serializers.ModelSerializer):
    match = serializers.SerializerMethodField()
    saved_status = serializers.SerializerMethodField()
    application_status = serializers.SerializerMethodField()

    class Meta:
        model = Opportunity
        fields = ("public_id", "title", "provider", "summary", "category", "application_url", "deadline", "country", "location_label", "is_remote", "benefit", "eligibility_notes", "eligible_countries", "education_levels", "fields_of_study", "employment_statuses", "min_age", "max_age", "requires_business", "source_url", "created_at", "match", "saved_status", "application_status")

    def get_match(self, opportunity):
        user = self.context["request"].user
        return match_for(user, opportunity) if user.is_authenticated else None

    def get_saved_status(self, opportunity):
        user = self.context["request"].user
        if not user.is_authenticated: return None
        item = next((save for save in getattr(opportunity, "user_saves", []) if save.user_id == user.pk), None)
        return item.status if item else None

    def get_application_status(self, opportunity):
        user = self.context["request"].user
        if not user.is_authenticated: return None
        item = next((application for application in getattr(opportunity, "user_applications", []) if application.user_id == user.pk), None)
        return item.status if item else None


class SavedOpportunitySerializer(serializers.ModelSerializer):
    opportunity = OpportunitySerializer(read_only=True)
    opportunity_id = serializers.UUIDField(source="opportunity.public_id", read_only=True)
    class Meta:
        model = SavedOpportunity
        fields = ("id", "opportunity_id", "opportunity", "status", "note", "saved_at", "updated_at")


class OpportunityApplicationSerializer(serializers.ModelSerializer):
    opportunity = OpportunitySerializer(read_only=True)
    opportunity_id = serializers.UUIDField(source="opportunity.public_id", read_only=True)
    class Meta:
        model = OpportunityApplication
        fields = ("id", "opportunity_id", "opportunity", "status", "applied_at", "next_action", "next_action_at", "notes", "created_at", "updated_at")


class OpportunityViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OpportunitySerializer
    lookup_field = "public_id"

    def get_queryset(self):
        user = self.request.user
        queryset = Opportunity.objects.filter(is_published=True).prefetch_related(
            Prefetch("saves", queryset=SavedOpportunity.objects.filter(user=user), to_attr="user_saves"),
            Prefetch("applications", queryset=OpportunityApplication.objects.filter(user=user), to_attr="user_applications"),
        )
        query = self.request.query_params.get("search", "").strip()
        category = self.request.query_params.get("category", "").strip()
        if query: queryset = queryset.filter(Q(title__icontains=query) | Q(provider__icontains=query) | Q(summary__icontains=query))
        if category: queryset = queryset.filter(category=category)
        return queryset

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
        profile_fields = ("country", "education_level", "field_of_study", "employment_status", "skills", "goals")
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
    def get_queryset(self): return OpportunityApplication.objects.filter(user=self.request.user).select_related("opportunity")
    def create(self, request, *args, **kwargs):
        opportunity = Opportunity.objects.filter(public_id=request.data.get("opportunity_id"), is_published=True).first()
        if not opportunity: raise serializers.ValidationError({"opportunity_id": "Choose a valid opportunity."})
        item, created = OpportunityApplication.objects.get_or_create(user=request.user, opportunity=opportunity, defaults={"status": request.data.get("status", "preparing")})
        if not created: raise serializers.ValidationError("This opportunity is already in your application tracker.")
        SavedOpportunity.objects.update_or_create(user=request.user, opportunity=opportunity, defaults={"status": "preparing"})
        return Response(self.get_serializer(item).data, status=201)


class OrganizationOpportunitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Opportunity
        fields = ("public_id", "title", "provider", "summary", "category", "application_url", "deadline", "country", "location_label", "is_remote", "benefit", "eligibility_notes", "eligible_countries", "education_levels", "fields_of_study", "employment_statuses", "min_age", "max_age", "requires_business", "source_url", "review_status", "review_note", "is_published", "created_at", "updated_at")
        read_only_fields = ("public_id", "provider", "review_status", "review_note", "is_published", "created_at", "updated_at")


class OrganizationOpportunityViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OrganizationOpportunitySerializer
    lookup_field = "public_id"
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        return Opportunity.objects.filter(organization__owner=self.request.user).order_by("-updated_at")

    @action(detail=False, methods=["get"])
    def overview(self, request):
        organization = getattr(request.user, "organization", None)
        if not organization:
            return Response({"detail": "Organization setup is required."}, status=404)
        opportunities = list(self.get_queryset())
        published = [item for item in opportunities if item.is_published]
        applications = OpportunityApplication.objects.filter(opportunity__organization=organization)
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

    def perform_create(self, serializer):
        organization = getattr(self.request.user, "organization", None)
        if not organization or organization.status != organization.Status.VERIFIED:
            raise PermissionDenied("Your organization must be verified before submitting an opportunity.")
        serializer.save(organization=organization, provider=organization.name, review_status=Opportunity.ReviewStatus.PENDING, is_published=False)

    def perform_update(self, serializer):
        serializer.save(review_status=Opportunity.ReviewStatus.PENDING, is_published=False, review_note="")

import io
import json
import re
from datetime import datetime

from django.conf import settings
from django.core.management import call_command
from django.db.models import Count, Sum
from django.utils import timezone
import requests
from rest_framework import permissions, serializers
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from opportunities.models import Opportunity, OpportunityApplication, SavedOpportunity
from .models import IdentityVerification, Organization, SafetyReport, TrustAudit, User
from .trust import review_identity


class StaffOnly(permissions.IsAdminUser):
    pass


def _category_from_text(value):
    lowered = value.lower()
    for category in ("scholarship", "grant", "internship", "fellowship", "competition", "training", "startup", "funding", "tender", "job"):
        if category in lowered:
            return category
    return "job"


def _fallback_paste_fields(content):
    """Conservatively structure supplied copy; blank means unknown, never invented."""
    text = "\n".join(line.strip() for line in content.splitlines() if line.strip())[:12000]
    lines = [line for line in text.splitlines() if line]
    title = lines[0][:220] if lines else ""
    labeled = {}
    for line in lines:
        match = re.match(r"^(title|provider|organization|summary|description|deadline|closing date|location|country|eligibility|application url|apply here)\s*[:\-]\s*(.+)$", line, re.I)
        if match:
            labeled[match.group(1).lower()] = match.group(2).strip()
    summary = labeled.get("summary") or labeled.get("description") or " ".join(lines[1:])[:1800]
    provider = labeled.get("provider") or labeled.get("organization") or ""
    raw_deadline = labeled.get("deadline") or labeled.get("closing date") or ""
    deadline = None
    date_match = re.search(r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})", raw_deadline)
    if date_match:
        raw = date_match.group(1).replace("/", "-")
        parts = raw.split("-")
        try:
            if len(parts[0]) == 4:
                parsed = datetime(int(parts[0]), int(parts[1]), int(parts[2]), 23, 59)
            else:
                year = int(parts[2]) + (2000 if int(parts[2]) < 100 else 0)
                parsed = datetime(year, int(parts[1]), int(parts[0]), 23, 59)
            deadline = parsed.isoformat()
        except ValueError:
            deadline = None
    application_url = labeled.get("application url") or labeled.get("apply here") or ""
    category = _category_from_text(text)
    fields = {
        "title": labeled.get("title") or title,
        "provider": provider,
        "summary": summary,
        "category": category,
        "application_mode": "external",
        "application_url": application_url,
        "source_url": "",
        "deadline": deadline,
        "country": labeled.get("country", ""),
        "location_label": labeled.get("location", ""),
        "is_remote": "remote" in text.lower(),
        "benefit": "",
        "eligibility_notes": labeled.get("eligibility", ""),
        "eligible_countries": [],
        "education_levels": [],
        "fields_of_study": [],
        "employment_statuses": [],
        "min_age": None,
        "max_age": None,
        "requires_business": False,
        "requires_physical_presence": False,
        "requires_local_residency": False,
    }
    confidence = {"title": 94 if fields["title"] else 0, "summary": 78 if summary else 0, "provider": 82 if provider else 0, "deadline": 88 if deadline else 0, "application_url": 92 if application_url else 0}
    warnings = [f"Add {label.replace('_', ' ')}" for label, value in (("provider", provider), ("deadline", deadline), ("application URL", application_url)) if not value]
    fields["role"] = fields["title"] if category in ("job", "internship") else ""
    fields["compensation"] = fields["benefit"]
    return fields, confidence, warnings


def _paste_fields(content):
    """Use AI to extract every supported field, with a deterministic fallback."""
    fallback_fields, fallback_confidence, fallback_warnings = _fallback_paste_fields(content)
    if not settings.OPENAI_API_KEY:
        return fallback_fields, fallback_confidence, fallback_warnings
    instructions = (
        "You are GetNeba's opportunity extraction assistant. Extract facts from the supplied opportunity text into valid JSON only. "
        "Never invent or infer a fact that is not supported by the text; use empty strings, empty arrays, false, or null when unknown. "
        "Choose exactly one category from scholarship, grant, job, internship, fellowship, competition, training, startup, funding, tender. "
        "Use the precise role in role and title when a role is stated. Put salary, stipend, allowance, prize, grant amount, or other monetary support in compensation and benefit. "
        "Set requires_physical_presence only when attendance at a named location is required. Set requires_local_residency only when applicants must already reside there. "
        "Preserve useful eligibility and application details instead of shortening them away. Dates must be ISO local datetime strings when a date is explicit. "
        "Return JSON with fields, confidence, and warnings. Confidence values are integer percentages."
    )
    schema = {
        "fields": {
            "title": "", "role": "", "provider": "", "summary": "", "category": "job", "application_mode": "external",
            "application_url": "", "source_url": "", "deadline": None, "country": "", "location_label": "", "is_remote": False,
            "benefit": "", "compensation": "", "eligibility_notes": "", "eligible_countries": [], "education_levels": [],
            "fields_of_study": [], "employment_statuses": [], "min_age": None, "max_age": None, "requires_business": False,
            "requires_physical_presence": False, "requires_local_residency": False,
        },
        "confidence": {}, "warnings": [],
    }
    try:
        response = requests.post(
            "https://api.openai.com/v1/responses",
            headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}", "Content-Type": "application/json"},
            json={"model": settings.OPENAI_TEXT_MODEL, "instructions": instructions, "input": f"Required JSON shape:\n{json.dumps(schema)}\n\nOpportunity text:\n{content[:12000]}"},
            timeout=30,
        )
        if not response.ok:
            return fallback_fields, fallback_confidence, fallback_warnings
        data = response.json()
        output = str(data.get("output_text", "")).strip()
        if not output:
            output = " ".join(content.get("text", "") for item in data.get("output", []) for content in item.get("content", []) if content.get("type") == "output_text").strip()
        output = re.sub(r"^```(?:json)?\s*|\s*```$", "", output.strip(), flags=re.IGNORECASE)
        result = json.loads(output)
        extracted = result.get("fields") if isinstance(result, dict) else None
        if not isinstance(extracted, dict) or not extracted.get("title") and not extracted.get("summary"):
            return fallback_fields, fallback_confidence, fallback_warnings
        fields = {**fallback_fields, **extracted}
        if fields.get("category") not in {choice[0] for choice in Opportunity.Category.choices}:
            fields["category"] = fallback_fields["category"]
        if fields.get("application_mode") not in {choice[0] for choice in Opportunity.ApplicationMode.choices}:
            fields["application_mode"] = "external"
        if not fields.get("application_url"):
            fields["application_mode"] = "external"
        fields["role"] = str(fields.get("role") or "")
        fields["compensation"] = str(fields.get("compensation") or fields.get("benefit") or "")
        fields["benefit"] = str(fields.get("benefit") or fields["compensation"] or "")
        for key in ("eligible_countries", "education_levels", "fields_of_study", "employment_statuses"):
            if not isinstance(fields.get(key), list):
                fields[key] = []
        for key in ("min_age", "max_age"):
            try:
                fields[key] = int(fields[key]) if fields.get(key) is not None and str(fields[key]).strip() else None
            except (TypeError, ValueError):
                fields[key] = None
        return fields, result.get("confidence") or fallback_confidence, result.get("warnings") or []
    except (requests.RequestException, json.JSONDecodeError, TypeError, ValueError):
        return fallback_fields, fallback_confidence, fallback_warnings


class StaffOpportunityCollection(APIView):
    permission_classes = [StaffOnly]

    def get(self, request):
        queryset = Opportunity.objects.select_related("created_by", "organization").order_by("-updated_at")
        status = str(request.query_params.get("status", "")).strip()
        query = str(request.query_params.get("q", "")).strip()
        if status:
            queryset = queryset.filter(review_status=status)
        if query:
            queryset = queryset.filter(title__icontains=query) | queryset.filter(provider__icontains=query)
        rows = [{
            "public_id": str(item.public_id), "title": item.title, "provider": item.provider,
            "category": item.category, "review_status": item.review_status, "is_published": item.is_published,
            "source_url": item.source_url, "created_at": item.created_at, "updated_at": item.updated_at,
            "source_type": "Neba Verified" if not item.source_url else "Imported source",
            "publisher": (item.created_by.display_name or item.created_by.username) if item.created_by else (item.organization.name if item.organization else item.provider),
        } for item in queryset[:200]]
        return Response(rows)

    def post(self, request):
        data = request.data
        mode = str(data.get("mode", "manual"))
        if mode == "paste":
            content = str(data.get("content", "")).strip()
            if len(content) < 20:
                return Response({"detail": "Paste the opportunity text you want to structure."}, status=400)
            fields, confidence, warnings = _paste_fields(content)
            return Response({"fields": fields, "confidence": confidence, "warnings": warnings, "message": "Draft structured from the supplied text. Check every field before publishing."})
        if mode == "link":
            from opportunities.views import _extract_opportunity_from_url
            fields = _extract_opportunity_from_url(str(data.get("url", "")).strip())
            fields["provider"] = str(data.get("provider") or fields.get("provider") or "")[:180]
        else:
            fields = data
        title = str(fields.get("title", "")).strip()
        summary = str(fields.get("summary", "")).strip()
        if not title or not summary:
            return Response({"detail": "Add a title and summary before publishing."}, status=400)
        application_mode = str(fields.get("application_mode") or "external")
        application_url = str(fields.get("application_url") or "").strip()
        if application_mode == "external" and not application_url:
            return Response({"detail": "Add an application URL or change the application method to Inside Getneba."}, status=400)
        opportunity = Opportunity.objects.create(
            title=title[:220], provider=str(fields.get("provider") or "Getneba").strip()[:180], summary=summary[:1800],
            category=str(fields.get("category") or "job"), application_mode=application_mode,
            application_url=application_url, deadline=fields.get("deadline") or None,
            country=str(fields.get("country") or ""), location_label=str(fields.get("location_label") or ""),
            is_remote=bool(fields.get("is_remote")),
            requires_physical_presence=bool(not fields.get("is_remote") and (fields.get("requires_physical_presence") or fields.get("requires_local_residency"))),
            requires_local_residency=bool(not fields.get("is_remote") and fields.get("requires_local_residency")),
            benefit=str(fields.get("benefit") or "")[:220],
            eligibility_notes=str(fields.get("eligibility_notes") or "")[:1200], eligible_countries=fields.get("eligible_countries") or [],
            education_levels=fields.get("education_levels") or [], fields_of_study=fields.get("fields_of_study") or [],
            employment_statuses=fields.get("employment_statuses") or [], min_age=fields.get("min_age") or None,
            max_age=fields.get("max_age") or None, requires_business=bool(fields.get("requires_business")),
            source_url=str(fields.get("source_url") or "")[:500], created_by=request.user,
            review_status=Opportunity.ReviewStatus.APPROVED, is_published=True,
        )
        return Response({"public_id": str(opportunity.public_id), "title": opportunity.title, "review_status": opportunity.review_status, "is_published": opportunity.is_published}, status=201)


class StaffOperationsSection(APIView):
    permission_classes = [StaffOnly]

    def get(self, request, section):
        if section == "users":
            users = User.objects.order_by("-date_joined")[:200]
            return Response({"rows": [{"id": user.id, "name": user.display_name or user.username, "email": user.email, "username": user.username, "country": user.country, "active": user.is_active, "verified": bool(user.identity_verified_at), "profile_complete": user.profile_complete, "joined": user.date_joined} for user in users], "metrics": {"total": User.objects.count(), "active": User.objects.filter(is_active=True).count(), "verified": User.objects.filter(identity_verified_at__isnull=False).count()}})
        if section == "organizations":
            organizations = Organization.objects.select_related("owner").order_by("-updated_at")
            return Response({"rows": [{"id": item.id, "name": item.name, "type": item.get_organization_type_display(), "country": item.country, "website": item.website, "owner": item.owner.display_name or item.owner.username, "status": item.status, "opportunities": item.opportunities.count(), "updated_at": item.updated_at} for item in organizations[:200]], "metrics": {"total": organizations.count(), "verified": organizations.filter(status=Organization.Status.VERIFIED).count(), "pending": organizations.filter(status=Organization.Status.PENDING).count()}})
        if section == "applications":
            applications = OpportunityApplication.objects.select_related("user", "opportunity").exclude(status="preparing").order_by("-updated_at")[:200]
            return Response({"rows": [{"id": str(item.public_id), "user": item.user.display_name or item.user.username, "opportunity": item.opportunity.title, "status": item.status, "deadline": item.opportunity.deadline, "updated_at": item.updated_at, "country": item.user.country} for item in applications], "metrics": {"total": OpportunityApplication.objects.exclude(status="preparing").count(), "applied": OpportunityApplication.objects.filter(status="applied").count(), "active": OpportunityApplication.objects.filter(status__in=("shortlisted", "interview")).count()}})
        if section == "reports":
            reports = SafetyReport.objects.select_related("reporter", "reported_user", "reviewed_by").order_by("status", "-created_at")[:200]
            return Response({"rows": [{"id": item.id, "reason": item.get_reason_display(), "details": item.details, "status": item.status, "reporter": item.reporter.display_name or item.reporter.username, "reported": item.reported_user.display_name or item.reported_user.username, "created_at": item.created_at, "staff_note": item.staff_note} for item in reports], "metrics": {"open": SafetyReport.objects.filter(status__in=("open", "reviewing")).count(), "resolved": SafetyReport.objects.filter(status="resolved").count(), "total": SafetyReport.objects.count()}})
        if section == "sources":
            opportunities = Opportunity.objects.exclude(source_url="").only("source_url", "provider", "review_status", "created_at", "updated_at")
            grouped = {}
            for item in opportunities:
                source = item.source_url.split("/")[2] if "://" in item.source_url else item.source_url
                row = grouped.setdefault(source, {"source": source, "url": item.source_url, "opportunities": 0, "published": 0, "last_imported": item.updated_at})
                row["opportunities"] += 1
                row["published"] += int(item.is_published)
                row["last_imported"] = max(row["last_imported"], item.updated_at)
            return Response({"rows": sorted(grouped.values(), key=lambda row: row["opportunities"], reverse=True), "metrics": {"sources": len(grouped), "imported": opportunities.count(), "published": opportunities.filter(is_published=True).count()}})
        if section == "analytics":
            return Response({"metrics": {"users": User.objects.count(), "active_users": User.objects.filter(is_active=True).count(), "opportunities": Opportunity.objects.count(), "published_opportunities": Opportunity.objects.filter(is_published=True).count(), "views": Opportunity.objects.aggregate(total=Sum("view_count"))["total"] or 0, "saves": SavedOpportunity.objects.count(), "applications": OpportunityApplication.objects.exclude(status="preparing").count(), "reports": SafetyReport.objects.count()}, "categories": [{"label": label, "count": Opportunity.objects.filter(category=value).count()} for value, label in Opportunity.Category.choices]})
        if section == "content":
            items = Opportunity.objects.order_by("-updated_at")[:100]
            return Response({"rows": [{"id": str(item.public_id), "title": item.title, "type": "Opportunity", "status": "Published" if item.is_published else item.review_status, "updated_at": item.updated_at} for item in items], "metrics": {"total": Opportunity.objects.count(), "published": Opportunity.objects.filter(is_published=True).count(), "needs_review": Opportunity.objects.filter(review_status=Opportunity.ReviewStatus.PENDING).count()}})
        if section == "settings":
            return Response({"groups": [{"title": "Opportunity policy", "items": [{"label": "Review required for member posts", "value": "Yes"}, {"label": "Neba Verified posts", "value": "Published by authorized operations staff"}, {"label": "Public listing source", "value": "Approved opportunities only"}]}, {"title": "Trust & safety", "items": [{"label": "Identity evidence access", "value": "Restricted to authorized reviewers"}, {"label": "Open report statuses", "value": "Open and Under review"}]}, {"title": "Platform", "items": [{"label": "Environment", "value": getattr(settings, "ENVIRONMENT", "Configured deployment")}, {"label": "Verification retention", "value": f"{settings.VERIFICATION_RETENTION_DAYS} days"}]}]})
        raise ValidationError("Unknown operations section.")

    def post(self, request, section):
        action = str(request.data.get("action", ""))
        if section == "users" and action in ("suspend", "restore"):
            user = User.objects.filter(pk=request.data.get("id")).first()
            if not user:
                raise ValidationError("User not found.")
            user.is_active = action == "restore"
            user.save(update_fields=("is_active",))
            TrustAudit.objects.create(actor=request.user, subject=user, action=f"user_{action}")
            return Response({"id": user.id, "active": user.is_active})
        if section == "organizations" and action == "verify":
            organization = Organization.objects.filter(pk=request.data.get("id")).first()
            if not organization:
                raise ValidationError("Organization not found.")
            organization.status = Organization.Status.VERIFIED
            organization.verified_at = timezone.now()
            organization.save(update_fields=("status", "verified_at", "updated_at"))
            TrustAudit.objects.create(actor=request.user, subject=organization.owner, action="organization_approved", note=organization.name)
            return Response({"id": organization.id, "status": organization.status})
        if section == "reports" and action in ("reviewing", "resolved", "dismissed"):
            report = SafetyReport.objects.filter(pk=request.data.get("id")).first()
            if not report:
                raise ValidationError("Report not found.")
            report.status = action
            report.reviewed_by = request.user
            report.staff_note = str(request.data.get("note", ""))[:2000]
            report.save(update_fields=("status", "reviewed_by", "staff_note"))
            TrustAudit.objects.create(actor=request.user, subject=report.reported_user, action=f"report_{action}", note=report.reason)
            return Response({"id": report.id, "status": report.status})
        raise ValidationError("That operations action is not available.")


class StaffDashboard(APIView):
    permission_classes = [StaffOnly]

    def get(self, request):
        pending_identity = IdentityVerification.objects.filter(status=IdentityVerification.Status.PENDING).select_related("user").order_by("created_at")[:20]
        pending_organizations = Organization.objects.filter(status=Organization.Status.PENDING).select_related("owner").order_by("created_at")[:20]
        pending_opportunity_count = Opportunity.objects.filter(review_status=Opportunity.ReviewStatus.PENDING).count()
        pending_opportunities = Opportunity.objects.filter(review_status=Opportunity.ReviewStatus.PENDING).select_related("created_by", "organization").order_by("created_at")[:20]
        submitted_applications = OpportunityApplication.objects.exclude(status="preparing")
        return Response({
            "analytics": {
                "users": User.objects.count(),
                "active_users": User.objects.filter(is_active=True).count(),
                "verified_users": User.objects.filter(identity_verified_at__isnull=False).count(),
                "organizations": Organization.objects.count(),
                "verified_organizations": Organization.objects.filter(status=Organization.Status.VERIFIED).count(),
                "opportunities": Opportunity.objects.count(),
                "published_opportunities": Opportunity.objects.filter(is_published=True).count(),
                "pending_reviews": pending_opportunity_count,
                "views": Opportunity.objects.aggregate(total=Sum("view_count"))["total"] or 0,
                "applications": submitted_applications.count(),
                "open_reports": SafetyReport.objects.filter(status__in=("open", "reviewing")).count(),
            },
            "queues": {
                "identity": [{"id": item.id, "name": item.user.display_name or item.user.username, "username": item.user.username, "status": item.status, "created_at": item.created_at, "evidence_url": f"/auth/verification/{item.id}/evidence/"} for item in pending_identity],
                "organizations": [{"id": item.id, "name": item.name, "type": item.organization_type, "country": item.country, "owner": item.owner.display_name or item.owner.username, "created_at": item.created_at} for item in pending_organizations],
                "opportunities": [{"public_id": str(item.public_id), "title": item.title, "provider": item.provider, "category": item.category, "created_at": item.created_at, "owner": (item.created_by.display_name or item.created_by.username) if item.created_by else (item.organization.name if item.organization else item.provider)} for item in pending_opportunities],
            },
        })


class OpportunityFetch(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        cron_secret = getattr(settings, "CRON_SECRET", "")
        supplied_secret = request.headers.get("Authorization", "").removeprefix("Bearer ") or request.headers.get("X-Cron-Secret", "")
        if not ((cron_secret and supplied_secret == cron_secret) or request.user.is_authenticated and request.user.is_staff):
            return Response({"detail": "Not authorized."}, status=403)
        output = io.StringIO()
        call_command("fetch_opportunities", stdout=output, stderr=output)
        return Response({"status": "completed", "output": output.getvalue()})


class StaffIdentityDecision(APIView):
    permission_classes = [StaffOnly]

    def post(self, request, pk):
        submission = IdentityVerification.objects.filter(pk=pk).first()
        if not submission:
            raise ValidationError("Identity submission not found.")
        approve = bool(request.data.get("approve"))
        if approve:
            for field in ("document_checked", "face_matched", "challenge_matched", "adult_checked"):
                if field in request.data:
                    setattr(submission, field, bool(request.data[field]))
            submission.save(update_fields=("document_checked", "face_matched", "challenge_matched", "adult_checked"))
        result = review_identity(submission, request.user, approve, str(request.data.get("note", "")))
        return Response({"id": result.id, "status": result.status, "review_note": result.review_note})


class StaffOrganizationDecision(APIView):
    permission_classes = [StaffOnly]

    def post(self, request, pk):
        organization = Organization.objects.filter(pk=pk).first()
        if not organization:
            raise ValidationError("Organization not found.")
        approve = bool(request.data.get("approve"))
        organization.status = Organization.Status.VERIFIED if approve else Organization.Status.DRAFT
        organization.verified_at = timezone.now() if approve else None
        organization.save(update_fields=("status", "verified_at", "updated_at"))
        TrustAudit.objects.create(actor=request.user, subject=organization.owner, action="organization_approved" if approve else "organization_rejected", note=str(request.data.get("note", ""))[:500])
        return Response({"id": organization.id, "status": organization.status})


class StaffOpportunityDecision(APIView):
    permission_classes = [StaffOnly]

    def post(self, request, public_id):
        opportunity = Opportunity.objects.filter(public_id=public_id).first()
        if not opportunity:
            raise ValidationError("Opportunity not found.")
        approve = bool(request.data.get("approve"))
        opportunity.review_status = Opportunity.ReviewStatus.APPROVED if approve else Opportunity.ReviewStatus.REJECTED
        opportunity.is_published = approve
        opportunity.review_note = str(request.data.get("note", ""))[:500]
        opportunity.save(update_fields=("review_status", "is_published", "review_note", "updated_at"))
        awarded_credits = 0
        if approve and opportunity.created_by:
            from .credits import award_contribution_credits
            awarded_credits = award_contribution_credits(opportunity)
        subject = opportunity.created_by or (opportunity.organization.owner if opportunity.organization else None)
        if subject:
            TrustAudit.objects.create(actor=request.user, subject=subject, action="opportunity_approved" if approve else "opportunity_rejected", note=f"{opportunity.title}: {opportunity.review_note}")
        return Response({"public_id": str(opportunity.public_id), "review_status": opportunity.review_status, "is_published": opportunity.is_published, "review_note": opportunity.review_note, "awarded_credits": awarded_credits})

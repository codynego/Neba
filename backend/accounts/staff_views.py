from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework import permissions, serializers
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from opportunities.models import Opportunity, OpportunityApplication
from .models import IdentityVerification, Organization, SafetyReport, TrustAudit, User
from .trust import review_identity


class StaffOnly(permissions.IsAdminUser):
    pass


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
        subject = opportunity.created_by or (opportunity.organization.owner if opportunity.organization else None)
        if subject:
            TrustAudit.objects.create(actor=request.user, subject=subject, action="opportunity_approved" if approve else "opportunity_rejected", note=f"{opportunity.title}: {opportunity.review_note}")
        return Response({"public_id": str(opportunity.public_id), "review_status": opportunity.review_status, "is_published": opportunity.is_published, "review_note": opportunity.review_note})

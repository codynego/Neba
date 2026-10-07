from django.contrib import admin
from django.db import connection
from django.http import JsonResponse
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from accounts.notification_views import NotificationViewSet
from accounts.staff_views import OpportunityFetch, StaffDashboard, StaffIdentityDecision, StaffOrganizationDecision, StaffOperationsSection, StaffOpportunityCollection, StaffOpportunityDecision
from opportunities.views import OpportunityApplicationViewSet, OpportunityViewSet, OrganizationOpportunityViewSet, PersonalOpportunityViewSet, SavedOpportunityViewSet
from ai_views import InterviewText, InterviewTranscription, InterviewReport

router = DefaultRouter()
router.register("notifications", NotificationViewSet, basename="notification")
router.register("opportunities", OpportunityViewSet, basename="opportunity")
router.register("saved-opportunities", SavedOpportunityViewSet, basename="saved-opportunity")
router.register("opportunity-applications", OpportunityApplicationViewSet, basename="opportunity-application")
router.register("organization/opportunities", OrganizationOpportunityViewSet, basename="organization-opportunity")
router.register("my-opportunities", PersonalOpportunityViewSet, basename="personal-opportunity")


def health(request):
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
        cursor.fetchone()
    return JsonResponse({"status": "ok"})

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health),
    path("api/auth/", include("accounts.urls")),
    path("api/operations/dashboard/", StaffDashboard.as_view()),
    path("api/operations/opportunities/fetch/", OpportunityFetch.as_view()),
    path("api/operations/opportunities/", StaffOpportunityCollection.as_view()),
    path("api/operations/<str:section>/", StaffOperationsSection.as_view()),
    path("api/operations/identity/<int:pk>/decision/", StaffIdentityDecision.as_view()),
    path("api/operations/organizations/<int:pk>/decision/", StaffOrganizationDecision.as_view()),
    path("api/operations/opportunities/<uuid:public_id>/decision/", StaffOpportunityDecision.as_view()),
    path("api/ai/interview/text/", InterviewText.as_view()),
    path("api/ai/interview/transcribe/", InterviewTranscription.as_view()),
    path("api/ai/interview/report/", InterviewReport.as_view()),
    path("api/", include(router.urls)),
]

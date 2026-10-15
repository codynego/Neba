from django.urls import path

from .views import AcademicIntelligenceView, AttendanceView, SchoolMemberDetailView, SchoolRosterView, SchoolSetupView, SchoolWorkspaceView, StudentDetailView, StudentIntelligenceView, TeachingAssistantView, TeachingWorkView

urlpatterns = [
    path("setup/", SchoolSetupView.as_view()),
    path("workspace/", SchoolWorkspaceView.as_view()),
    path("roster/", SchoolRosterView.as_view()),
    path("attendance/", AttendanceView.as_view()),
    path("students/<uuid:public_id>/", StudentDetailView.as_view()),
    path("students/<uuid:public_id>/intelligence/", StudentIntelligenceView.as_view()),
    path("members/<uuid:public_id>/", SchoolMemberDetailView.as_view()),
    path("teaching-work/", TeachingWorkView.as_view()),
    path("teaching-assistant/", TeachingAssistantView.as_view()),
    path("intelligence/", AcademicIntelligenceView.as_view()),
]

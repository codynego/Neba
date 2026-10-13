from django.urls import path

from .views import SchoolRosterView, SchoolSetupView, SchoolWorkspaceView

urlpatterns = [
    path("setup/", SchoolSetupView.as_view()),
    path("workspace/", SchoolWorkspaceView.as_view()),
    path("roster/", SchoolRosterView.as_view()),
]

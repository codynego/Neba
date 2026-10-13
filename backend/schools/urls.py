from django.urls import path

from .views import SchoolSetupView, SchoolWorkspaceView

urlpatterns = [
    path("setup/", SchoolSetupView.as_view()),
    path("workspace/", SchoolWorkspaceView.as_view()),
]

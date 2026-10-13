from django.urls import path

from .views import SchoolSetupView

urlpatterns = [
    path("setup/", SchoolSetupView.as_view()),
]

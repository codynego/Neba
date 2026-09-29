from django.urls import path
from .views import LoginView, LogoutView, MeView, RegisterView, ProfilePhotoUpload, ProfilePhotoConfirm
from . import safety_views as safety
urlpatterns = [
    path("register/", RegisterView.as_view()),
    path("login/", LoginView.as_view()),
    path("logout/", LogoutView.as_view()),
    path("me/", MeView.as_view()),
    path("profile-photo/upload/", ProfilePhotoUpload.as_view()),
    path("profile-photo/confirm/", ProfilePhotoConfirm.as_view()),
    path("verification/", safety.VerificationStatus.as_view()),
    path("verification/phone/send/", safety.SendPhoneCode.as_view()),
    path("verification/phone/check/", safety.CheckPhoneCode.as_view()),
    path("verification/capture/", safety.StartCapture.as_view()),
    path("verification/identity/", safety.SubmitIdentity.as_view()),
    path("verification/withdraw/", safety.WithdrawIdentity.as_view()),
    path("verification/<int:pk>/evidence/<str:kind>/", safety.EvidenceImage.as_view()),
    path("members/<int:pk>/photo/", safety.ProfilePhoto.as_view()),
    path("members/<int:pk>/", safety.PublicProfile.as_view()),
    path("blocks/", safety.Blocks.as_view()),
    path("reports/", safety.Reports.as_view()),
    path("reviews/", safety.Reviews.as_view()),
]

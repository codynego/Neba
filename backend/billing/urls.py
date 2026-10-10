from django.urls import path

from .views import BillingStatusView, CheckoutView, PlansView, PortalView, WebhookView

urlpatterns = [
    path("plans/", PlansView.as_view()),
    path("status/", BillingStatusView.as_view()),
    path("checkout/", CheckoutView.as_view()),
    path("portal/", PortalView.as_view()),
    path("webhook/", WebhookView.as_view()),
]

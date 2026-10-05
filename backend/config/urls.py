from django.contrib import admin
from django.db import connection
from django.http import JsonResponse
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from locations.views import CityViewSet
from tasks.product_api import TaskViewSet
from offers.product_api import OfferViewSet
from bookings.product_api import ApplicationViewSet
from accounts.notification_views import NotificationViewSet
from opportunities.views import OpportunityApplicationViewSet, OpportunityViewSet, OrganizationOpportunityViewSet, SavedOpportunityViewSet

router = DefaultRouter()
router.register("cities", CityViewSet, basename="city")
router.register("tasks", TaskViewSet, basename="task")
router.register("offers", OfferViewSet, basename="offer")
router.register("applications", ApplicationViewSet, basename="application")
router.register("notifications", NotificationViewSet, basename="notification")
router.register("opportunities", OpportunityViewSet, basename="opportunity")
router.register("saved-opportunities", SavedOpportunityViewSet, basename="saved-opportunity")
router.register("opportunity-applications", OpportunityApplicationViewSet, basename="opportunity-application")
router.register("organization/opportunities", OrganizationOpportunityViewSet, basename="organization-opportunity")


def health(request):
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
        cursor.fetchone()
    return JsonResponse({"status": "ok"})

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health),
    path("api/auth/", include("accounts.urls")),
    path("api/", include(router.urls)),
]

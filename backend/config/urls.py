from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from locations.views import CityViewSet
from tasks.views import TaskViewSet
from offers.views import OfferViewSet
from bookings.views import ApplicationViewSet

router = DefaultRouter()
router.register("cities", CityViewSet, basename="city")
router.register("tasks", TaskViewSet, basename="task")
router.register("offers", OfferViewSet, basename="offer")
router.register("applications", ApplicationViewSet, basename="application")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/", include(router.urls)),
]

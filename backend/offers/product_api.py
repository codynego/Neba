from django.db import transaction
from django.db.models import Avg, Q, F
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, PermissionDenied
from accounts.models import User
from accounts.trust import require_profile, require_helper, are_blocked
from accounts.notifications import notify
from accounts import r2
from accounts.listing_photos import upload_ticket, PhotoUploadsUnavailable
from tasks.models import Task
from tasks.product_api import TaskSerializer
from .models import Offer
from .views import OfferViewSet as BaseOfferViewSet, OfferSerializer as BaseOfferSerializer

class OfferSerializer(BaseOfferSerializer):
    from rest_framework import serializers
    provider_availability = serializers.CharField(source="provider.availability", read_only=True)
    provider_neighborhood = serializers.CharField(source="provider.neighborhood", read_only=True)
    class Meta(BaseOfferSerializer.Meta):
        fields = BaseOfferSerializer.Meta.fields + ("provider_availability", "provider_neighborhood")

class OfferViewSet(BaseOfferViewSet):
    serializer_class = OfferSerializer
    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list" or self.request.query_params.get("mine") == "true": return queryset
        for key, lookup in (("category", "category"), ("availability", "provider__availability"), ("neighborhood", "provider__neighborhood__icontains")):
            value = self.request.query_params.get(key, "").strip()
            if value: queryset = queryset.filter(**{lookup: value})
        search = self.request.query_params.get("search", "").strip()
        if search: queryset = queryset.filter(Q(title__icontains=search) | Q(description__icontains=search) | Q(provider__display_name__icontains=search))
        sort = self.request.query_params.get("sort", "newest")
        if sort == "top_rated": return queryset.annotate(rating=Avg("provider__reviews_received__rating", filter=Q(provider__reviews_received__visible=True, provider__reviews_received__reviewer__is_active=True))).order_by(F("rating").desc(nulls_last=True), "-created_at")
        orders = {"newest": "-created_at", "price_low": "starting_price", "price_high": "-starting_price"}
        if sort not in orders: raise ValidationError("Unknown helper sorting option.")
        return queryset.order_by(orders[sort], "-id")
    @action(detail=False, methods=["post"], url_path="photo-upload")
    def photo_upload(self, request):
        return Response(upload_ticket(request.user, "offer-photos", request.data))
    @action(detail=True, methods=["get"], url_path=r"photos/(?P<photo_index>[0-9]+)")
    def photo(self, request, pk=None, photo_index=None):
        offer = self.get_object()
        try:
            key = (offer.photo_keys or [])[int(photo_index)]
        except (IndexError, TypeError, ValueError):
            return Response(status=404)
        if not r2.configured():
            raise PhotoUploadsUnavailable()
        return Response({"url": r2.download_url(key)})
    @action(detail=True, methods=["post"])
    def request(self, request, pk=None):
        offer = self.get_object(); require_profile(request.user)
        if offer.provider_id == request.user.pk: raise ValidationError("You cannot request your own offer.")
        serializer = TaskSerializer(data=request.data, context={"request": request}); serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            provider = User.objects.select_for_update().get(pk=offer.provider_id)
            offer = Offer.objects.select_for_update().get(pk=offer.pk)
            require_helper(provider)
            if not offer.active or provider.availability == "unavailable": raise ValidationError("This helper is not taking requests for this offer.")
            if are_blocked(request.user, provider): raise PermissionDenied("This helper is unavailable.")
            if Task.objects.filter(requester=request.user, requested_offer=offer, is_private=True, status="open").exists(): raise ValidationError("You already have a pending request for this offer. Manage it in Activity.")
            task = serializer.save(requester=request.user, target_helper=provider, requested_offer=offer, is_private=True, category=offer.category)
            if task.moderation_status == Task.ModerationStatus.APPROVED:
                notify(provider, "Someone requested your skills", f"/tasks/{task.public_id}", task.title)
        return Response(TaskSerializer(task, context={"request": request}).data, status=201)

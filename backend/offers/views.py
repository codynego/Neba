from rest_framework import serializers, viewsets
from rest_framework.response import Response
from rest_framework import permissions
from django.db.models import Q
from .models import Offer
from accounts.trust import require_helper, blocked_user_ids
from accounts.safety_views import trust_summary

class OfferSerializer(serializers.ModelSerializer):
    photos = serializers.ListField(child=serializers.CharField(max_length=255), source="photo_keys", write_only=True, required=False)
    photo_count = serializers.SerializerMethodField()
    provider_trust = serializers.SerializerMethodField()
    def get_provider_trust(self, offer):
        return trust_summary(offer.provider)
    def get_photo_count(self, offer):
        return len(offer.photo_keys or [])
    provider_name = serializers.CharField(source="provider.display_name", read_only=True)
    provider_username = serializers.CharField(source="provider.username", read_only=True)
    provider_public_id = serializers.UUIDField(source="provider.public_id", read_only=True)
    class Meta:
        model = Offer
        fields = ("id", "public_id", "provider", "provider_public_id", "provider_username", "provider_name", "title", "description", "photos", "photo_count", "category",
                  "city", "state", "starting_price", "active", "created_at", "provider_trust")
        read_only_fields = ("id", "public_id", "provider", "provider_name", "created_at")
    def validate_starting_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("Enter an amount greater than zero.")
        return value
    def validate(self, attrs):
        if "photo_keys" in attrs:
            from accounts.listing_photos import validate_photo_keys
            attrs["photo_keys"] = validate_photo_keys(self.context["request"].user, "offer-photos", attrs["photo_keys"])
        return attrs

class OfferViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OfferSerializer
    def get_object(self):
        identifier = self.kwargs.get(self.lookup_url_kwarg or self.lookup_field)
        queryset = self.filter_queryset(self.get_queryset())
        try:
            import uuid
            lookup = {"public_id": uuid.UUID(str(identifier))}
        except (ValueError, TypeError, AttributeError):
            lookup = {"pk": identifier}
        obj = queryset.filter(**lookup).first()
        if obj is None:
            from rest_framework.exceptions import NotFound
            raise NotFound()
        self.check_object_permissions(self.request, obj)
        return obj
    def get_queryset(self):
        queryset = Offer.objects.select_related("provider")
        if self.request.query_params.get("mine") == "true":
            queryset = queryset.filter(provider=self.request.user) if self.request.user.is_authenticated else queryset.none()
            search = self.request.query_params.get("search", "").strip()
            if search:
                queryset = queryset.filter(Q(title__icontains=search) | Q(description__icontains=search) | Q(city__icontains=search))
            return queryset
        queryset = queryset.filter(provider__is_active=True).exclude(provider__phone__isnull=True).exclude(provider__profile_photo_key="").exclude(provider__address="").exclude(provider__neighborhood="").exclude(provider__city="").exclude(provider__state="").exclude(provider_id__in=blocked_user_ids(self.request.user))
        if self.action == "list":
            queryset = queryset.filter(active=True)
        city = self.request.query_params.get("city", "").strip()
        if city:
            queryset = queryset.filter(city__iexact=city)
        return queryset
    def perform_create(self, serializer):
        require_helper(self.request.user)
        serializer.save(provider=self.request.user)
    def update(self, request, *args, **kwargs):
        if self.get_object().provider_id != request.user.id:
            return Response({"detail": "Only the provider can edit this offer."}, status=403)
        if request.data.get("active") is not False:
            require_helper(request.user)
        return super().update(request, *args, **kwargs)
    def destroy(self, request, *args, **kwargs):
        offer = self.get_object()
        if offer.provider_id != request.user.id:
            return Response({"detail": "Only the provider can close this offer."}, status=403)
        offer.active = False
        offer.save(update_fields=("active",))
        return Response(status=204)


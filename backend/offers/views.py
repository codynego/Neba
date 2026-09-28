from rest_framework import serializers, viewsets
from rest_framework.response import Response
from .models import Offer

class OfferSerializer(serializers.ModelSerializer):
    provider_name = serializers.CharField(source="provider.display_name", read_only=True)
    class Meta:
        model = Offer
        fields = ("id", "provider", "provider_name", "title", "description", "category",
                  "city", "state", "starting_price", "active", "created_at")
        read_only_fields = ("id", "provider", "provider_name", "created_at")
    def validate_starting_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("Enter an amount greater than zero.")
        return value

class OfferViewSet(viewsets.ModelViewSet):
    serializer_class = OfferSerializer
    def get_queryset(self):
        queryset = Offer.objects.select_related("provider")
        if self.request.query_params.get("mine") == "true":
            return queryset.filter(provider=self.request.user) if self.request.user.is_authenticated else queryset.none()
        if self.action == "list":
            queryset = queryset.filter(active=True)
        city = self.request.query_params.get("city", "").strip()
        if city:
            queryset = queryset.filter(city__iexact=city)
        return queryset
    def perform_create(self, serializer):
        serializer.save(provider=self.request.user)
    def update(self, request, *args, **kwargs):
        if self.get_object().provider_id != request.user.id:
            return Response({"detail": "Only the provider can edit this offer."}, status=403)
        return super().update(request, *args, **kwargs)
    def destroy(self, request, *args, **kwargs):
        offer = self.get_object()
        if offer.provider_id != request.user.id:
            return Response({"detail": "Only the provider can close this offer."}, status=403)
        offer.active = False
        offer.save(update_fields=("active",))
        return Response(status=204)


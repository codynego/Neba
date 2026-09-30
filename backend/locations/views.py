from rest_framework import mixins, permissions, serializers, viewsets
from .models import City
from config.api_cache import CachedListMixin, cache_ttl
class CitySerializer(serializers.ModelSerializer):
    class Meta:
        model = City
        fields = ("id", "name", "state", "country")
class CityViewSet(CachedListMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = City.objects.all()
    serializer_class = CitySerializer
    permission_classes = [permissions.AllowAny]
    cache_namespace = "cities"
    cache_timeout = cache_ttl("cities", 3600)
    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get("search", "").strip()
        return queryset.filter(name__icontains=search) if search else queryset


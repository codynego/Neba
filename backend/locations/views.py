from rest_framework import mixins, permissions, serializers, viewsets
from .models import City
class CitySerializer(serializers.ModelSerializer):
    class Meta:
        model = City
        fields = ("id", "name", "state", "country")
class CityViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = City.objects.all()
    serializer_class = CitySerializer
    permission_classes = [permissions.AllowAny]
    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get("search", "").strip()
        return queryset.filter(name__icontains=search) if search else queryset


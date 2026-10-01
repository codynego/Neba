from django.utils import timezone
from rest_framework import permissions, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Notification, PushSubscription

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ("id", "title", "detail", "path", "read_at", "created_at")


class PushSubscriptionInput(serializers.Serializer):
    endpoint = serializers.URLField(max_length=500)
    keys = serializers.DictField()


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = NotificationSerializer
    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)
    @action(detail=False, methods=["get"])
    def unread(self, request):
        unread = self.get_queryset().filter(read_at__isnull=True)
        message_count = unread.filter(title__in=("New task message", "New candidate message")).count()
        return Response({"count": unread.count(), "message_count": message_count, "activity_count": unread.count() - message_count})
    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        item = self.get_object()
        if not item.read_at:
            item.read_at = timezone.now(); item.save(update_fields=("read_at",))
        return Response(self.get_serializer(item).data)
    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request):
        self.get_queryset().filter(read_at__isnull=True).update(read_at=timezone.now())
        return Response(status=204)

    @action(detail=False, methods=["get"], url_path="push-config")
    def push_config(self, request):
        from .push import configured
        from django.conf import settings
        return Response({"public_key": settings.WEB_PUSH_VAPID_PUBLIC_KEY if configured() else ""})

    @action(detail=False, methods=["post", "delete"], url_path="push-subscription")
    def push_subscription(self, request):
        if request.method == "DELETE":
            endpoint = serializers.URLField(max_length=500).run_validation(request.data.get("endpoint"))
            PushSubscription.objects.filter(user=request.user, endpoint=endpoint).delete()
            return Response(status=204)
        serializer = PushSubscriptionInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        keys = serializer.validated_data["keys"]
        p256dh = serializers.CharField(max_length=200).run_validation(keys.get("p256dh"))
        auth = serializers.CharField(max_length=200).run_validation(keys.get("auth"))
        PushSubscription.objects.update_or_create(
            endpoint=serializer.validated_data["endpoint"],
            defaults={"user": request.user, "p256dh": p256dh, "auth": auth, "user_agent": request.headers.get("User-Agent", "")[:300]},
        )
        return Response(status=204)

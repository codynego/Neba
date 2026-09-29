from django.db.models import Count
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework import permissions
from rest_framework.response import Response
from .models import Task
from accounts.trust import require_profile, blocked_user_ids
from accounts.safety_views import trust_summary
from .policy import apply_task_policy

class TaskSerializer(serializers.ModelSerializer):
    policy_confirmed = serializers.BooleanField(write_only=True, required=False)
    requester_trust = serializers.SerializerMethodField()
    def get_requester_trust(self, task):
        return trust_summary(task.requester)
    requester_name = serializers.CharField(source="requester.display_name", read_only=True)
    application_count = serializers.IntegerField(read_only=True)
    class Meta:
        model = Task
        fields = ("id", "requester", "requester_name", "title", "description", "category", "city",
                  "state", "neighborhood", "reward_amount", "reward_note", "scheduled_for",
                  "involves_item", "item_type", "item_value", "item_already_paid", "risk_level",
                  "moderation_status", "moderation_reason", "policy_version", "policy_confirmed",
                  "status", "application_count", "created_at", "updated_at", "requester_trust")
        read_only_fields = ("id", "requester", "requester_name", "risk_level", "moderation_status", "moderation_reason", "policy_version", "status", "application_count", "created_at", "updated_at")
    def validate_reward_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Enter an amount greater than zero.")
        return value
    def validate(self, attrs):
        confirmed = attrs.pop("policy_confirmed", False)
        if self.instance is None and not confirmed:
            raise serializers.ValidationError({"policy_confirmed": "Confirm that this task follows Neba’s task policy."})
        return apply_task_policy(attrs, self.instance)

class TaskViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = TaskSerializer
    def get_queryset(self):
        queryset = Task.objects.select_related("requester").annotate(application_count=Count("applications")).order_by("-created_at")
        if self.request.query_params.get("mine") == "true":
            return queryset.filter(requester=self.request.user) if self.request.user.is_authenticated else queryset.none()
        queryset = queryset.filter(requester__is_active=True).exclude(requester_id__in=blocked_user_ids(self.request.user))
        if self.action == "list":
            queryset = queryset.filter(status=Task.Status.OPEN)
        city = self.request.query_params.get("city", "").strip()
        category = self.request.query_params.get("category", "").strip()
        search = self.request.query_params.get("search", "").strip()
        if city:
            queryset = queryset.filter(city__icontains=city)
        if category:
            queryset = queryset.filter(category=category)
        if search:
            queryset = queryset.filter(title__icontains=search)
        return queryset
    def perform_create(self, serializer):
        require_profile(self.request.user)
        serializer.save(requester=self.request.user)
    def update(self, request, *args, **kwargs):
        task = self.get_object()
        if task.requester_id != request.user.id or task.status != Task.Status.OPEN:
            return Response({"detail": "Only the requester can edit an open task."}, status=403)
        return super().update(request, *args, **kwargs)
    def destroy(self, request, *args, **kwargs):
        return Response({"detail": "Cancel the task instead of deleting it."}, status=405)
    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        task = self.get_object()
        if task.requester_id != request.user.id or task.status != Task.Status.ASSIGNED:
            return Response({"detail": "Only the requester can complete an assigned task."}, status=403)
        task.status = Task.Status.COMPLETED
        task.save(update_fields=("status", "updated_at"))
        return Response(self.get_serializer(task).data)
    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        task = self.get_object()
        if task.requester_id != request.user.id or task.status != Task.Status.OPEN:
            return Response({"detail": "Only the requester can cancel an open task."}, status=403)
        task.status = Task.Status.CANCELLED
        task.save(update_fields=("status", "updated_at"))
        return Response(self.get_serializer(task).data)


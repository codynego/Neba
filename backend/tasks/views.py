from django.conf import settings
from django.db.models import Count
from rest_framework import serializers, viewsets
from django.db import transaction, models
from rest_framework.decorators import action
from rest_framework import permissions
from rest_framework.response import Response
from .models import Task
from accounts.trust import require_profile, blocked_user_ids
from accounts.safety_views import trust_summary
from config.api_cache import CachedListMixin, cache_ttl
from .policy import apply_task_policy
from accounts.emailing import safely, send_nearby_task_emails

class TaskSerializer(serializers.ModelSerializer):
    photos = serializers.ListField(child=serializers.CharField(max_length=255), source="photo_keys", write_only=True, required=False)
    photo_count = serializers.SerializerMethodField()
    policy_confirmed = serializers.BooleanField(write_only=True, required=False)
    requester_trust = serializers.SerializerMethodField()
    def get_requester_trust(self, task):
        return trust_summary(task.requester)
    def get_photo_count(self, task):
        return len(task.photo_keys or [])
    requester_name = serializers.CharField(source="requester.display_name", read_only=True)
    requester_username = serializers.CharField(source="requester.username", read_only=True)
    requester_public_id = serializers.UUIDField(source="requester.public_id", read_only=True)
    application_count = serializers.IntegerField(read_only=True)
    accepted_count = serializers.IntegerField(read_only=True, default=0)
    class Meta:
        model = Task
        fields = ("id", "public_id", "requester", "requester_name", "requester_username", "requester_public_id", "title", "description", "photos", "photo_count", "category", "city",
                  "state", "neighborhood", "reward_type", "reward_amount", "reward_note", "scheduled_for", "is_recurring", "helpers_needed", "accepted_count",
                  "involves_item", "item_type", "item_value", "item_already_paid", "risk_level",
                  "moderation_status", "moderation_reason", "policy_version", "policy_confirmed",
                  "status", "application_count", "created_at", "updated_at", "requester_trust")
        read_only_fields = ("id", "public_id", "requester", "requester_name", "risk_level", "moderation_status", "moderation_reason", "policy_version", "status", "application_count", "created_at", "updated_at")
    def validate_reward_amount(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError("Enter an amount greater than zero.")
        return value
    def validate_helpers_needed(self, value):
        if value != 1:
            raise serializers.ValidationError("Tasks currently support one helper only.")
        return value
    def validate(self, attrs):
        confirmed = attrs.pop("policy_confirmed", False)
        if self.instance is None and not confirmed:
            raise serializers.ValidationError({"policy_confirmed": "Confirm that this task follows Neba’s task policy."})
        if attrs.get("is_recurring", getattr(self.instance, "is_recurring", False)):
            raise serializers.ValidationError({"is_recurring": "Recurring tasks are temporarily unavailable."})
        if attrs.get("helpers_needed", getattr(self.instance, "helpers_needed", 1)) != 1:
            raise serializers.ValidationError({"helpers_needed": "Tasks currently support one helper only."})
        reward_type = attrs.get("reward_type", getattr(self.instance, "reward_type", Task.RewardType.MONEY))
        reward_amount = attrs.get("reward_amount", getattr(self.instance, "reward_amount", None))
        reward_note = attrs.get("reward_note", getattr(self.instance, "reward_note", "")).strip()
        if reward_type == Task.RewardType.MONEY and reward_amount is None:
            raise serializers.ValidationError({"reward_amount": "Enter the money reward."})
        if reward_type != Task.RewardType.MONEY and not reward_note:
            raise serializers.ValidationError({"reward_note": "Describe what you will give in return."})
        if reward_type not in (Task.RewardType.MONEY, Task.RewardType.COMBINATION):
            attrs["reward_amount"] = None
        if "photo_keys" in attrs:
            from accounts.listing_photos import validate_photo_keys
            attrs["photo_keys"] = validate_photo_keys(self.context["request"].user, "task-photos", attrs["photo_keys"])
        return apply_task_policy(attrs, self.instance)

class TaskViewSet(CachedListMixin, viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = TaskSerializer
    cache_namespace = "tasks"
    cache_timeout = cache_ttl("tasks", 60)
    def should_cache_list(self):
        params = self.request.query_params
        return params.get("mine") != "true" and params.get("bookings") != "true" and params.get("invitations") != "true"
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
        queryset = Task.objects.select_related("requester").annotate(application_count=Count("applications", distinct=True), accepted_count=Count("applications", filter=models.Q(applications__status="accepted"), distinct=True)).order_by("-created_at")
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
        if not settings.LEGACY_MARKETPLACE_ENABLED:
            raise serializers.ValidationError("Task posting has been retired while Getneba moves to opportunities.")
        require_profile(self.request.user)
        task = serializer.save(requester=self.request.user)
        if not task.is_private and task.moderation_status == Task.ModerationStatus.APPROVED:
            transaction.on_commit(lambda: safely(send_nearby_task_emails, task))
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


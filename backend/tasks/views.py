from django.db.models import Count
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Task

class TaskSerializer(serializers.ModelSerializer):
    requester_name = serializers.CharField(source="requester.display_name", read_only=True)
    application_count = serializers.IntegerField(read_only=True)
    class Meta:
        model = Task
        fields = ("id", "requester", "requester_name", "title", "description", "category", "city",
                  "state", "neighborhood", "reward_amount", "reward_note", "scheduled_for",
                  "status", "application_count", "created_at", "updated_at")
        read_only_fields = ("id", "requester", "requester_name", "status", "application_count", "created_at", "updated_at")
    def validate_reward_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Enter an amount greater than zero.")
        return value

class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    def get_queryset(self):
        queryset = Task.objects.select_related("requester").annotate(application_count=Count("applications")).order_by("-created_at")
        if self.request.query_params.get("mine") == "true":
            return queryset.filter(requester=self.request.user) if self.request.user.is_authenticated else queryset.none()
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


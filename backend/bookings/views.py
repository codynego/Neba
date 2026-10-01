from django.db import transaction
from rest_framework import permissions, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404
from django.db.models import Q
from accounts.trust import require_helper, require_profile, are_blocked
from accounts.safety_views import trust_summary
from tasks.models import Task
from .models import Application

class ApplicationSerializer(serializers.ModelSerializer):
    applicant_trust = serializers.SerializerMethodField()
    def get_applicant_trust(self, application):
        return trust_summary(application.applicant)
    applicant_name = serializers.CharField(source="applicant.display_name", read_only=True)
    applicant_username = serializers.CharField(source="applicant.username", read_only=True)
    applicant_public_id = serializers.UUIDField(source="applicant.public_id", read_only=True)
    task_title = serializers.CharField(source="task.title", read_only=True)
    task_public_id = serializers.UUIDField(source="task.public_id", read_only=True)
    class Meta:
        model = Application
        fields = ("id", "task", "task_public_id", "task_title", "applicant", "applicant_public_id", "applicant_username", "applicant_name", "message", "booking_note", "contact_phone", "status", "created_at", "applicant_trust")
        read_only_fields = ("id", "task_title", "applicant", "applicant_name", "booking_note", "status", "created_at")
        extra_kwargs = {"contact_phone": {"read_only": True}}
    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Share contact only after acceptance, and never across a block or suspension.
        if instance.status != Application.Status.ACCEPTED or not instance.applicant.is_active or are_blocked(instance.applicant, instance.task.requester):
            data["contact_phone"] = ""
        return data
    def validate_task(self, task):
        user = self.context["request"].user
        require_helper(user)
        if task.moderation_status != Task.ModerationStatus.APPROVED:
            raise PermissionDenied("This task is awaiting review and cannot receive applications.")
        if not task.requester.is_active or are_blocked(user, task.requester):
            raise PermissionDenied("This task is unavailable.")
        if task.requester_id == user.id:
            raise serializers.ValidationError("You cannot apply to your own task.")
        if task.status != Task.Status.OPEN:
            raise serializers.ValidationError("This task is no longer open.")
        if Application.objects.filter(task=task, applicant=user).exists():
            raise serializers.ValidationError("You have already applied to this task.")
        return task

class ApplicationViewSet(viewsets.ModelViewSet):
    serializer_class = ApplicationSerializer
    http_method_names = ["get", "post", "head", "options"]
    permission_classes = [permissions.IsAuthenticated]
    def get_queryset(self):
        queryset = Application.objects.select_related("task", "applicant")
        user = self.request.user
        if self.action != "list":
            queryset = queryset.filter(Q(task__requester=user) | Q(applicant=user))
        elif self.request.query_params.get("received") == "true":
            queryset = queryset.filter(task__requester=user)
        else:
            queryset = queryset.filter(applicant=user)
        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(Q(task__title__icontains=search) | Q(applicant__display_name__icontains=search) |
                Q(applicant__username__icontains=search) | Q(message__icontains=search))
        return queryset
    def perform_create(self, serializer):
        require_helper(self.request.user)
        serializer.save(applicant=self.request.user, contact_phone=self.request.user.phone)
    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        with transaction.atomic():
            application = get_object_or_404(Application.objects.select_related("task", "applicant").select_for_update(),
                pk=pk, task__requester=request.user
            )
            require_profile(request.user)
            require_helper(application.applicant)
            if are_blocked(request.user, application.applicant):
                raise PermissionDenied("You cannot accept work from a blocked member.")
            task = Task.objects.select_for_update().get(pk=application.task_id)
            if task.status != Task.Status.OPEN or application.status != Application.Status.PENDING:
                return Response({"detail": "This application can no longer be accepted."}, status=400)
            task.status = Task.Status.ASSIGNED
            task.save(update_fields=("status", "updated_at"))
            application.status = Application.Status.ACCEPTED
            application.save(update_fields=("status",))
            Application.objects.filter(task=task, status=Application.Status.PENDING).exclude(pk=pk).update(
                status=Application.Status.DECLINED
            )
        return Response(self.get_serializer(application).data)




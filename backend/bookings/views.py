from django.db import transaction
from rest_framework import permissions, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from tasks.models import Task
from .models import Application

class ApplicationSerializer(serializers.ModelSerializer):
    applicant_name = serializers.CharField(source="applicant.display_name", read_only=True)
    task_title = serializers.CharField(source="task.title", read_only=True)
    class Meta:
        model = Application
        fields = ("id", "task", "task_title", "applicant", "applicant_name", "message", "contact_phone", "status", "created_at")
        read_only_fields = ("id", "task_title", "applicant", "applicant_name", "status", "created_at")
        extra_kwargs = {"contact_phone": {"required": True, "allow_blank": False}}
    def validate_task(self, task):
        user = self.context["request"].user
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
        if self.request.query_params.get("received") == "true":
            return queryset.filter(task__requester=user)
        return queryset.filter(applicant=user)
    def perform_create(self, serializer):
        serializer.save(applicant=self.request.user)
    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        with transaction.atomic():
            application = Application.objects.select_related("task").select_for_update().get(
                pk=pk, task__requester=request.user
            )
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




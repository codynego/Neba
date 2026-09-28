from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError, PermissionDenied
from rest_framework.response import Response
from accounts.trust import require_helper, are_blocked
from accounts.notifications import notify
from tasks.models import Task
from .models import Application
from .views import ApplicationViewSet as BaseApplicationViewSet

class ApplicationViewSet(BaseApplicationViewSet):
    @transaction.atomic
    def perform_create(self, serializer):
        task = Task.objects.select_for_update().get(pk=serializer.validated_data["task"].pk)
        require_helper(self.request.user)
        if task.status != "open" or task.is_private or not task.requester.is_active or are_blocked(self.request.user, task.requester): raise ValidationError("This task is not accepting applications.")
        if self.request.user.availability == "unavailable": raise ValidationError("Update your availability before applying.")
        if task.applications.filter(applicant=self.request.user).exists(): raise ValidationError("You already applied to this task.")
        serializer.save(applicant=self.request.user, contact_phone=self.request.user.phone)
        notify(task.requester, "New task application", f"/tasks/{task.pk}", self.request.user.display_name or self.request.user.username)
    @action(detail=True, methods=["post"])
    @transaction.atomic
    def accept(self, request, pk=None):
        # Always acquire the task lock first, matching every other workflow transition.
        candidate = get_object_or_404(Application, pk=pk, task__requester=request.user)
        task = Task.objects.select_for_update().get(pk=candidate.task_id)
        if task.is_private: raise ValidationError("The requested helper must respond to the invitation.")
        if candidate.applicant.availability == "unavailable": raise ValidationError("This helper is not currently taking work.")
        response = super().accept(request, pk)
        if response.status_code == 200:
            notify(candidate.applicant, "Your application was accepted", f"/tasks/{task.pk}", task.title)
            for other in task.applications.filter(status="declined").select_related("applicant"):
                notify(other.applicant, "A helper was selected", "/activity", task.title)
        return response
    @action(detail=True, methods=["post"])
    def withdraw(self, request, pk=None):
        candidate = get_object_or_404(Application, pk=pk, applicant=request.user)
        with transaction.atomic():
            task = Task.objects.select_for_update().get(pk=candidate.task_id)
            application = Application.objects.select_for_update().get(pk=candidate.pk)
            if application.status != "pending" or task.status != "open": raise ValidationError("An accepted booking needs a cancellation request, not withdrawal.")
            application.status = "withdrawn"; application.save(update_fields=("status",))
            notify(task.requester, "Application withdrawn", f"/tasks/{task.pk}", request.user.display_name)
        return Response(self.get_serializer(application).data)
    @action(detail=True, methods=["post"])
    def decline(self, request, pk=None):
        candidate = get_object_or_404(Application, pk=pk, task__requester=request.user)
        with transaction.atomic():
            task = Task.objects.select_for_update().get(pk=candidate.task_id)
            application = Application.objects.select_for_update().get(pk=candidate.pk)
            if application.status != "pending" or task.status != "open": raise ValidationError("Only a pending application can be declined.")
            application.status = "declined"; application.save(update_fields=("status",))
            notify(application.applicant, "Application declined", "/activity", task.title)
        return Response(self.get_serializer(application).data)

from django.conf import settings
from django.db import models
from tasks.models import Task

class Application(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        DECLINED = "declined", "Declined"
        WITHDRAWN = "withdrawn", "Withdrawn"
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="applications")
    applicant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="applications")
    message = models.TextField(max_length=800)
    contact_phone = models.CharField(max_length=25, default="")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering = ("-created_at",)
        constraints = [models.UniqueConstraint(fields=("task", "applicant"), name="unique_task_application")]
    def __str__(self):
        return f"{self.applicant}  {self.task}"

class TaskMessage(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    text = models.TextField(max_length=2000)
    client_id = models.UUIDField()
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering = ("id",)
        constraints = [models.UniqueConstraint(fields=("task", "sender", "client_id"), name="unique_message_retry")]

class TaskChange(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="changes")
    proposer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    kind = models.CharField(max_length=20, choices=[("complete", "Complete"), ("cancel", "Cancel"), ("reschedule", "Reschedule")])
    reason = models.CharField(max_length=1000, blank=True)
    scheduled_for = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=16, default="pending", choices=[("pending", "Pending"), ("accepted", "Accepted"), ("declined", "Declined"), ("withdrawn", "Withdrawn")])
    decided_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="task_change_decisions")
    created_at = models.DateTimeField(auto_now_add=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    class Meta:
        ordering = ("-id",)
        constraints = [models.UniqueConstraint(fields=("task",), condition=models.Q(status="pending"), name="one_pending_task_change")]

class TaskIssue(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="issues")
    reporter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    kind = models.CharField(max_length=16, choices=[("no_show", "No-show"), ("dispute", "Dispute")])
    details = models.TextField(max_length=2000)
    status = models.CharField(max_length=16, default="open", choices=[("open", "Open"), ("reviewing", "Under review"), ("resolved", "Resolved")])
    outcome = models.CharField(max_length=16, blank=True, choices=[("resume", "Resume work"), ("cancel", "Cancel task"), ("complete", "Complete task")])
    resolution = models.TextField(max_length=1000, blank=True)
    staff_note = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="booking_issue_reviews")
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    class Meta:
        ordering = ("-id",)
        constraints = [models.UniqueConstraint(fields=("task",), condition=models.Q(status__in=("open", "reviewing")), name="one_active_task_issue")]




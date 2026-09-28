from django.conf import settings
from django.db import models
from tasks.models import Task

class Application(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        DECLINED = "declined", "Declined"
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




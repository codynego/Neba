from django.conf import settings
from django.db import models

class Task(models.Model):
    class Status(models.TextChoices):
        OPEN = "open", "Open"
        ASSIGNED = "assigned", "Assigned"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"
    class Category(models.TextChoices):
        ERRANDS = "errands", "Errands"
        MOVING = "moving", "Moving & assembly"
        EVENTS = "events", "Event help"
        TUTORING = "tutoring", "Tutoring"
        TECH = "tech", "Tech help"
        OTHER = "other", "Other"
    requester = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="tasks")
    title = models.CharField(max_length=140)
    description = models.TextField()
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.OTHER)
    city = models.CharField(max_length=120)
    state = models.CharField(max_length=120)
    neighborhood = models.CharField(max_length=120, blank=True)
    reward_amount = models.DecimalField(max_digits=10, decimal_places=2)
    reward_note = models.CharField(max_length=160, blank=True)
    scheduled_for = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        ordering = ("-created_at",)
    def __str__(self):
        return self.title


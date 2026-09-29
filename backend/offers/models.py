from django.conf import settings
from django.db import models
import uuid
from tasks.models import Task

class Offer(models.Model):
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    provider = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="offers")
    title = models.CharField(max_length=140)
    description = models.TextField()
    category = models.CharField(max_length=20, choices=Task.Category.choices, default=Task.Category.OTHER)
    city = models.CharField(max_length=120)
    state = models.CharField(max_length=120)
    starting_price = models.DecimalField(max_digits=10, decimal_places=2)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering = ("-created_at",)
    def __str__(self):
        return self.title


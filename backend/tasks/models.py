from django.conf import settings
from django.db import models
import uuid

class Task(models.Model):
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
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
    class RiskLevel(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
    class ItemType(models.TextChoices):
        DOCUMENTS = "documents", "Documents"
        FOOD = "food", "Food or groceries"
        CLOTHING = "clothing", "Clothing"
        ELECTRONICS = "electronics", "Electronics"
        FURNITURE = "furniture", "Furniture"
        OTHER = "other", "Other"
    class RewardType(models.TextChoices):
        MONEY = "money", "Money"
        FOOD = "food", "Food"
        ITEM = "item", "Item or goods"
        SKILL = "skill", "Skill or knowledge"
        SERVICE = "service", "Service"
        EXCHANGE = "exchange", "Exchange or barter"
        COMBINATION = "combination", "Combination"
        OTHER = "other", "Other"
    class ModerationStatus(models.TextChoices):
        APPROVED = "approved", "Approved"
        HELD = "held", "Needs review"
        REJECTED = "rejected", "Rejected"
    requester = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="tasks")
    target_helper = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="direct_requests")
    requested_offer = models.ForeignKey("offers.Offer", on_delete=models.SET_NULL, null=True, blank=True)
    is_private = models.BooleanField(default=False)
    title = models.CharField(max_length=140)
    description = models.TextField()
    photo_keys = models.JSONField(default=list, blank=True)
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.OTHER)
    city = models.CharField(max_length=120)
    state = models.CharField(max_length=120)
    neighborhood = models.CharField(max_length=120, blank=True)
    reward_type = models.CharField(max_length=20, choices=RewardType.choices, default=RewardType.MONEY)
    reward_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    reward_note = models.CharField(max_length=160, blank=True)
    scheduled_for = models.DateTimeField(null=True, blank=True)
    involves_item = models.BooleanField(default=False)
    item_type = models.CharField(max_length=20, choices=ItemType.choices, blank=True)
    item_value = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    item_already_paid = models.BooleanField(default=False)
    risk_level = models.CharField(max_length=12, choices=RiskLevel.choices, default=RiskLevel.LOW)
    moderation_status = models.CharField(max_length=12, choices=ModerationStatus.choices, default=ModerationStatus.APPROVED)
    moderation_reason = models.CharField(max_length=300, blank=True)
    policy_version = models.CharField(max_length=20, default="mvp-v1")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    nearby_email_sent_at = models.DateTimeField(null=True, blank=True)
    class Meta:
        ordering = ("-created_at",)
    def __str__(self):
        return self.title


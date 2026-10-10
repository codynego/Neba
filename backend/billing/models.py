import uuid

from django.conf import settings
from django.db import models


class BillingProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="billing_profile")
    provider_customer_id = models.CharField(max_length=80, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class Subscription(models.Model):
    ACTIVE_STATUSES = ("trialing", "active", "past_due")

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="subscription")
    provider_subscription_id = models.CharField(max_length=80, unique=True)
    provider_product_id = models.CharField(max_length=80, blank=True)
    plan = models.CharField(max_length=32, default="plus")
    interval = models.CharField(max_length=16, blank=True)
    status = models.CharField(max_length=24, default="active", db_index=True)
    currency = models.CharField(max_length=3, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    current_period_start = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    next_billed_at = models.DateTimeField(null=True, blank=True)
    cancel_at_period_end = models.BooleanField(default=False)
    canceled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def entitled(self):
        return self.status in self.ACTIVE_STATUSES


class Checkout(models.Model):
    class Kind(models.TextChoices):
        SUBSCRIPTION = "subscription", "Subscription"
        CREDITS = "credits", "Credits"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="billing_checkouts")
    provider_checkout_id = models.CharField(max_length=80, blank=True, unique=True, null=True)
    reference = models.CharField(max_length=128, unique=True)
    kind = models.CharField(max_length=20, choices=Kind.choices)
    plan = models.CharField(max_length=32, blank=True)
    interval = models.CharField(max_length=16, blank=True)
    product_id = models.CharField(max_length=80, blank=True)
    credits = models.PositiveIntegerField(default=0)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3)
    status = models.CharField(max_length=24, default="creating", db_index=True)
    checkout_url = models.URLField(max_length=500, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    fulfilled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class Payment(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="billing_payments")
    checkout = models.ForeignKey(Checkout, on_delete=models.SET_NULL, null=True, blank=True, related_name="payments")
    provider_charge_id = models.CharField(max_length=80, unique=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3)
    status = models.CharField(max_length=24, default="succeeded")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at", "-id")


class WebhookEvent(models.Model):
    provider_event_id = models.CharField(max_length=100, unique=True)
    event_type = models.CharField(max_length=100)
    processed = models.BooleanField(default=False)
    received_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)

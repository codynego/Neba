from django.conf import settings
from django.db import models
from django.utils.text import slugify


class Business(models.Model):
    owner = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="business_workspace")
    name = models.CharField(max_length=120)
    service_type = models.CharField(max_length=80, blank=True)
    city = models.CharField(max_length=120, blank=True)
    phone = models.CharField(max_length=24, blank=True)
    slug = models.SlugField(max_length=140, unique=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name)[:120] or "neba-business"
            candidate, number = base, 2
            while Business.objects.exclude(pk=self.pk).filter(slug=candidate).exists():
                candidate = f"{base}-{number}"
                number += 1
            self.slug = candidate
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Customer(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="customers")
    name = models.CharField(max_length=120)
    phone = models.CharField(max_length=24, blank=True)
    address = models.CharField(max_length=240, blank=True)
    notes = models.TextField(max_length=1000, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("name", "id")

    def __str__(self):
        return self.name


class Job(models.Model):
    class Status(models.TextChoices):
        NEW = "new", "New request"
        QUOTED = "quoted", "Quote sent"
        CONFIRMED = "confirmed", "Confirmed"
        IN_PROGRESS = "in_progress", "In progress"
        COMPLETED = "completed", "Complete"
        CANCELLED = "cancelled", "Cancelled"

    class PaymentStatus(models.TextChoices):
        UNPAID = "unpaid", "Unpaid"
        PARTIAL = "partial", "Part paid"
        PAID = "paid", "Paid"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="jobs")
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="jobs")
    title = models.CharField(max_length=160)
    description = models.TextField(max_length=2500, blank=True)
    address = models.CharField(max_length=240, blank=True)
    requested_for = models.DateTimeField(null=True, blank=True)
    assignee_name = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.NEW, db_index=True)
    quote_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    deposit_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    payment_status = models.CharField(max_length=12, choices=PaymentStatus.choices, default=PaymentStatus.UNPAID)
    source = models.CharField(max_length=30, default="whatsapp")
    ai_summary = models.TextField(max_length=1500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-updated_at", "-id")

    def refresh_payment_status(self):
        if self.quote_amount and self.amount_paid >= self.quote_amount:
            self.payment_status = self.PaymentStatus.PAID
        elif self.amount_paid > 0:
            self.payment_status = self.PaymentStatus.PARTIAL
        else:
            self.payment_status = self.PaymentStatus.UNPAID

    def save(self, *args, **kwargs):
        self.refresh_payment_status()
        super().save(*args, **kwargs)

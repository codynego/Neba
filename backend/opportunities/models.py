import uuid

from django.conf import settings
from django.db import models


class Opportunity(models.Model):
    class ReviewStatus(models.TextChoices):
        DRAFT = "draft", "Draft"
        PENDING = "pending", "Awaiting review"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Changes requested"

    class Category(models.TextChoices):
        SCHOLARSHIP = "scholarship", "Scholarship"
        GRANT = "grant", "Grant"
        JOB = "job", "Job"
        INTERNSHIP = "internship", "Internship"
        FELLOWSHIP = "fellowship", "Fellowship"
        COMPETITION = "competition", "Competition"
        TRAINING = "training", "Training"
        STARTUP = "startup", "Startup program"
        FUNDING = "funding", "Business funding"
        TENDER = "tender", "Tenders & Procurement"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    title = models.CharField(max_length=220)
    provider = models.CharField(max_length=180)
    summary = models.TextField(max_length=1800)
    category = models.CharField(max_length=24, choices=Category.choices)
    application_url = models.URLField(max_length=500)
    deadline = models.DateTimeField(null=True, blank=True, db_index=True)
    country = models.CharField(max_length=120, blank=True)
    location_label = models.CharField(max_length=140, blank=True)
    is_remote = models.BooleanField(default=False)
    benefit = models.CharField(max_length=220, blank=True)
    eligibility_notes = models.TextField(max_length=1200, blank=True)
    eligible_countries = models.JSONField(default=list, blank=True)
    education_levels = models.JSONField(default=list, blank=True)
    fields_of_study = models.JSONField(default=list, blank=True)
    employment_statuses = models.JSONField(default=list, blank=True)
    min_age = models.PositiveSmallIntegerField(null=True, blank=True)
    max_age = models.PositiveSmallIntegerField(null=True, blank=True)
    requires_business = models.BooleanField(default=False)
    is_published = models.BooleanField(default=True, db_index=True)
    source_url = models.URLField(max_length=500, blank=True)
    view_count = models.PositiveIntegerField(default=0)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_opportunities")
    organization = models.ForeignKey("accounts.Organization", on_delete=models.SET_NULL, null=True, blank=True, related_name="opportunities")
    review_status = models.CharField(max_length=16, choices=ReviewStatus.choices, default=ReviewStatus.APPROVED)
    review_note = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("deadline", "-created_at")
        indexes = [models.Index(fields=("is_published", "category", "deadline"))]

    def __str__(self):
        return self.title


class SavedOpportunity(models.Model):
    class Status(models.TextChoices):
        SAVED = "saved", "Saved"
        PREPARING = "preparing", "Preparing"
        APPLIED = "applied", "Applied"
        SHORTLISTED = "shortlisted", "Shortlisted"
        AWARDED = "awarded", "Awarded"
        ARCHIVED = "archived", "Archived"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="saved_opportunities")
    opportunity = models.ForeignKey(Opportunity, on_delete=models.CASCADE, related_name="saves")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.SAVED)
    note = models.TextField(max_length=2000, blank=True)
    saved_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("user", "opportunity"), name="one_save_per_user_opportunity")]
        ordering = ("-updated_at",)


class OpportunityApplication(models.Model):
    class Status(models.TextChoices):
        PREPARING = "preparing", "Preparing"
        APPLIED = "applied", "Applied"
        SHORTLISTED = "shortlisted", "Shortlisted"
        INTERVIEW = "interview", "Interview"
        AWARDED = "awarded", "Awarded"
        UNSUCCESSFUL = "unsuccessful", "Unsuccessful"
        WITHDRAWN = "withdrawn", "Withdrawn"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="opportunity_applications")
    opportunity = models.ForeignKey(Opportunity, on_delete=models.CASCADE, related_name="applications")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PREPARING)
    applied_at = models.DateTimeField(null=True, blank=True)
    next_action = models.CharField(max_length=240, blank=True)
    next_action_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(max_length=4000, blank=True)
    application_message = models.TextField(max_length=2000, blank=True)
    additional_information = models.TextField(max_length=3000, blank=True)
    shared_fields = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("user", "opportunity"), name="one_application_per_user_opportunity")]
        ordering = ("next_action_at", "-updated_at")


class OpportunityMessage(models.Model):
    application = models.ForeignKey(OpportunityApplication, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    text = models.TextField(max_length=2000)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at", "id")

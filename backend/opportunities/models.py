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

    class ApplicationMode(models.TextChoices):
        EXTERNAL = "external", "External application"
        INTERNAL = "internal", "Apply on Getneba"

    class ApplicationChannel(models.TextChoices):
        WEBSITE = "website", "Website"
        EMAIL = "email", "Email"
        PHONE = "phone", "Phone call"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    title = models.CharField(max_length=220)
    provider = models.CharField(max_length=180)
    summary = models.TextField(max_length=1800)
    category = models.CharField(max_length=24, choices=Category.choices)
    application_mode = models.CharField(max_length=16, choices=ApplicationMode.choices, default=ApplicationMode.EXTERNAL)
    application_channel = models.CharField(max_length=16, choices=ApplicationChannel.choices, default=ApplicationChannel.WEBSITE)
    application_url = models.URLField(max_length=500, blank=True)
    application_email = models.EmailField(blank=True)
    application_phone = models.CharField(max_length=32, blank=True)
    deadline = models.DateTimeField(null=True, blank=True, db_index=True)
    country = models.CharField(max_length=120, blank=True)
    location_label = models.CharField(max_length=140, blank=True)
    is_remote = models.BooleanField(default=False)
    requires_physical_presence = models.BooleanField(default=False)
    requires_local_residency = models.BooleanField(default=False)
    benefit = models.CharField(max_length=220, blank=True)
    eligibility_notes = models.TextField(max_length=1200, blank=True)
    eligible_countries = models.JSONField(default=list, blank=True)
    education_levels = models.JSONField(default=list, blank=True)
    fields_of_study = models.JSONField(default=list, blank=True)
    employment_statuses = models.JSONField(default=list, blank=True)
    min_age = models.PositiveSmallIntegerField(null=True, blank=True)
    max_age = models.PositiveSmallIntegerField(null=True, blank=True)
    requires_business = models.BooleanField(default=False)
    tracker_only = models.BooleanField(default=False, db_index=True)
    is_published = models.BooleanField(default=True, db_index=True)
    source_url = models.URLField(max_length=500, blank=True)
    share_note = models.CharField(max_length=500, blank=True)
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
    shared_profile_snapshot = models.JSONField(default=dict, blank=True)
    status_updated_at = models.DateTimeField(null=True, blank=True)
    applicant_updates_seen_at = models.DateTimeField(null=True, blank=True)
    poster_updates_seen_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("user", "opportunity"), name="one_application_per_user_opportunity")]
        ordering = ("next_action_at", "-updated_at")


class OpportunityCheck(models.Model):
    class InputType(models.TextChoices):
        URL = "url", "Link"
        TEXT = "text", "Pasted text"

    class Status(models.TextChoices):
        PENDING = "pending", "Checking"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Could not complete"

    class Verdict(models.TextChoices):
        CONFIRMED = "confirmed", "Confirmed"
        SUPPORTED = "supported", "Supported by evidence"
        SUSPICIOUS = "suspicious", "Suspicious"
        UNABLE = "unable", "Unable to verify"

    class Level(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="opportunity_checks")
    input_type = models.CharField(max_length=8, choices=InputType.choices)
    submitted_url = models.URLField(max_length=1000, blank=True)
    submitted_text = models.TextField(max_length=12000, blank=True)
    input_hash = models.CharField(max_length=64, db_index=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING, db_index=True)
    verdict = models.CharField(max_length=16, choices=Verdict.choices, blank=True)
    evidence_confidence = models.CharField(max_length=8, choices=Level.choices, blank=True)
    risk_level = models.CharField(max_length=8, choices=Level.choices, blank=True)
    title = models.CharField(max_length=220, blank=True)
    organization = models.CharField(max_length=180, blank=True)
    opportunity_type = models.CharField(max_length=80, blank=True)
    report_summary = models.TextField(max_length=2400, blank=True)
    recommended_action = models.TextField(max_length=1200, blank=True)
    deterministic_checks = models.JSONField(default=list, blank=True)
    claims = models.JSONField(default=list, blank=True)
    sources = models.JSONField(default=list, blank=True)
    warnings = models.JSONField(default=list, blank=True)
    extracted_data = models.JSONField(default=dict, blank=True)
    model_name = models.CharField(max_length=80, blank=True)
    failure_reason = models.CharField(max_length=500, blank=True)
    checked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=("user", "input_hash", "status"))]


class OpportunityThanks(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="opportunity_thanks")
    opportunity = models.ForeignKey(Opportunity, on_delete=models.CASCADE, related_name="thanks")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("user", "opportunity"), name="one_thanks_per_user_opportunity")]
        ordering = ("-created_at",)


class OpportunityCorrection(models.Model):
    class Reason(models.TextChoices):
        CLOSED = "closed", "Opportunity is closed"
        DEADLINE = "deadline", "Deadline is incorrect"
        ELIGIBILITY = "eligibility", "Eligibility is incorrect"
        LINK = "link", "Application link is broken"
        DETAILS = "details", "Other details are incorrect"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        REVIEWED = "reviewed", "Reviewed"
        RESOLVED = "resolved", "Resolved"
        DISMISSED = "dismissed", "Dismissed"

    opportunity = models.ForeignKey(Opportunity, on_delete=models.CASCADE, related_name="corrections")
    reporter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="opportunity_corrections")
    reason = models.CharField(max_length=24, choices=Reason.choices)
    details = models.TextField(max_length=1000, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)


class OpportunityMessage(models.Model):
    application = models.ForeignKey(OpportunityApplication, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    text = models.TextField(max_length=2000)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at", "id")

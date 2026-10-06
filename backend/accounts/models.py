import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    display_name = models.CharField(max_length=80)
    city = models.CharField(max_length=120, blank=True)
    state = models.CharField(max_length=120, blank=True)
    phone = models.CharField(max_length=16, null=True, blank=True, unique=True)
    phone_verified_at = models.DateTimeField(null=True, blank=True)
    identity_verified_at = models.DateTimeField(null=True, blank=True)
    profile_photo = models.BinaryField(blank=True, default=bytes)
    profile_photo_key = models.CharField(max_length=255, blank=True)
    profile_photo_content_type = models.CharField(max_length=40, blank=True)
    photo_visible = models.BooleanField(default=False)
    bio = models.TextField(max_length=600, blank=True)
    skills = models.JSONField(default=list, blank=True)
    neighborhood = models.CharField(max_length=120, blank=True)
    address = models.CharField(max_length=240, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    availability = models.CharField(max_length=20, default="flexible", choices=[("flexible", "Flexible"), ("weekdays", "Weekdays"), ("evenings", "Evenings"), ("weekends", "Weekends"), ("unavailable", "Not taking work")])
    terms_accepted_at = models.DateTimeField(null=True, blank=True)
    legal_policy_version = models.CharField(max_length=20, blank=True)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    nearby_task_emails = models.BooleanField(default=False)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=32, blank=True)
    country = models.CharField(max_length=120, blank=True)
    education_level = models.CharField(max_length=80, blank=True)
    field_of_study = models.CharField(max_length=160, blank=True)
    institution = models.CharField(max_length=180, blank=True)
    graduation_year = models.PositiveSmallIntegerField(null=True, blank=True)
    gpa = models.CharField(max_length=32, blank=True)
    employment_status = models.CharField(max_length=80, blank=True)
    years_experience = models.CharField(max_length=32, blank=True)
    industry = models.CharField(max_length=120, blank=True)
    opportunity_interests = models.JSONField(default=list, blank=True)
    goals = models.JSONField(default=list, blank=True)
    business_status = models.CharField(max_length=80, blank=True)
    financial_need = models.CharField(max_length=80, blank=True)

    def __str__(self):
        return self.display_name or self.username

    @property
    def profile_complete(self):
        return bool(self.country and self.education_level and self.opportunity_interests)


class Organization(models.Model):
    class OrganizationType(models.TextChoices):
        COMPANY = "company", "Company"
        UNIVERSITY = "university", "University"
        NGO = "ngo", "NGO / Foundation"
        GOVERNMENT = "government", "Government"
        STARTUP = "startup", "Startup"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PENDING = "pending", "Awaiting verification"
        VERIFIED = "verified", "Verified"

    owner = models.OneToOneField(User, on_delete=models.CASCADE, related_name="organization")
    name = models.CharField(max_length=180)
    organization_type = models.CharField(max_length=24, choices=OrganizationType.choices, default=OrganizationType.OTHER)
    website = models.URLField(max_length=300, blank=True)
    country = models.CharField(max_length=120, blank=True)
    location = models.CharField(max_length=160, blank=True)
    description = models.TextField(max_length=1200, blank=True)
    contact_name = models.CharField(max_length=120, blank=True)
    contact_email = models.EmailField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    verified_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.name

class PhoneChallenge(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    phone = models.CharField(max_length=16)
    provider_sid = models.CharField(max_length=40, blank=True)
    sent_at = models.DateTimeField()
    expires_at = models.DateTimeField()
    checks = models.PositiveSmallIntegerField(default=0)
    consumed = models.BooleanField(default=False)

class PhoneSendAttempt(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    destination_hash = models.CharField(max_length=64, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

class CaptureChallenge(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    instruction = models.CharField(max_length=160)
    expires_at = models.DateTimeField()
    consumed = models.BooleanField(default=False)

class IdentityVerification(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Awaiting admin review"
        APPROVED = "approved", "Manually reviewed"
        REJECTED = "rejected", "Needs another submission"
        EXPIRED = "expired", "Expired"
        REVOKED = "revoked", "Consent withdrawn"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="identity_submissions")
    full_name = models.CharField(max_length=140)
    document_type = models.CharField(max_length=24, choices=[
        ("national_id", "National identity card"), ("passport", "Passport"),
        ("drivers_license", "Driver's license"),
    ])
    document_image = models.BinaryField(default=bytes)
    portrait_image = models.BinaryField(default=bytes)
    challenge_image = models.BinaryField(default=bytes)
    capture_instruction = models.CharField(max_length=160)
    consent_version = models.CharField(max_length=20, default="pilot-v1")
    publish_photo = models.BooleanField(default=False)
    adult_confirmed = models.BooleanField(default=False)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="identity_reviews")
    document_checked = models.BooleanField(default=False)
    face_matched = models.BooleanField(default=False)
    challenge_matched = models.BooleanField(default=False)
    adult_checked = models.BooleanField(default=False)
    review_note = models.CharField(max_length=500, blank=True)

    class Meta:
        ordering = ("-created_at",)
        permissions = [("review_identityverification", "Review private identity evidence")]

class Block(models.Model):
    blocker = models.ForeignKey(User, on_delete=models.CASCADE, related_name="blocks_made")
    blocked = models.ForeignKey(User, on_delete=models.CASCADE, related_name="blocks_received")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("blocker", "blocked"), name="unique_user_block"),
            models.CheckConstraint(condition=~models.Q(blocker=models.F("blocked")), name="no_self_block"),
        ]

class SafetyReport(models.Model):
    reporter = models.ForeignKey(User, on_delete=models.CASCADE, related_name="reports_made")
    reported_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="reports_received")
    reason = models.CharField(max_length=24, choices=[
        ("unsafe", "Unsafe behavior"), ("harassment", "Harassment"),
        ("fraud", "Fraud or impersonation"), ("conduct", "Inappropriate conduct"), ("other", "Other"),
    ])
    details = models.TextField(max_length=2000)
    status = models.CharField(max_length=20, choices=[("open", "Open"), ("reviewing", "Under review"), ("resolved", "Resolved"), ("dismissed", "Dismissed")], default="open")
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="safety_reviews")
    staff_note = models.TextField(blank=True)

    class Meta:
        ordering = ("-created_at",)

class TrustAudit(models.Model):
    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="trust_actions")
    subject = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="trust_history")
    action = models.CharField(max_length=60)
    note = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class Notification(models.Model):
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    title = models.CharField(max_length=140)
    detail = models.CharField(max_length=300, blank=True)
    path = models.CharField(max_length=200)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering = ("-created_at", "-id")


class PushSubscription(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="push_subscriptions")
    endpoint = models.URLField(max_length=500, unique=True)
    p256dh = models.CharField(max_length=200)
    auth = models.CharField(max_length=200)
    user_agent = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-updated_at",)

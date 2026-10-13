from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
import uuid


class School(models.Model):
    name = models.CharField(max_length=180)
    slug = models.SlugField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)

    def __str__(self):
        return self.name


class SchoolMembership(models.Model):
    class Role(models.TextChoices):
        ADMIN = "admin", "School admin"
        ACADEMIC_HEAD = "academic_head", "Academic head"
        TEACHER = "teacher", "Teacher"

    class Status(models.TextChoices):
        INVITED = "invited", "Invited"
        ACTIVE = "active", "Active"
        SUSPENDED = "suspended", "Suspended"

    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="memberships")
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="school_memberships")
    role = models.CharField(max_length=24, choices=Role.choices)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.INVITED)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("school", "user"), name="unique_school_member")]

    @property
    def is_active(self):
        return self.status == self.Status.ACTIVE and (self.expires_at is None or self.expires_at > timezone.now())

    def __str__(self):
        return f"{self.user} at {self.school}"


class SchoolClass(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="classes")
    name = models.CharField(max_length=100)
    academic_session = models.CharField(max_length=40)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("school", "academic_session", "name"), name="unique_school_session_class")]
        ordering = ("academic_session", "name")

    def __str__(self):
        return f"{self.name} ({self.academic_session})"


class Subject(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="subjects")
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=32, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("school", "name"), name="unique_school_subject")]
        ordering = ("name",)

    def __str__(self):
        return self.name


class Student(models.Model):
    """A student record owned by exactly one school workspace."""

    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="students")
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    school_class = models.ForeignKey(SchoolClass, on_delete=models.PROTECT, related_name="students")
    first_name = models.CharField(max_length=80)
    last_name = models.CharField(max_length=80)
    admission_number = models.CharField(max_length=64, blank=True)
    address_line = models.CharField(max_length=240, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    guardian_name = models.CharField(max_length=160, blank=True)
    guardian_phone = models.CharField(max_length=32, blank=True)
    guardian_email = models.EmailField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("last_name", "first_name")
        constraints = [
            models.UniqueConstraint(
                fields=("school", "admission_number"),
                condition=~models.Q(admission_number=""),
                name="unique_school_admission_number",
            ),
        ]

    def clean(self):
        if self.school_class_id and self.school_id and self.school_class.school_id != self.school_id:
            raise ValidationError({"school_class": "The class must belong to this school."})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    def __str__(self):
        return self.full_name


class TeachingAssignment(models.Model):
    membership = models.ForeignKey(SchoolMembership, on_delete=models.CASCADE, related_name="teaching_assignments")
    school_class = models.ForeignKey(SchoolClass, on_delete=models.CASCADE, related_name="teaching_assignments")
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name="teaching_assignments")
    starts_at = models.DateField(default=timezone.localdate)
    ends_at = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("membership", "school_class", "subject"), name="unique_teaching_assignment")]

    def clean(self):
        errors = {}
        if self.membership_id and self.membership.role != SchoolMembership.Role.TEACHER:
            errors["membership"] = "Only teacher memberships can receive teaching assignments."
        if self.membership_id and self.school_class_id and self.membership.school_id != self.school_class.school_id:
            errors["school_class"] = "The class must belong to the membership's school."
        if self.membership_id and self.subject_id and self.membership.school_id != self.subject.school_id:
            errors["subject"] = "The subject must belong to the membership's school."
        if self.ends_at and self.starts_at and self.ends_at < self.starts_at:
            errors["ends_at"] = "The end date cannot be before the start date."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    @property
    def is_current(self):
        today = timezone.localdate()
        return self.is_active and self.starts_at <= today and (self.ends_at is None or self.ends_at >= today)

    def __str__(self):
        return f"{self.membership}: {self.school_class} - {self.subject}"

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils import timezone
import uuid


class School(models.Model):
    name = models.CharField(max_length=180)
    slug = models.SlugField(unique=True)
    student_id_prefix = models.CharField(max_length=12, default="NBS")
    next_student_number = models.PositiveIntegerField(default=1)
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
    student_id = models.CharField(max_length=32, editable=False)
    admission_year = models.PositiveIntegerField(default=timezone.now().year)
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
            models.UniqueConstraint(fields=("school", "student_id"), name="unique_school_student_id"),
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
        if not self.student_id and self.school_id:
            with transaction.atomic():
                school = School.objects.select_for_update().get(pk=self.school_id)
                self.student_id = f"{school.student_id_prefix.upper()}-{self.admission_year}-{school.next_student_number:04d}"
                school.next_student_number += 1
                school.save(update_fields=("next_student_number", "updated_at"))
        self.full_clean()
        return super().save(*args, **kwargs)

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    def __str__(self):
        return self.full_name


class StudentEnrollment(models.Model):
    """A student's class placement for one academic session; never overwrites history."""
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        COMPLETED = "completed", "Completed"
        TRANSFERRED = "transferred", "Transferred"
        WITHDRAWN = "withdrawn", "Withdrawn"

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="enrollments")
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="student_enrollments")
    school_class = models.ForeignKey(SchoolClass, on_delete=models.PROTECT, related_name="enrollments")
    academic_session = models.CharField(max_length=40)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    starts_at = models.DateField(default=timezone.localdate)
    ends_at = models.DateField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("student", "academic_session"), name="unique_student_session_enrollment")]

    def clean(self):
        if self.student_id and self.school_id and self.student.school_id != self.school_id:
            raise ValidationError({"school": "Enrollment must belong to the student's school."})
        if self.school_class_id and self.school_id and self.school_class.school_id != self.school_id:
            raise ValidationError({"school_class": "The class must belong to this school."})


class StudentProgression(models.Model):
    class Decision(models.TextChoices):
        PROMOTED = "promoted", "Promoted"
        REPEATING = "repeating", "Repeating"
        GRADUATED = "graduated", "Graduated"
        TRANSFERRED = "transferred", "Transferred out"
        WITHDRAWN = "withdrawn", "Withdrawn"
        PENDING = "pending", "Pending"

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="progressions")
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="student_progressions")
    from_enrollment = models.ForeignKey(StudentEnrollment, on_delete=models.PROTECT, related_name="progressed_from")
    to_enrollment = models.ForeignKey(StudentEnrollment, null=True, blank=True, on_delete=models.PROTECT, related_name="progressed_to")
    decision = models.CharField(max_length=16, choices=Decision.choices, default=Decision.PENDING)
    effective_date = models.DateField(default=timezone.localdate)
    approved_by = models.ForeignKey(SchoolMembership, null=True, blank=True, on_delete=models.SET_NULL, related_name="approved_progressions")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("student", "from_enrollment"), name="unique_student_progression_source")]


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


class ClassTeacherAssignment(models.Model):
    """A class-level pastoral/administrative responsibility, separate from subject access."""

    membership = models.ForeignKey(SchoolMembership, on_delete=models.CASCADE, related_name="class_teacher_assignments")
    school_class = models.ForeignKey(SchoolClass, on_delete=models.CASCADE, related_name="class_teacher_assignments")
    starts_at = models.DateField(default=timezone.localdate)
    ends_at = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("membership", "school_class"), name="unique_class_teacher_assignment")]

    def clean(self):
        errors = {}
        if self.membership_id and self.membership.role != SchoolMembership.Role.TEACHER:
            errors["membership"] = "Only teacher memberships can receive class teacher assignments."
        if self.membership_id and self.school_class_id and self.membership.school_id != self.school_class.school_id:
            errors["school_class"] = "The class must belong to the membership's school."
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
        return f"{self.membership}: class teacher for {self.school_class}"


class AttendanceRecord(models.Model):
    """One teacher-recorded daily attendance decision for a learner."""

    class Status(models.TextChoices):
        PRESENT = "present", "Present"
        LATE = "late", "Late"
        ABSENT = "absent", "Absent"
        EXCUSED = "excused", "Excused"

    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="attendance_records")
    school_class = models.ForeignKey(SchoolClass, on_delete=models.PROTECT, related_name="attendance_records")
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="attendance_records")
    date = models.DateField(default=timezone.localdate)
    status = models.CharField(max_length=16, choices=Status.choices)
    note = models.CharField(max_length=240, blank=True)
    recorded_by = models.ForeignKey(SchoolMembership, null=True, blank=True, on_delete=models.SET_NULL, related_name="recorded_attendance")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-date", "student__last_name", "student__first_name")
        constraints = [models.UniqueConstraint(fields=("student", "date"), name="unique_student_attendance_date")]
        indexes = [models.Index(fields=("school_class", "date"), name="class_attendance_date_idx")]

    def clean(self):
        errors = {}
        if self.student_id and self.school_id and self.student.school_id != self.school_id:
            errors["student"] = "The student must belong to this school."
        if self.school_class_id and self.school_id and self.school_class.school_id != self.school_id:
            errors["school_class"] = "The class must belong to this school."
        if self.student_id and self.school_class_id and self.student.school_class_id != self.school_class_id:
            errors["school_class"] = "The attendance class must match the student's current class."
        if self.recorded_by_id and self.school_id and self.recorded_by.school_id != self.school_id:
            errors["recorded_by"] = "The recorder must belong to this school."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class Assessment(models.Model):
    class Type(models.TextChoices):
        CA = "ca", "Continuous assessment"
        QUIZ = "quiz", "Quiz or test"
        EXAM = "exam", "Examination"
        ASSIGNMENT = "assignment", "Graded assignment"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        REVIEWED = "reviewed", "Reviewed"
        PUBLISHED = "published", "Published"

    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="assessments")
    school_class = models.ForeignKey(SchoolClass, on_delete=models.PROTECT, related_name="assessments")
    subject = models.ForeignKey(Subject, on_delete=models.PROTECT, related_name="assessments")
    academic_session = models.CharField(max_length=40)
    term = models.CharField(max_length=40)
    title = models.CharField(max_length=160)
    assessment_type = models.CharField(max_length=16, choices=Type.choices)
    maximum_score = models.DecimalField(max_digits=7, decimal_places=2)
    weight = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    assessment_date = models.DateField(default=timezone.localdate)
    topics = models.CharField(max_length=300, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    created_by = models.ForeignKey(SchoolMembership, null=True, on_delete=models.SET_NULL, related_name="created_assessments")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-assessment_date", "-id")

    def clean(self):
        if self.school_class_id and self.school_id and self.school_class.school_id != self.school_id:
            raise ValidationError({"school_class": "The class must belong to this school."})
        if self.subject_id and self.school_id and self.subject.school_id != self.school_id:
            raise ValidationError({"subject": "The subject must belong to this school."})
        if self.maximum_score is not None and self.maximum_score <= 0:
            raise ValidationError({"maximum_score": "Maximum score must be greater than zero."})


class AssessmentScore(models.Model):
    class EntryStatus(models.TextChoices):
        ENTERED = "entered", "Entered"
        MISSING = "missing", "Missing"
        EXCUSED = "excused", "Excused"
        ABSENT = "absent", "Absent"

    assessment = models.ForeignKey(Assessment, on_delete=models.CASCADE, related_name="scores")
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="assessment_scores")
    score = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=16, choices=EntryStatus.choices, default=EntryStatus.MISSING)
    entered_by = models.ForeignKey(SchoolMembership, null=True, on_delete=models.SET_NULL, related_name="entered_scores")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("assessment", "student"), name="unique_assessment_student_score")]

    def clean(self):
        if self.student_id and self.assessment_id and self.student.school_id != self.assessment.school_id:
            raise ValidationError({"student": "Student belongs to another school."})
        if self.student_id and self.assessment_id and self.student.school_class_id != self.assessment.school_class_id:
            raise ValidationError({"student": "Student is not in this assessment's class."})
        if self.score is not None and self.assessment_id and (self.score < 0 or self.score > self.assessment.maximum_score):
            raise ValidationError({"score": "Score must be between zero and the assessment maximum."})


class AssessmentQuestion(models.Model):
    """Question-to-topic evidence mapping, reviewed by the teacher before analysis."""
    assessment = models.ForeignKey(Assessment, on_delete=models.CASCADE, related_name="questions")
    number = models.PositiveSmallIntegerField()
    topic = models.CharField(max_length=160)
    learning_objective = models.CharField(max_length=300, blank=True)
    maximum_score = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("number",)
        constraints = [models.UniqueConstraint(fields=("assessment", "number"), name="unique_assessment_question_number")]

    def clean(self):
        if self.number < 1:
            raise ValidationError({"number": "Question number must be at least one."})
        if self.maximum_score is not None and self.maximum_score <= 0:
            raise ValidationError({"maximum_score": "Maximum score must be greater than zero."})


class AssessmentQuestionScore(models.Model):
    class EntryStatus(models.TextChoices):
        ENTERED = "entered", "Entered"
        MISSING = "missing", "Missing"
        EXCUSED = "excused", "Excused"
        ABSENT = "absent", "Absent"

    question = models.ForeignKey(AssessmentQuestion, on_delete=models.CASCADE, related_name="scores")
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="question_scores")
    score = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=16, choices=EntryStatus.choices, default=EntryStatus.MISSING)
    entered_by = models.ForeignKey(SchoolMembership, null=True, on_delete=models.SET_NULL, related_name="entered_question_scores")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("question", "student"), name="unique_assessment_question_student_score")]

    def clean(self):
        assessment = self.question.assessment if self.question_id else None
        if assessment and self.student_id and self.student.school_id != assessment.school_id:
            raise ValidationError({"student": "Student belongs to another school."})
        if assessment and self.student_id and self.student.school_class_id != assessment.school_class_id:
            raise ValidationError({"student": "Student is not in this assessment's class."})
        if self.score is not None and self.question.maximum_score is not None and (self.score < 0 or self.score > self.question.maximum_score):
            raise ValidationError({"score": "Score must be between zero and the question maximum."})


class Assignment(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"
        CLOSED = "closed", "Closed"

    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="assignments")
    school_class = models.ForeignKey(SchoolClass, on_delete=models.PROTECT, related_name="assignments")
    subject = models.ForeignKey(Subject, on_delete=models.PROTECT, related_name="assignments")
    title = models.CharField(max_length=160)
    instructions = models.TextField(blank=True)
    due_date = models.DateField(null=True, blank=True)
    maximum_score = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    counts_toward_ca = models.BooleanField(default=False)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    created_by = models.ForeignKey(SchoolMembership, null=True, on_delete=models.SET_NULL, related_name="created_assignments")
    created_at = models.DateTimeField(auto_now_add=True)


class AcademicIntervention(models.Model):
    """A teacher-reviewed response to a topic signal; never an automatic student decision."""
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        ACTIVE = "active", "Active"
        COMPLETE = "complete", "Complete"

    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="academic_interventions")
    school_class = models.ForeignKey(SchoolClass, on_delete=models.PROTECT, related_name="academic_interventions")
    subject = models.ForeignKey(Subject, on_delete=models.PROTECT, related_name="academic_interventions")
    topic = models.CharField(max_length=160)
    title = models.CharField(max_length=180)
    rationale = models.TextField(blank=True)
    baseline_average = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    created_by = models.ForeignKey(SchoolMembership, null=True, on_delete=models.SET_NULL, related_name="created_interventions")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

    def clean(self):
        if self.school_class_id and self.school_id and self.school_class.school_id != self.school_id:
            raise ValidationError({"school_class": "The class must belong to this school."})
        if self.subject_id and self.school_id and self.subject.school_id != self.school_id:
            raise ValidationError({"subject": "The subject must belong to this school."})


class StudentIntervention(models.Model):
    """A teacher-owned support plan for one learner, grounded in recorded evidence."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        ACTIVE = "active", "Active"
        COMPLETE = "complete", "Complete"

    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="student_interventions")
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="interventions")
    school_class = models.ForeignKey(SchoolClass, on_delete=models.PROTECT, related_name="student_interventions")
    subject = models.ForeignKey(Subject, on_delete=models.PROTECT, related_name="student_interventions")
    topic = models.CharField(max_length=160)
    title = models.CharField(max_length=180)
    rationale = models.TextField(blank=True)
    baseline_average = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    follow_up_average = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    created_by = models.ForeignKey(SchoolMembership, null=True, on_delete=models.SET_NULL, related_name="created_student_interventions")
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=("student", "status"), name="student_plan_status_idx")]

    def clean(self):
        errors = {}
        if self.student_id and self.school_id and self.student.school_id != self.school_id:
            errors["student"] = "The student must belong to this school."
        if self.school_class_id and self.school_id and self.school_class.school_id != self.school_id:
            errors["school_class"] = "The class must belong to this school."
        if self.subject_id and self.school_id and self.subject.school_id != self.school_id:
            errors["subject"] = "The subject must belong to this school."
        if self.student_id and self.school_class_id and self.student.school_class_id != self.school_class_id:
            errors["school_class"] = "The plan's class must match the student's current class."
        if errors:
            raise ValidationError(errors)

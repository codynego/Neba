import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class Exam(models.Model):
    """A configurable assessment family, not a hard-coded exam experience."""

    class Category(models.TextChoices):
        SCHOOL = "school", "School leaving / entrance"
        UNIVERSITY = "university", "University course"
        PROFESSIONAL = "professional", "Professional qualification"
        INTERNATIONAL = "international", "International examination"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    name = models.CharField(max_length=160)
    slug = models.SlugField(unique=True)
    category = models.CharField(max_length=24, choices=Category.choices)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("category", "name")

    def __str__(self):
        return self.name


class ExamPaper(models.Model):
    """A subject, course or professional paper belonging to an exam."""

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name="papers")
    name = models.CharField(max_length=160)
    code = models.CharField(max_length=48, blank=True)
    duration_minutes = models.PositiveIntegerField(null=True, blank=True)
    maximum_score = models.PositiveIntegerField(null=True, blank=True)
    # e.g. ["multiple_choice", "essay", "calculation", "case_study"]
    question_formats = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("exam__name", "name")
        constraints = [models.UniqueConstraint(fields=("exam", "name"), name="unique_exam_paper_name")]

    def __str__(self):
        return f"{self.exam.name} — {self.name}"


class ExamVersion(models.Model):
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name="versions")
    label = models.CharField(max_length=80)
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    syllabus_reference = models.CharField(max_length=300, blank=True)
    is_current = models.BooleanField(default=False)

    class Meta:
        ordering = ("-effective_from",)
        constraints = [models.UniqueConstraint(fields=("exam", "label"), name="unique_exam_version_label")]


class ExamBlueprint(models.Model):
    """The published timing, marking and coverage rule for one paper version."""

    exam_version = models.ForeignKey(ExamVersion, on_delete=models.CASCADE, related_name="blueprints")
    paper = models.ForeignKey(ExamPaper, on_delete=models.CASCADE, related_name="blueprints")
    question_count = models.PositiveIntegerField(default=0)
    duration_minutes = models.PositiveIntegerField(null=True, blank=True)
    marking_rules = models.JSONField(default=dict, blank=True)
    coverage_rules = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("exam_version", "paper"), name="unique_version_paper_blueprint")]


class ContentSource(models.Model):
    class RightsStatus(models.TextChoices):
        PENDING = "pending", "Pending review"
        CLEARED = "cleared", "Rights cleared"
        RESTRICTED = "restricted", "Restricted"

    name = models.CharField(max_length=200)
    reference = models.CharField(max_length=300, blank=True)
    rights_status = models.CharField(max_length=16, choices=RightsStatus.choices, default=RightsStatus.PENDING)
    extraction_status = models.CharField(max_length=24, default="pending")
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Topic(models.Model):
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    paper = models.ForeignKey(ExamPaper, on_delete=models.CASCADE, related_name="topics")
    name = models.CharField(max_length=160)
    code = models.CharField(max_length=48, blank=True)
    syllabus_priority = models.PositiveSmallIntegerField(default=3, help_text="1 (lowest) to 5 (highest)")
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("position", "name")
        constraints = [models.UniqueConstraint(fields=("paper", "name"), name="unique_paper_topic_name")]

    def clean(self):
        if not 1 <= self.syllabus_priority <= 5:
            raise ValidationError({"syllabus_priority": "Use a value from 1 to 5."})

    def __str__(self):
        return f"{self.paper}: {self.name}"


class Question(models.Model):
    class Source(models.TextChoices):
        ORIGINAL = "original", "Original Neba question"
        LICENSED = "licensed", "Licensed source material"
        USER_UPLOAD = "user_upload", "Learner upload"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        REVIEW = "review", "Needs review"
        VERIFIED = "verified", "Verified"
        RETIRED = "retired", "Retired"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    paper = models.ForeignKey(ExamPaper, on_delete=models.CASCADE, related_name="questions")
    topic = models.ForeignKey(Topic, null=True, blank=True, on_delete=models.SET_NULL, related_name="questions")
    related_topics = models.ManyToManyField(Topic, blank=True, related_name="related_questions")
    content_source = models.ForeignKey(ContentSource, null=True, blank=True, on_delete=models.SET_NULL, related_name="questions")
    exam_version = models.ForeignKey(ExamVersion, null=True, blank=True, on_delete=models.SET_NULL, related_name="questions")
    source = models.CharField(max_length=16, choices=Source.choices, default=Source.ORIGINAL)
    source_reference = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    question_format = models.CharField(max_length=32, default="multiple_choice")
    difficulty = models.PositiveSmallIntegerField(default=3, help_text="1 (introductory) to 5 (advanced)")
    prompt = models.TextField()
    options = models.JSONField(default=list, blank=True)
    correct_answer = models.JSONField(default=dict, blank=True)
    explanation = models.TextField(blank=True)
    learning_objective = models.CharField(max_length=300, blank=True)
    marks = models.DecimalField(max_digits=7, decimal_places=2, default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("paper", "topic", "id")

    def clean(self):
        if not 1 <= self.difficulty <= 5:
            raise ValidationError({"difficulty": "Use a value from 1 to 5."})
        if self.topic_id and self.paper_id and self.topic.paper_id != self.paper_id:
            raise ValidationError({"topic": "The topic must belong to this paper."})


class LearnerExamGoal(models.Model):
    learner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="exam_goals")
    paper = models.ForeignKey(ExamPaper, on_delete=models.CASCADE, related_name="learner_goals")
    exam_date = models.DateField(null=True, blank=True)
    weekly_study_minutes = models.PositiveIntegerField(default=180)
    target_score = models.PositiveSmallIntegerField(default=75)
    preferred_session_minutes = models.PositiveSmallIntegerField(default=25)
    study_days = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("learner", "paper"), name="unique_learner_paper_goal")]


class PracticeSession(models.Model):
    class Mode(models.TextChoices):
        DIAGNOSTIC = "diagnostic", "Diagnostic"
        PRACTICE = "practice", "Practice"
        PAST_QUESTIONS = "past_questions", "Past questions"
        AI_PRACTICE = "ai_practice", "AI practice"
        MOCK = "mock", "Mock exam"
        REVISION = "revision", "Targeted revision"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        COMPLETE = "complete", "Complete"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    learner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="practice_sessions")
    paper = models.ForeignKey(ExamPaper, on_delete=models.PROTECT, related_name="practice_sessions")
    mode = models.CharField(max_length=16, choices=Mode.choices, default=Mode.PRACTICE)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    timer_seconds = models.PositiveIntegerField(null=True, blank=True)
    immediate_feedback = models.BooleanField(default=True)


class QuestionAttempt(models.Model):
    session = models.ForeignKey(PracticeSession, on_delete=models.CASCADE, related_name="attempts")
    question = models.ForeignKey(Question, on_delete=models.PROTECT, related_name="attempts")
    answer = models.JSONField(default=dict, blank=True)
    is_correct = models.BooleanField(null=True, blank=True)
    score = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    response_seconds = models.PositiveIntegerField(null=True, blank=True)
    answered_at = models.DateTimeField(null=True, blank=True)
    position = models.PositiveIntegerField(default=0)
    is_flagged = models.BooleanField(default=False)
    hint_requested = models.BooleanField(default=False)

    class Meta:
        ordering = ("position", "id")
        constraints = [models.UniqueConstraint(fields=("session", "question"), name="unique_session_question_attempt")]


class TopicMastery(models.Model):
    learner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="topic_mastery")
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name="learner_mastery")
    attempts = models.PositiveIntegerField(default=0)
    correct_attempts = models.PositiveIntegerField(default=0)
    mastery_score = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    last_practised_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("learner", "topic"), name="unique_learner_topic_mastery")]


class LearnerDailyUsage(models.Model):
    learner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="exam_daily_usage")
    date = models.DateField()
    tutor_messages = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("learner", "date"), name="unique_learner_exam_daily_usage")]


class GenerationJob(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        VALIDATING = "validating", "Validating"
        REVIEW = "review", "Needs review"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    paper = models.ForeignKey(ExamPaper, on_delete=models.PROTECT, related_name="generation_jobs")
    topic = models.ForeignKey(Topic, null=True, blank=True, on_delete=models.SET_NULL, related_name="generation_jobs")
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="exam_generation_jobs")
    model_name = models.CharField(max_length=120, blank=True)
    prompt_version = models.CharField(max_length=80, blank=True)
    request_payload = models.JSONField(default=dict, blank=True)
    validation_result = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    created_at = models.DateTimeField(auto_now_add=True)

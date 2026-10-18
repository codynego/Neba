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
    source = models.CharField(max_length=16, choices=Source.choices, default=Source.ORIGINAL)
    source_reference = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    question_format = models.CharField(max_length=32, default="multiple_choice")
    difficulty = models.PositiveSmallIntegerField(default=3, help_text="1 (introductory) to 5 (advanced)")
    prompt = models.TextField()
    options = models.JSONField(default=list, blank=True)
    correct_answer = models.JSONField(default=dict, blank=True)
    explanation = models.TextField(blank=True)
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
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("learner", "paper"), name="unique_learner_paper_goal")]


class PracticeSession(models.Model):
    class Mode(models.TextChoices):
        PRACTICE = "practice", "Practice"
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


class QuestionAttempt(models.Model):
    session = models.ForeignKey(PracticeSession, on_delete=models.CASCADE, related_name="attempts")
    question = models.ForeignKey(Question, on_delete=models.PROTECT, related_name="attempts")
    answer = models.JSONField(default=dict, blank=True)
    is_correct = models.BooleanField(null=True, blank=True)
    score = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    response_seconds = models.PositiveIntegerField(null=True, blank=True)
    answered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("session", "question"), name="unique_session_question_attempt")]

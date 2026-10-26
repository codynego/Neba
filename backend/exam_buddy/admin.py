from django.contrib import admin, messages

from .models import ContentSource, Exam, ExamBlueprint, ExamPaper, ExamVersion, GenerationJob, LearnerDailyUsage, LearnerExamGoal, PracticeSession, Question, QuestionAttempt, Topic, TopicMastery


class PaperInline(admin.TabularInline):
    model = ExamPaper
    extra = 0
    fields = ("name", "code", "duration_minutes", "question_formats", "is_active")


@admin.register(Exam)
class ExamAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "is_active", "updated_at")
    list_filter = ("category", "is_active")
    search_fields = ("name", "description")
    prepopulated_fields = {"slug": ("name",)}
    inlines = (PaperInline,)


@admin.register(ExamPaper)
class ExamPaperAdmin(admin.ModelAdmin):
    list_display = ("name", "exam", "code", "duration_minutes", "is_active")
    list_filter = ("exam", "is_active")
    search_fields = ("name", "code", "exam__name")


@admin.register(Topic)
class TopicAdmin(admin.ModelAdmin):
    list_display = ("name", "paper", "syllabus_priority", "position")
    list_filter = ("paper__exam", "paper", "syllabus_priority")
    search_fields = ("name", "code", "paper__name")
    ordering = ("paper", "position", "name")


@admin.register(ContentSource)
class ContentSourceAdmin(admin.ModelAdmin):
    list_display = ("name", "rights_status", "extraction_status", "created_at")
    list_filter = ("rights_status", "extraction_status")
    search_fields = ("name", "reference", "notes")


@admin.action(description="Move selected questions to editorial review")
def move_to_review(modeladmin, request, queryset):
    updated = queryset.filter(status=Question.Status.DRAFT).update(status=Question.Status.REVIEW)
    modeladmin.message_user(request, f"{updated} question(s) moved to editorial review.", messages.SUCCESS)


@admin.action(description="Publish selected questions as verified")
def publish_verified(modeladmin, request, queryset):
    published = 0
    blocked = []
    for question in queryset.select_related("topic", "content_source"):
        problems = []
        if not question.topic_id:
            problems.append("topic")
        if not question.explanation.strip():
            problems.append("explanation")
        if not question.correct_answer:
            problems.append("answer key")
        if question.question_format == "multiple_choice" and len(question.options) < 2:
            problems.append("options")
        if question.source != Question.Source.ORIGINAL and (not question.content_source or question.content_source.rights_status != ContentSource.RightsStatus.CLEARED):
            problems.append("cleared rights source")
        if problems:
            blocked.append(f"{question.public_id}: {', '.join(problems)}")
            continue
        question.status = Question.Status.VERIFIED
        question.save(update_fields=("status", "updated_at"))
        published += 1
    if published:
        modeladmin.message_user(request, f"{published} reviewed question(s) published.", messages.SUCCESS)
    if blocked:
        modeladmin.message_user(request, "Not published — " + "; ".join(blocked[:8]), messages.WARNING)


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ("short_prompt", "paper", "topic", "question_format", "difficulty", "source", "status", "updated_at")
    list_filter = ("status", "source", "question_format", "difficulty", "paper__exam", "paper")
    search_fields = ("prompt", "explanation", "learning_objective", "source_reference")
    readonly_fields = ("public_id", "created_at", "updated_at")
    actions = (move_to_review, publish_verified)
    autocomplete_fields = ("paper", "topic", "content_source", "exam_version")

    @admin.display(description="Question")
    def short_prompt(self, obj):
        return obj.prompt[:90] + ("…" if len(obj.prompt) > 90 else "")


@admin.register(GenerationJob)
class GenerationJobAdmin(admin.ModelAdmin):
    list_display = ("paper", "topic", "status", "model_name", "prompt_version", "created_at")
    list_filter = ("status", "paper__exam", "paper")
    readonly_fields = ("request_payload", "validation_result", "created_at")


@admin.register(ExamVersion)
class ExamVersionAdmin(admin.ModelAdmin):
    list_display = ("label", "exam", "effective_from", "effective_to", "is_current")
    search_fields = ("label", "exam__name", "syllabus_reference")
    list_filter = ("exam", "is_current")


admin.site.register((ExamBlueprint, LearnerExamGoal, LearnerDailyUsage, PracticeSession, QuestionAttempt, TopicMastery))

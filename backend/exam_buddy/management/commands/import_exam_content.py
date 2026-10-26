import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.text import slugify

from exam_buddy.models import ContentSource, Exam, ExamPaper, Question, Topic


class Command(BaseCommand):
    help = "Import an exam catalogue and questions as editorial drafts. Nothing is auto-published."

    def add_arguments(self, parser):
        parser.add_argument("path", help="JSON file containing one exam package")

    @transaction.atomic
    def handle(self, *args, **options):
        path = Path(options["path"])
        if not path.is_file():
            raise CommandError(f"File not found: {path}")
        try:
            package = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise CommandError(f"Could not read valid JSON: {error}") from error

        exam_data = package.get("exam") or {}
        if not exam_data.get("name"):
            raise CommandError("exam.name is required")
        exam, _ = Exam.objects.update_or_create(
            slug=exam_data.get("slug") or slugify(exam_data["name"]),
            defaults={"name": exam_data["name"], "category": exam_data.get("category", Exam.Category.SCHOOL), "description": exam_data.get("description", ""), "is_active": bool(exam_data.get("is_active", True))},
        )
        imported_questions = 0
        for paper_data in package.get("papers", []):
            if not paper_data.get("name"):
                raise CommandError("Every paper requires a name")
            paper, _ = ExamPaper.objects.update_or_create(
                exam=exam,
                name=paper_data["name"],
                defaults={"code": paper_data.get("code", ""), "duration_minutes": paper_data.get("duration_minutes"), "maximum_score": paper_data.get("maximum_score"), "question_formats": paper_data.get("question_formats", ["multiple_choice"]), "is_active": True},
            )
            topics = {}
            for position, topic_data in enumerate(paper_data.get("topics", []), start=1):
                name = topic_data["name"] if isinstance(topic_data, dict) else str(topic_data)
                priority = topic_data.get("syllabus_priority", 3) if isinstance(topic_data, dict) else 3
                topic, _ = Topic.objects.update_or_create(paper=paper, name=name, defaults={"syllabus_priority": priority, "position": position})
                topics[name] = topic
            for question_data in paper_data.get("questions", []):
                reference = str(question_data.get("reference", "")).strip()
                if not reference:
                    raise CommandError(f"A question in {paper.name} is missing its stable reference")
                source_type = question_data.get("source", Question.Source.ORIGINAL)
                source = None
                if source_type != Question.Source.ORIGINAL:
                    source_name = str(question_data.get("source_name", "")).strip()
                    if not source_name:
                        raise CommandError(f"Question {reference} requires source_name")
                    source, _ = ContentSource.objects.get_or_create(name=source_name, reference=question_data.get("source_url", ""), defaults={"rights_status": ContentSource.RightsStatus.PENDING})
                topic = topics.get(question_data.get("topic"))
                question, _ = Question.objects.update_or_create(
                    paper=paper,
                    source_reference=reference,
                    defaults={
                        "topic": topic,
                        "content_source": source,
                        "source": source_type,
                        "status": Question.Status.REVIEW,
                        "question_format": question_data.get("format", "multiple_choice"),
                        "difficulty": question_data.get("difficulty", 3),
                        "prompt": question_data.get("prompt", ""),
                        "options": question_data.get("options", []),
                        "correct_answer": question_data.get("correct_answer", {}),
                        "explanation": question_data.get("explanation", ""),
                        "learning_objective": question_data.get("learning_objective", ""),
                        "marks": question_data.get("marks", 1),
                    },
                )
                question.full_clean()
                question.save()
                imported_questions += 1
        self.stdout.write(self.style.SUCCESS(f"Imported {exam.name}: {len(package.get('papers', []))} paper(s), {imported_questions} question draft(s). Review and publish them in Django admin."))

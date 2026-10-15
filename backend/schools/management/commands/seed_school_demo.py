from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Case, IntegerField, Q, Value, When
from django.utils import timezone

from schools.models import (
    AcademicIntervention,
    Assessment,
    AssessmentQuestion,
    AssessmentQuestionScore,
    AssessmentScore,
    Assignment,
    School,
    SchoolClass,
    SchoolMembership,
    Student,
    StudentEnrollment,
    Subject,
)


DEMO_STUDENTS = (
    ("GROK-DEMO-001", "Amina", "Bello", "JSS 1 Gold"),
    ("GROK-DEMO-002", "Chidera", "Okafor", "JSS 1 Gold"),
    ("GROK-DEMO-003", "David", "Adeyemi", "JSS 1 Gold"),
    ("GROK-DEMO-004", "Efe", "Oghene", "JSS 1 Gold"),
    ("GROK-DEMO-005", "Fatima", "Musa", "JSS 1 Gold"),
    ("GROK-DEMO-006", "Ifeanyi", "Eze", "JSS 1 Gold"),
    ("GROK-DEMO-007", "Morenike", "Adebayo", "JSS 1 Gold"),
    ("GROK-DEMO-008", "Tari", "George", "JSS 1 Gold"),
    ("GROK-DEMO-009", "Abigail", "Danladi", "JSS 2 Gold"),
    ("GROK-DEMO-010", "Chisom", "Nwosu", "JSS 2 Gold"),
    ("GROK-DEMO-011", "Hassan", "Lawal", "JSS 2 Gold"),
    ("GROK-DEMO-012", "Kemi", "Oladipo", "JSS 2 Gold"),
    ("GROK-DEMO-013", "Nneka", "Umeh", "JSS 2 Gold"),
    ("GROK-DEMO-014", "Olamide", "Ajayi", "JSS 2 Gold"),
    ("GROK-DEMO-015", "Simi", "Balogun", "JSS 2 Gold"),
    ("GROK-DEMO-016", "Yusuf", "Ibrahim", "JSS 2 Gold"),
)


def current_academic_session(today):
    """Return the Nigerian school session containing ``today`` (September start)."""
    start_year = today.year if today.month >= 9 else today.year - 1
    return f"{start_year}/{start_year + 1}"


class Command(BaseCommand):
    help = (
        "Add an idempotent, fictional data set to an existing school workspace. "
        "The command never creates a school or user account."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--school",
            default="grok academy",
            help="Existing school name or slug (default: grok academy).",
        )
        parser.add_argument(
            "--academic-session",
            help="Session label, for example 2026/2027 (defaults to the current session).",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        school_label = options["school"].strip()
        school = (
            School.objects.filter(Q(name__iexact=school_label) | Q(slug__iexact=school_label))
            .order_by("id")
            .first()
        )
        if school is None:
            raise CommandError(
                f'No school named or slugged "{school_label}" exists. '
                "Create the school first, then run this command again."
            )

        today = timezone.localdate()
        academic_session = options.get("academic_session") or current_academic_session(today)
        creator = (
            school.memberships.filter(status=SchoolMembership.Status.ACTIVE)
            .annotate(
                role_order=Case(
                    When(role=SchoolMembership.Role.ADMIN, then=Value(0)),
                    When(role=SchoolMembership.Role.ACADEMIC_HEAD, then=Value(1)),
                    default=Value(2),
                    output_field=IntegerField(),
                )
            )
            .order_by("role_order", "id")
            .first()
        )

        classes = {}
        for name in ("JSS 1 Gold", "JSS 2 Gold"):
            classes[name], _ = SchoolClass.objects.update_or_create(
                school=school,
                academic_session=academic_session,
                name=name,
                defaults={"is_active": True},
            )

        subjects = {}
        for name, code in (
            ("Mathematics", "MATH"),
            ("English Language", "ENG"),
            ("Basic Science", "BSC"),
        ):
            subjects[name], _ = Subject.objects.update_or_create(
                school=school,
                name=name,
                defaults={"code": code, "is_active": True},
            )

        students = {}
        for admission_number, first_name, last_name, class_name in DEMO_STUDENTS:
            student, _ = Student.objects.update_or_create(
                school=school,
                admission_number=admission_number,
                defaults={
                    "first_name": first_name,
                    "last_name": last_name,
                    "admission_year": int(academic_session[:4]),
                    "school_class": classes[class_name],
                    "city": "Lagos",
                    "state": "Lagos",
                    "is_active": True,
                },
            )
            StudentEnrollment.objects.update_or_create(
                student=student,
                academic_session=academic_session,
                defaults={
                    "school": school,
                    "school_class": classes[class_name],
                    "status": StudentEnrollment.Status.ACTIVE,
                    "starts_at": today.replace(month=9, day=1)
                    if today.month >= 9
                    else today.replace(year=today.year - 1, month=9, day=1),
                    "ends_at": None,
                },
            )
            students[admission_number] = student

        math = subjects["Mathematics"]
        jss1 = classes["JSS 1 Gold"]
        jss1_students = [students[row[0]] for row in DEMO_STUDENTS if row[3] == "JSS 1 Gold"]
        assessments = (
            (
                "[Demo] Mathematics Baseline Check",
                today - timedelta(days=28),
                (("Fractions", "Compare and simplify fractions"), ("Algebraic expressions", "Collect like terms"), ("Word problems", "Translate a word problem into an operation")),
                ((4, 7, 5), (5, 8, 6), (6, 8, 7), (3, 7, 5), (5, 9, 6), (4, 8, 6), (7, 9, 8), (5, 7, 6)),
            ),
            (
                "[Demo] Mathematics Progress Check",
                today - timedelta(days=7),
                (("Fractions", "Solve fraction problems"), ("Algebraic expressions", "Use substitution"), ("Word problems", "Explain a multi-step solution")),
                ((6, 8, 6), (6, 9, 7), (7, 9, 8), (5, 8, 6), (6, 9, 7), (5, 8, 7), (8, 10, 8), (6, 8, 7)),
            ),
        )
        for title, assessment_date, question_specs, score_rows in assessments:
            assessment, _ = Assessment.objects.update_or_create(
                school=school,
                school_class=jss1,
                subject=math,
                academic_session=academic_session,
                term="First term",
                title=title,
                defaults={
                    "assessment_type": Assessment.Type.CA,
                    "maximum_score": Decimal("30.00"),
                    "weight": Decimal("20.00"),
                    "assessment_date": assessment_date,
                    "topics": "Fractions, Algebraic expressions, Word problems",
                    "status": Assessment.Status.PUBLISHED,
                    "created_by": creator,
                },
            )
            questions = []
            for number, (topic, objective) in enumerate(question_specs, start=1):
                question, _ = AssessmentQuestion.objects.update_or_create(
                    assessment=assessment,
                    number=number,
                    defaults={
                        "topic": topic,
                        "learning_objective": objective,
                        "maximum_score": Decimal("10.00"),
                    },
                )
                questions.append(question)
            for student, row in zip(jss1_students, score_rows):
                total = sum(row)
                AssessmentScore.objects.update_or_create(
                    assessment=assessment,
                    student=student,
                    defaults={
                        "score": Decimal(total),
                        "status": AssessmentScore.EntryStatus.ENTERED,
                        "entered_by": creator,
                    },
                )
                for question, score in zip(questions, row):
                    AssessmentQuestionScore.objects.update_or_create(
                        question=question,
                        student=student,
                        defaults={
                            "score": Decimal(score),
                            "status": AssessmentQuestionScore.EntryStatus.ENTERED,
                            "entered_by": creator,
                        },
                    )

        Assignment.objects.update_or_create(
            school=school,
            school_class=jss1,
            subject=math,
            title="[Demo] Fractions practice set",
            defaults={
                "instructions": "Complete questions 1–10 and show each step used to simplify the fractions.",
                "due_date": today + timedelta(days=5),
                "maximum_score": Decimal("20.00"),
                "counts_toward_ca": True,
                "status": Assignment.Status.PUBLISHED,
                "created_by": creator,
            },
        )
        Assignment.objects.update_or_create(
            school=school,
            school_class=jss1,
            subject=subjects["English Language"],
            title="[Demo] Descriptive writing",
            defaults={
                "instructions": "Write 300 words describing a memorable place in your community.",
                "due_date": today + timedelta(days=8),
                "maximum_score": Decimal("20.00"),
                "counts_toward_ca": False,
                "status": Assignment.Status.DRAFT,
                "created_by": creator,
            },
        )
        AcademicIntervention.objects.update_or_create(
            school=school,
            school_class=jss1,
            subject=math,
            topic="Fractions",
            title="[Demo] Small-group fractions clinic",
            defaults={
                "rationale": "Two question-level checks show that fractions remain the class's weakest recorded topic. A teacher should review the evidence before using this plan.",
                "baseline_average": Decimal("55.00"),
                "status": AcademicIntervention.Status.ACTIVE,
                "created_by": creator,
            },
        )

        self.stdout.write(
            self.style.SUCCESS(
                f'Seeded demo data for "{school.name}" ({academic_session}): '
                "2 classes, 3 subjects, 16 students, 2 assessments, 48 question scores, "
                "2 assignments, and 1 intervention."
            )
        )

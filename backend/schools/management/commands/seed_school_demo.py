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
    AttendanceRecord,
    School,
    SchoolClass,
    SchoolMembership,
    Student,
    StudentEnrollment,
    StudentIntervention,
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
        for index, (admission_number, first_name, last_name, class_name) in enumerate(DEMO_STUDENTS, start=1):
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
                    "address_line": f"{index} Learning Avenue",
                    "guardian_name": f"{last_name} Family Contact",
                    "guardian_phone": f"+234800000{index:04d}",
                    "guardian_email": f"guardian{index:02d}@example.com",
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
        jss2 = classes["JSS 2 Gold"]
        jss2_students = [students[row[0]] for row in DEMO_STUDENTS if row[3] == "JSS 2 Gold"]

        assessment_records = {}

        def seed_assessments(school_class, class_students, assessments):
            for title, assessment_date, question_specs, score_rows in assessments:
                assessment, _ = Assessment.objects.update_or_create(
                    school=school,
                    school_class=school_class,
                    subject=math,
                    academic_session=academic_session,
                    term="First term",
                    title=title,
                    defaults={
                        "assessment_type": Assessment.Type.CA,
                        "maximum_score": Decimal("30.00"),
                        "weight": Decimal("20.00"),
                        "assessment_date": assessment_date,
                        "topics": ", ".join(topic for topic, _objective in question_specs),
                        "status": Assessment.Status.PUBLISHED,
                        "created_by": creator,
                    },
                )
                assessment_records[title] = assessment
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
                for student, row in zip(class_students, score_rows):
                    AssessmentScore.objects.update_or_create(
                        assessment=assessment,
                        student=student,
                        defaults={
                            "score": Decimal(sum(row)),
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

        seed_assessments(jss1, jss1_students, (
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
        ))
        seed_assessments(jss2, jss2_students, (
            (
                "[Demo] JSS 2 Mathematics Baseline Check",
                today - timedelta(days=26),
                (("Linear equations", "Solve one-step equations"), ("Geometry", "Use angle relationships"), ("Data handling", "Interpret a simple chart")),
                ((8, 7, 8), (7, 6, 7), (9, 8, 8), (6, 7, 7), (8, 9, 8), (7, 8, 7), (9, 9, 8), (6, 6, 7)),
            ),
            (
                "[Demo] JSS 2 Mathematics Progress Check",
                today - timedelta(days=5),
                (("Linear equations", "Solve two-step equations"), ("Geometry", "Apply angle rules"), ("Data handling", "Compare values in charts")),
                ((9, 8, 9), (8, 7, 8), (10, 9, 9), (7, 8, 8), (9, 9, 9), (8, 9, 8), (10, 9, 9), (7, 7, 8)),
            ),
        ))

        attendance_dates = []
        attendance_day = today - timedelta(days=1)
        while len(attendance_dates) < 5:
            if attendance_day.weekday() < 5:
                attendance_dates.append(attendance_day)
            attendance_day -= timedelta(days=1)
        all_students = [students[row[0]] for row in DEMO_STUDENTS]
        for day_index, attendance_date in enumerate(attendance_dates):
            for student_index, student in enumerate(all_students):
                marker = (day_index + student_index) % 13
                attendance_status = AttendanceRecord.Status.ABSENT if marker == 0 else AttendanceRecord.Status.LATE if marker in {5, 9} else AttendanceRecord.Status.PRESENT
                AttendanceRecord.objects.update_or_create(
                    student=student,
                    date=attendance_date,
                    defaults={
                        "school": school,
                        "school_class": student.school_class,
                        "status": attendance_status,
                        "note": "Demo attendance record" if attendance_status != AttendanceRecord.Status.PRESENT else "",
                        "recorded_by": creator,
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
                "baseline_average": Decimal("48.75"),
                "baseline_assessment": assessment_records["[Demo] Mathematics Baseline Check"],
                "follow_up_assessment": assessment_records["[Demo] Mathematics Progress Check"],
                "expected_review_date": today + timedelta(days=7),
                "outcome_status": "improvement",
                "status": AcademicIntervention.Status.ACTIVE,
                "created_by": creator,
            },
        )
        StudentIntervention.objects.update_or_create(
            school=school,
            student=jss1_students[0],
            topic="Fractions",
            defaults={
                "school_class": jss1,
                "subject": math,
                "title": "[Demo] Amina fractions support plan",
                "rationale": "The learner's baseline and progress checks provide a concrete example of teacher-owned follow-up.",
                "baseline_average": Decimal("40.00"),
                "follow_up_average": Decimal("60.00"),
                "baseline_assessment": assessment_records["[Demo] Mathematics Baseline Check"],
                "follow_up_assessment": assessment_records["[Demo] Mathematics Progress Check"],
                "expected_review_date": today + timedelta(days=7),
                "outcome_status": "improvement",
                "status": StudentIntervention.Status.COMPLETE,
                "completed_at": timezone.now(),
                "created_by": creator,
            },
        )

        self.stdout.write(
            self.style.SUCCESS(
                f'Seeded demo data for "{school.name}" ({academic_session}): '
                "2 classes, 3 subjects, 16 students, 4 assessments, 96 question scores, "
                "80 attendance records, 2 assignments, 1 class intervention, and 1 learner support plan."
            )
        )

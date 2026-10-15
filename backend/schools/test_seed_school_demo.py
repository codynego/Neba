from io import StringIO

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from .models import (
    AcademicIntervention,
    Assessment,
    AssessmentQuestionScore,
    AssessmentScore,
    Assignment,
    School,
    SchoolClass,
    Student,
    StudentEnrollment,
    Subject,
)


class SeedSchoolDemoCommandTests(TestCase):
    def setUp(self):
        self.school = School.objects.create(name="Grok Academy", slug="grok-academy")

    def run_seed(self):
        output = StringIO()
        call_command(
            "seed_school_demo",
            school="grok academy",
            academic_session="2026/2027",
            stdout=output,
        )
        return output.getvalue()

    def test_seeds_an_existing_school_with_visible_academic_data(self):
        output = self.run_seed()

        self.assertIn('Seeded demo data for "Grok Academy"', output)
        self.assertEqual(School.objects.count(), 1)
        self.assertEqual(SchoolClass.objects.filter(school=self.school).count(), 2)
        self.assertEqual(Subject.objects.filter(school=self.school).count(), 3)
        self.assertEqual(Student.objects.filter(school=self.school).count(), 16)
        self.assertEqual(StudentEnrollment.objects.filter(school=self.school).count(), 16)
        self.assertEqual(Assessment.objects.filter(school=self.school).count(), 2)
        self.assertEqual(AssessmentScore.objects.count(), 16)
        self.assertEqual(AssessmentQuestionScore.objects.count(), 48)
        self.assertEqual(Assignment.objects.filter(school=self.school).count(), 2)
        self.assertEqual(AcademicIntervention.objects.filter(school=self.school).count(), 1)

    def test_rerunning_the_seed_is_idempotent(self):
        self.run_seed()
        original_student_ids = set(Student.objects.values_list("student_id", flat=True))

        self.run_seed()

        self.assertEqual(Student.objects.filter(school=self.school).count(), 16)
        self.assertEqual(Assessment.objects.filter(school=self.school).count(), 2)
        self.assertEqual(AssessmentQuestionScore.objects.count(), 48)
        self.assertEqual(original_student_ids, set(Student.objects.values_list("student_id", flat=True)))

    def test_refuses_to_create_a_missing_school(self):
        with self.assertRaisesMessage(CommandError, "No school named or slugged"):
            call_command("seed_school_demo", school="missing-school", stdout=StringIO())

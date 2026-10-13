from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from rest_framework.test import APITestCase

from .models import School, SchoolClass, SchoolMembership, Student, Subject, TeachingAssignment
from .permissions import class_subject_access_or_403


class SchoolAccessTests(TestCase):
    def setUp(self):
        self.teacher = get_user_model().objects.create_user(username="teacher", password="password", display_name="Teacher")
        self.admin = get_user_model().objects.create_user(username="admin", password="password", display_name="Admin")
        self.school = School.objects.create(name="North Star School", slug="north-star")
        self.other_school = School.objects.create(name="South Star School", slug="south-star")
        self.school_class = SchoolClass.objects.create(school=self.school, name="JSS 1", academic_session="2026/2027")
        self.subject = Subject.objects.create(school=self.school, name="Mathematics")
        self.other_subject = Subject.objects.create(school=self.school, name="English")
        self.teacher_membership = SchoolMembership.objects.create(school=self.school, user=self.teacher, role=SchoolMembership.Role.TEACHER, status=SchoolMembership.Status.ACTIVE)
        TeachingAssignment.objects.create(membership=self.teacher_membership, school_class=self.school_class, subject=self.subject)

    def test_teacher_can_access_only_the_assigned_class_subject_pair(self):
        membership = class_subject_access_or_403(self.teacher, self.school, self.school_class, self.subject)
        self.assertEqual(membership, self.teacher_membership)

    def test_teacher_cannot_access_an_unassigned_subject(self):
        with self.assertRaises(PermissionDenied):
            class_subject_access_or_403(self.teacher, self.school, self.school_class, self.other_subject)

    def test_admin_has_school_wide_class_subject_access(self):
        SchoolMembership.objects.create(school=self.school, user=self.admin, role=SchoolMembership.Role.ADMIN, status=SchoolMembership.Status.ACTIVE)
        membership = class_subject_access_or_403(self.admin, self.school, self.school_class, self.other_subject)
        self.assertEqual(membership.role, SchoolMembership.Role.ADMIN)

    def test_school_memberships_do_not_cross_tenant_boundaries(self):
        other_class = SchoolClass.objects.create(school=self.other_school, name="JSS 1", academic_session="2026/2027")
        other_subject = Subject.objects.create(school=self.other_school, name="Mathematics")
        with self.assertRaises(PermissionDenied):
            class_subject_access_or_403(self.teacher, self.other_school, other_class, other_subject)

    def test_expired_membership_is_denied(self):
        self.teacher_membership.expires_at = timezone.now() - timedelta(minutes=1)
        self.teacher_membership.save(update_fields=("expires_at",))
        with self.assertRaises(PermissionDenied):
            class_subject_access_or_403(self.teacher, self.school, self.school_class, self.subject)

    def test_assignment_cannot_mix_records_from_different_schools(self):
        other_subject = Subject.objects.create(school=self.other_school, name="Mathematics")
        with self.assertRaises(ValidationError):
            TeachingAssignment.objects.create(
                membership=self.teacher_membership,
                school_class=self.school_class,
                subject=other_subject,
            )


class SchoolSetupTests(APITestCase):
    def test_school_setup_requires_authentication(self):
        response = self.client.post("/api/schools/setup/", {"name": "Private School", "academic_session": "2026/2027"}, format="json")
        self.assertEqual(response.status_code, 401)

    def test_signed_in_user_can_create_a_school_workspace(self):
        user = get_user_model().objects.create_user(username="owner", password="password", display_name="Owner")
        self.client.force_authenticate(user)

        response = self.client.post("/api/schools/setup/", {
            "name": "Bright Future College",
            "academic_session": "2026/2027",
            "classes": ["JSS 1", "JSS 2"],
            "subjects": ["Mathematics", "English"],
        }, format="json")

        self.assertEqual(response.status_code, 201)
        school = School.objects.get(name="Bright Future College")
        self.assertEqual(school.memberships.get(user=user).role, SchoolMembership.Role.ADMIN)
        self.assertTrue(school.memberships.get(user=user).is_active)
        self.assertEqual(school.classes.count(), 2)
        self.assertEqual(school.subjects.count(), 2)

    def test_workspace_requires_authentication(self):
        response = self.client.get("/api/schools/workspace/")
        self.assertEqual(response.status_code, 401)

    def test_workspace_returns_only_the_callers_active_school(self):
        owner = get_user_model().objects.create_user(username="owner", password="password", display_name="Owner")
        other_user = get_user_model().objects.create_user(username="other", password="password", display_name="Other")
        owner_school = School.objects.create(name="Owner School", slug="owner-school")
        other_school = School.objects.create(name="Other School", slug="other-school")
        SchoolMembership.objects.create(school=owner_school, user=owner, role=SchoolMembership.Role.ADMIN, status=SchoolMembership.Status.ACTIVE)
        SchoolMembership.objects.create(school=other_school, user=other_user, role=SchoolMembership.Role.ADMIN, status=SchoolMembership.Status.ACTIVE)
        self.client.force_authenticate(owner)

        response = self.client.get("/api/schools/workspace/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["workspace"]["name"], "Owner School")
        self.assertNotEqual(response.data["workspace"]["id"], other_school.id)


class SchoolRosterTests(APITestCase):
    def setUp(self):
        self.admin = get_user_model().objects.create_user(username="roster-admin", password="password", display_name="Roster Admin")
        self.other = get_user_model().objects.create_user(username="roster-other", password="password", display_name="Roster Other")
        self.school = School.objects.create(name="Roster School", slug="roster-school")
        self.other_school = School.objects.create(name="Other Roster School", slug="other-roster-school")
        SchoolMembership.objects.create(school=self.school, user=self.admin, role=SchoolMembership.Role.ADMIN, status=SchoolMembership.Status.ACTIVE)
        SchoolMembership.objects.create(school=self.other_school, user=self.other, role=SchoolMembership.Role.ADMIN, status=SchoolMembership.Status.ACTIVE)
        self.school_class = SchoolClass.objects.create(school=self.school, name="JSS 1", academic_session="2026/2027")
        self.other_class = SchoolClass.objects.create(school=self.other_school, name="JSS 1", academic_session="2026/2027")
        self.client.force_authenticate(self.admin)

    def test_admin_can_create_and_read_own_school_records(self):
        response = self.client.post("/api/schools/roster/", {"action": "class", "name": "JSS 2", "academic_session": "2026/2027"}, format="json")
        self.assertEqual(response.status_code, 201)
        response = self.client.post("/api/schools/roster/", {"action": "subject", "name": "Mathematics", "code": "MTH"}, format="json")
        self.assertEqual(response.status_code, 201)
        response = self.client.post("/api/schools/roster/", {"action": "student", "first_name": "Ada", "last_name": "Okafor", "admission_number": "R-001", "school_class": self.school_class.id}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Student.objects.get().school_id, self.school.id)
        response = self.client.get("/api/schools/roster/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["students"]), 1)
        self.assertEqual(response.data["students"][0]["full_name"], "Ada Okafor")

    def test_admin_cannot_add_student_to_another_school_class(self):
        response = self.client.post("/api/schools/roster/", {"action": "student", "first_name": "Ada", "last_name": "Okafor", "school_class": self.other_class.id}, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Student.objects.exists())

    def test_admin_can_add_an_existing_neba_user_to_the_school(self):
        self.other.email = "teacher@example.com"
        self.other.save(update_fields=("email",))
        response = self.client.post("/api/schools/roster/", {"action": "member", "email": "teacher@example.com", "role": "teacher"}, format="json")
        self.assertEqual(response.status_code, 201)
        membership = SchoolMembership.objects.get(school=self.school, user=self.other)
        self.assertEqual(membership.role, SchoolMembership.Role.TEACHER)
        self.assertEqual(membership.status, SchoolMembership.Status.ACTIVE)

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from rest_framework.test import APITestCase

from .models import AcademicIntervention, Assessment, AssessmentImport, AssessmentQuestion, AssessmentQuestionScore, AssessmentScore, AttendanceRecord, ClassTeacherAssignment, School, SchoolClass, SchoolMembership, Student, StudentIntervention, Subject, TeachingAssignment
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

    def test_class_teacher_can_access_every_subject_in_their_class(self):
        ClassTeacherAssignment.objects.create(membership=self.teacher_membership, school_class=self.school_class)
        membership = class_subject_access_or_403(self.teacher, self.school, self.school_class, self.other_subject)
        self.assertEqual(membership, self.teacher_membership)

    def test_class_teacher_without_subject_can_access_class_level_scope(self):
        self.teacher_membership.teaching_assignments.all().delete()
        ClassTeacherAssignment.objects.create(membership=self.teacher_membership, school_class=self.school_class)
        membership = class_subject_access_or_403(self.teacher, self.school, self.school_class)
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

    def test_member_can_select_one_of_their_school_workspaces(self):
        owner = get_user_model().objects.create_user(username="multi-owner", password="password", display_name="Owner")
        first_school = School.objects.create(name="First Academy", slug="first-academy")
        second_school = School.objects.create(name="Second Academy", slug="second-academy")
        SchoolMembership.objects.create(school=first_school, user=owner, role=SchoolMembership.Role.ADMIN, status=SchoolMembership.Status.ACTIVE)
        SchoolMembership.objects.create(school=second_school, user=owner, role=SchoolMembership.Role.ADMIN, status=SchoolMembership.Status.ACTIVE)
        self.client.force_authenticate(owner)

        response = self.client.get(f"/api/schools/workspace/?school_id={second_school.id}")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["workspace"]["id"], second_school.id)
        self.assertEqual(len(response.data["workspaces"]), 2)


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

    def test_admin_can_preview_and_import_a_roster_without_creating_duplicates(self):
        csv_file = SimpleUploadedFile("students.csv", b"First Name,Last Name,Class,Admission Number\nAda,Okafor,JSS 1,R-001\nTobi,Bello,JSS 1,R-002\n", content_type="text/csv")
        preview = self.client.post("/api/schools/roster/", {"action": "student_import_file_preview", "file": csv_file}, format="multipart")
        self.assertEqual(preview.status_code, 200)
        self.assertTrue(preview.data["valid"])
        self.assertEqual(preview.data["valid_count"], 2)
        imported = self.client.post("/api/schools/roster/", {"action": "student_import", "rows": preview.data["rows"], "source_name": "students.csv"}, format="json")
        self.assertEqual(imported.status_code, 201)
        self.assertEqual(imported.data["created_count"], 2)
        self.assertEqual(Student.objects.filter(school=self.school).count(), 2)
        repeat = self.client.post("/api/schools/roster/", {"action": "student_import", "rows": preview.data["rows"], "source_name": "students.csv"}, format="json")
        self.assertEqual(repeat.status_code, 201)
        self.assertEqual(repeat.data["matched_count"], 2)
        self.assertEqual(Student.objects.filter(school=self.school).count(), 2)

    def test_roster_includes_academic_and_attendance_summary(self):
        membership = SchoolMembership.objects.get(school=self.school, user=self.admin)
        student = Student.objects.create(school=self.school, school_class=self.school_class, first_name="Ada", last_name="Okafor")
        subject = Subject.objects.create(school=self.school, name="Mathematics")
        assessment = Assessment.objects.create(school=self.school, school_class=self.school_class, subject=subject, academic_session="2026/2027", term="First term", title="CA 1", assessment_type=Assessment.Type.CA, maximum_score=20, status=Assessment.Status.PUBLISHED, created_by=membership)
        AssessmentScore.objects.create(assessment=assessment, student=student, score=15, status=AssessmentScore.EntryStatus.ENTERED, entered_by=membership)
        AttendanceRecord.objects.create(school=self.school, school_class=self.school_class, student=student, date="2026-10-14", status=AttendanceRecord.Status.PRESENT, recorded_by=membership)
        AttendanceRecord.objects.create(school=self.school, school_class=self.school_class, student=student, date="2026-10-15", status=AttendanceRecord.Status.ABSENT, recorded_by=membership)

        response = self.client.get("/api/schools/roster/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["students"][0]["academic_average"], 75.0)
        self.assertEqual(response.data["students"][0]["assessments_recorded"], 1)
        self.assertEqual(response.data["students"][0]["attendance_rate"], 50.0)

    def test_student_receives_public_id_and_can_be_updated_only_in_own_school(self):
        student = Student.objects.create(school=self.school, school_class=self.school_class, first_name="Ada", last_name="Okafor")
        response = self.client.get(f"/api/schools/students/{student.public_id}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["public_id"], str(student.public_id))
        self.assertEqual(
            response.data["student_id"],
            f"{self.school.student_id_prefix}-{student.admission_year}-0001",
        )

        response = self.client.patch(f"/api/schools/students/{student.public_id}/", {"first_name": "Adanna", "guardian_name": "Mrs Okafor", "guardian_phone": "+2348012345678"}, format="json")
        self.assertEqual(response.status_code, 200)
        student.refresh_from_db()
        self.assertEqual(student.first_name, "Adanna")
        self.assertEqual(student.guardian_name, "Mrs Okafor")

    def test_admin_can_add_an_existing_neba_user_to_the_school(self):
        self.other.email = "teacher@example.com"
        self.other.save(update_fields=("email",))
        response = self.client.post("/api/schools/roster/", {"action": "member", "email": "teacher@example.com", "role": "teacher"}, format="json")
        self.assertEqual(response.status_code, 201)
        membership = SchoolMembership.objects.get(school=self.school, user=self.other)
        self.assertEqual(membership.role, SchoolMembership.Role.TEACHER)
        self.assertEqual(membership.status, SchoolMembership.Status.ACTIVE)

    def test_admin_can_update_a_member_role_by_public_id(self):
        membership = SchoolMembership.objects.create(school=self.school, user=self.other, role=SchoolMembership.Role.TEACHER, status=SchoolMembership.Status.ACTIVE)
        response = self.client.patch(f"/api/schools/members/{membership.public_id}/", {"role": "academic_head"}, format="json")
        self.assertEqual(response.status_code, 200)
        membership.refresh_from_db()
        self.assertEqual(membership.role, SchoolMembership.Role.ACADEMIC_HEAD)

    def test_admin_can_assign_class_and_subject_responsibilities(self):
        membership = SchoolMembership.objects.create(school=self.school, user=self.other, role=SchoolMembership.Role.TEACHER, status=SchoolMembership.Status.ACTIVE)
        subject = Subject.objects.create(school=self.school, name="Mathematics")

        response = self.client.patch(
            f"/api/schools/members/{membership.public_id}/",
            {"action": "add_assignment", "type": "class_teacher", "class_id": self.school_class.id},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(ClassTeacherAssignment.objects.filter(membership=membership, school_class=self.school_class, is_active=True).exists())

        response = self.client.patch(
            f"/api/schools/members/{membership.public_id}/",
            {"action": "add_assignment", "type": "subject_teacher", "class_id": self.school_class.id, "subject_id": subject.id},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual({item["type"] for item in response.data["assignments"]}, {"class_teacher", "subject_teacher"})
        self.assertTrue(TeachingAssignment.objects.filter(membership=membership, school_class=self.school_class, subject=subject, is_active=True).exists())

    def test_changing_teacher_role_revokes_active_assignments(self):
        membership = SchoolMembership.objects.create(school=self.school, user=self.other, role=SchoolMembership.Role.TEACHER, status=SchoolMembership.Status.ACTIVE)
        assignment = ClassTeacherAssignment.objects.create(membership=membership, school_class=self.school_class)

        response = self.client.patch(f"/api/schools/members/{membership.public_id}/", {"action": "update_role", "role": "academic_head"}, format="json")

        self.assertEqual(response.status_code, 200)
        assignment.refresh_from_db()
        self.assertFalse(assignment.is_active)


class AttendanceTests(APITestCase):
    def setUp(self):
        self.admin = get_user_model().objects.create_user(username="attendance-admin", password="password")
        self.teacher = get_user_model().objects.create_user(username="attendance-teacher", password="password")
        self.school = School.objects.create(name="Attendance School", slug="attendance-school")
        self.school_class = SchoolClass.objects.create(school=self.school, name="JSS 1", academic_session="2026/2027")
        self.other_class = SchoolClass.objects.create(school=self.school, name="JSS 2", academic_session="2026/2027")
        self.student = Student.objects.create(school=self.school, school_class=self.school_class, first_name="Ada", last_name="Okafor")
        self.admin_membership = SchoolMembership.objects.create(school=self.school, user=self.admin, role=SchoolMembership.Role.ADMIN, status=SchoolMembership.Status.ACTIVE)
        self.teacher_membership = SchoolMembership.objects.create(school=self.school, user=self.teacher, role=SchoolMembership.Role.TEACHER, status=SchoolMembership.Status.ACTIVE)

    def test_admin_can_save_and_update_a_daily_class_register(self):
        self.client.force_authenticate(self.admin)
        payload = {"class_id": self.school_class.id, "date": "2026-10-15", "rows": [{"student_id": self.student.id, "status": "present", "note": ""}]}
        response = self.client.post("/api/schools/attendance/", payload, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["saved"], 1)

        payload["rows"][0]["status"] = "late"
        response = self.client.post("/api/schools/attendance/", payload, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(AttendanceRecord.objects.get().status, AttendanceRecord.Status.LATE)
        self.assertEqual(AttendanceRecord.objects.count(), 1)

    def test_assigned_teacher_can_read_and_mark_attendance(self):
        ClassTeacherAssignment.objects.create(membership=self.teacher_membership, school_class=self.school_class)
        self.client.force_authenticate(self.teacher)
        response = self.client.get(f"/api/schools/attendance/?class_id={self.school_class.id}&date=2026-10-15")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["rows"][0]["status"], "unmarked")
        response = self.client.post("/api/schools/attendance/", {"class_id": self.school_class.id, "date": "2026-10-15", "rows": [{"student_id": self.student.id, "status": "present"}]}, format="json")
        self.assertEqual(response.status_code, 200)

    def test_unassigned_teacher_cannot_access_another_class_register(self):
        ClassTeacherAssignment.objects.create(membership=self.teacher_membership, school_class=self.other_class)
        self.client.force_authenticate(self.teacher)
        response = self.client.get(f"/api/schools/attendance/?class_id={self.school_class.id}&date=2026-10-15")
        self.assertEqual(response.status_code, 403)

    def test_student_attendance_summary_ignores_excused_days_in_rate(self):
        AttendanceRecord.objects.create(school=self.school, school_class=self.school_class, student=self.student, date="2026-10-13", status=AttendanceRecord.Status.PRESENT, recorded_by=self.admin_membership)
        AttendanceRecord.objects.create(school=self.school, school_class=self.school_class, student=self.student, date="2026-10-14", status=AttendanceRecord.Status.ABSENT, recorded_by=self.admin_membership)
        AttendanceRecord.objects.create(school=self.school, school_class=self.school_class, student=self.student, date="2026-10-15", status=AttendanceRecord.Status.EXCUSED, recorded_by=self.admin_membership)
        self.client.force_authenticate(self.admin)
        response = self.client.get(f"/api/schools/attendance/?student_id={self.student.public_id}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["summary"]["attendance_rate"], 50.0)
        self.assertEqual(response.data["summary"]["days_recorded"], 3)


class AcademicIntelligenceTests(APITestCase):
    def setUp(self):
        self.admin = get_user_model().objects.create_user(username="insight-admin", password="password")
        self.school = School.objects.create(name="Insight School", slug="insight-school")
        self.membership = SchoolMembership.objects.create(school=self.school, user=self.admin, role=SchoolMembership.Role.ADMIN, status=SchoolMembership.Status.ACTIVE)
        self.school_class = SchoolClass.objects.create(school=self.school, name="JSS 2", academic_session="2026/2027")
        self.subject = Subject.objects.create(school=self.school, name="Mathematics")
        first = Student.objects.create(school=self.school, school_class=self.school_class, first_name="Ada", last_name="Okafor")
        second = Student.objects.create(school=self.school, school_class=self.school_class, first_name="Tobi", last_name="Bello")
        assessment = Assessment.objects.create(school=self.school, school_class=self.school_class, subject=self.subject, academic_session="2026/2027", term="First term", title="CA 1", assessment_type=Assessment.Type.CA, maximum_score=20, topics="Fractions", status=Assessment.Status.PUBLISHED, created_by=self.membership)
        AssessmentScore.objects.create(assessment=assessment, student=first, score=8, status=AssessmentScore.EntryStatus.ENTERED, entered_by=self.membership)
        AssessmentScore.objects.create(assessment=assessment, student=second, score=10, status=AssessmentScore.EntryStatus.ENTERED, entered_by=self.membership)
        self.client.force_authenticate(self.admin)

    def test_topic_tagged_scores_return_an_explainable_signal(self):
        response = self.client.get(f"/api/schools/intelligence/?school_id={self.school.id}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["summary"]["overall_average"], 45.0)
        self.assertEqual(response.data["topic_signals"][0]["topic"], "Fractions")
        self.assertEqual(response.data["topic_signals"][0]["average"], 45.0)
        self.assertIn("topic-tagged scores", response.data["topic_signals"][0]["evidence"])

    def test_member_can_create_a_teacher_reviewed_intervention_draft(self):
        response = self.client.post(f"/api/schools/intelligence/?school_id={self.school.id}", {"class_id": self.school_class.id, "subject_id": self.subject.id, "topic": "Fractions", "baseline_average": 45}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(AcademicIntervention.objects.get().status, AcademicIntervention.Status.DRAFT)

    def test_assessment_moves_through_review_and_publish_workflow(self):
        assessment = Assessment.objects.create(school=self.school, school_class=self.school_class, subject=self.subject, academic_session="2026/2027", term="First term", title="CA 2", assessment_type=Assessment.Type.CA, maximum_score=20, created_by=self.membership)
        url = f"/api/schools/teaching-work/?school_id={self.school.id}&class_id={self.school_class.id}&subject_id={self.subject.id}"
        response = self.client.post(url, {"action": "assessment_status", "assessment_id": assessment.id, "status": "submitted"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], Assessment.Status.SUBMITTED)
        response = self.client.post(url, {"action": "assessment_status", "assessment_id": assessment.id, "status": "reviewed"}, format="json")
        self.assertEqual(response.status_code, 200)
        response = self.client.post(url, {"action": "assessment_status", "assessment_id": assessment.id, "status": "published"}, format="json")
        self.assertEqual(response.status_code, 200)
        assessment.refresh_from_db()
        self.assertEqual(assessment.status, Assessment.Status.PUBLISHED)

    def test_teacher_can_save_question_topic_mapping_and_import_validated_csv_rows(self):
        assessment = Assessment.objects.get(school=self.school)
        assessment.status = Assessment.Status.DRAFT
        assessment.save(update_fields=("status",))
        response = self.client.post(f"/api/schools/teaching-work/?school_id={self.school.id}&class_id={self.school_class.id}&subject_id={self.subject.id}", {"action": "questions", "assessment_id": assessment.id, "questions": [{"number": 1, "topic": "Equivalent fractions", "learning_objective": "Recognise equivalent fractions", "maximum_score": 10}, {"number": 2, "topic": "Adding fractions", "maximum_score": 10}]}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(AssessmentQuestion.objects.filter(assessment=assessment).count(), 2)
        first = Student.objects.get(first_name="Ada")
        response = self.client.post(f"/api/schools/teaching-work/?school_id={self.school.id}&class_id={self.school_class.id}&subject_id={self.subject.id}", {"action": "score_import", "assessment_id": assessment.id, "rows": [{"student_id": first.student_id, "score": "14"}]}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["saved"], 1)
        self.assertEqual(AssessmentScore.objects.get(assessment=assessment, student=first).score, 14)

        question = AssessmentQuestion.objects.get(assessment=assessment, number=1)
        response = self.client.post(f"/api/schools/teaching-work/?school_id={self.school.id}&class_id={self.school_class.id}&subject_id={self.subject.id}", {"action": "question_scores", "assessment_id": assessment.id, "scores": [{"question_id": question.id, "student_id": first.id, "score": "4", "status": "entered"}]}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(AssessmentQuestionScore.objects.get(question=question, student=first).score, 4)
        assessment.status = Assessment.Status.PUBLISHED
        assessment.save(update_fields=("status",))
        response = self.client.get(f"/api/schools/intelligence/?school_id={self.school.id}")
        self.assertEqual(response.data["topic_signals"][0]["topic"], "Equivalent fractions")
        self.assertEqual(response.data["topic_signals"][0]["average"], 40.0)
        self.assertIn("question-level scores", response.data["topic_signals"][0]["evidence"])

    def test_result_file_preview_validates_columns_and_records_import_provenance(self):
        assessment = Assessment.objects.get(school=self.school)
        assessment.status = Assessment.Status.DRAFT
        assessment.save(update_fields=("status",))
        first = Student.objects.get(school=self.school, first_name="Ada")
        csv_file = SimpleUploadedFile("term-results.csv", b"Student Number,Marks\n" + f"{first.student_id},14\n".encode(), content_type="text/csv")
        url = f"/api/schools/teaching-work/?school_id={self.school.id}&class_id={self.school_class.id}&subject_id={self.subject.id}"
        preview = self.client.post(url, {"action": "score_import_file_preview", "assessment_id": assessment.id, "file": csv_file}, format="multipart")
        self.assertEqual(preview.status_code, 200)
        self.assertTrue(preview.data["valid"])
        self.assertEqual(preview.data["suggested_mapping"]["score_column"], "Marks")
        imported = self.client.post(url, {"action": "score_import", "assessment_id": assessment.id, "rows": preview.data["rows"], "source_name": "term-results.csv"}, format="json")
        self.assertEqual(imported.status_code, 200)
        self.assertEqual(imported.data["saved"], 1)
        self.assertEqual(AssessmentImport.objects.get(id=imported.data["import_id"]).source_name, "term-results.csv")

    @override_settings(OPENAI_API_KEY="")
    def test_teaching_assistant_returns_an_evidence_grounded_review_draft_without_ai_configuration(self):
        response = self.client.post(
            f"/api/schools/teaching-assistant/?school_id={self.school.id}",
            {"class_id": self.school_class.id, "subject_id": self.subject.id, "topic": "Fractions", "kind": "revision"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["source"], "structured_fallback")
        self.assertEqual(response.data["evidence"]["average"], 45.0)
        self.assertIn("teacher-review", response.data["teacher_note"])

    @override_settings(OPENAI_API_KEY="")
    def test_class_teacher_sees_all_subjects_but_subject_teacher_sees_only_assigned_subject(self):
        english = Subject.objects.create(school=self.school, name="English")
        other_class = SchoolClass.objects.create(school=self.school, name="JSS 3", academic_session="2026/2027")
        teacher = get_user_model().objects.create_user(username="scope-teacher", password="password")
        membership = SchoolMembership.objects.create(school=self.school, user=teacher, role=SchoolMembership.Role.TEACHER, status=SchoolMembership.Status.ACTIVE)
        TeachingAssignment.objects.create(membership=membership, school_class=self.school_class, subject=self.subject)
        other_student = Student.objects.create(school=self.school, school_class=other_class, first_name="Musa", last_name="Bello")
        english_assessment = Assessment.objects.create(school=self.school, school_class=self.school_class, subject=english, academic_session="2026/2027", term="First term", title="English CA", assessment_type=Assessment.Type.CA, maximum_score=20, topics="Grammar", status=Assessment.Status.PUBLISHED, created_by=self.membership)
        AssessmentScore.objects.create(assessment=english_assessment, student=Student.objects.first(), score=18, status=AssessmentScore.EntryStatus.ENTERED, entered_by=self.membership)
        other_assessment = Assessment.objects.create(school=self.school, school_class=other_class, subject=self.subject, academic_session="2026/2027", term="First term", title="Other class CA", assessment_type=Assessment.Type.CA, maximum_score=20, topics="Fractions", status=Assessment.Status.PUBLISHED, created_by=self.membership)
        AssessmentScore.objects.create(assessment=other_assessment, student=other_student, score=20, status=AssessmentScore.EntryStatus.ENTERED, entered_by=self.membership)

        self.client.force_authenticate(teacher)
        response = self.client.get(f"/api/schools/intelligence/?school_id={self.school.id}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual({item["subject_name"] for item in response.data["topic_signals"]}, {"Mathematics"})
        response = self.client.post(f"/api/schools/teaching-assistant/?school_id={self.school.id}", {"class_id": self.school_class.id, "subject_id": english.id, "topic": "Grammar", "kind": "revision"}, format="json")
        self.assertEqual(response.status_code, 403)

        ClassTeacherAssignment.objects.create(membership=membership, school_class=self.school_class)
        response = self.client.get(f"/api/schools/intelligence/?school_id={self.school.id}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual({item["subject_name"] for item in response.data["topic_signals"]}, {"Mathematics", "English"})
        response = self.client.post(f"/api/schools/teaching-assistant/?school_id={self.school.id}", {"class_id": self.school_class.id, "subject_id": english.id, "topic": "Grammar", "kind": "revision"}, format="json")
        self.assertEqual(response.status_code, 200)
        response = self.client.get(f"/api/schools/intelligence/?school_id={self.school.id}&class_id={other_class.id}")
        self.assertEqual(response.data["topic_signals"], [])


class StudentIntelligenceTests(APITestCase):
    def setUp(self):
        self.admin = get_user_model().objects.create_user(username="learner-insight-admin", password="password")
        self.school = School.objects.create(name="Learner Insight School", slug="learner-insight-school")
        self.membership = SchoolMembership.objects.create(school=self.school, user=self.admin, role=SchoolMembership.Role.ADMIN, status=SchoolMembership.Status.ACTIVE)
        self.school_class = SchoolClass.objects.create(school=self.school, name="JSS 3", academic_session="2026/2027")
        self.subject = Subject.objects.create(school=self.school, name="Mathematics")
        self.student = Student.objects.create(school=self.school, school_class=self.school_class, first_name="Ada", last_name="Okafor")
        for index, score in enumerate((8, 12), start=1):
            assessment = Assessment.objects.create(school=self.school, school_class=self.school_class, subject=self.subject, academic_session="2026/2027", term="First term" if index == 1 else "Second term", title=f"CA {index}", assessment_type=Assessment.Type.CA, maximum_score=20, topics="Fractions", status=Assessment.Status.PUBLISHED, created_by=self.membership)
            AssessmentScore.objects.create(assessment=assessment, student=self.student, score=score, status=AssessmentScore.EntryStatus.ENTERED, entered_by=self.membership)
            question = AssessmentQuestion.objects.create(assessment=assessment, number=1, topic="Equivalent fractions", maximum_score=20)
            AssessmentQuestionScore.objects.create(question=question, student=self.student, score=score, status=AssessmentQuestionScore.EntryStatus.ENTERED, entered_by=self.membership)
        self.client.force_authenticate(self.admin)

    def test_student_profile_returns_explainable_topic_signal_and_history(self):
        response = self.client.get(f"/api/schools/students/{self.student.public_id}/intelligence/?school_id={self.school.id}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["summary"]["overall_average"], 50.0)
        self.assertEqual(response.data["summary"]["assessments_recorded"], 2)
        self.assertEqual(response.data["topic_signals"][0]["topic"], "Equivalent fractions")
        self.assertEqual(response.data["topic_signals"][0]["confidence"], "sufficient")
        self.assertEqual(response.data["topic_signals"][0]["status"], "needs_support")
        self.assertEqual(len(response.data["topic_signals"][0]["evidence_sources"]), 2)
        self.assertEqual(response.data["topic_signals"][0]["evidence_sources"][0]["evidence_type"], "question-level")
        self.assertEqual(len(response.data["assessment_history"]), 2)

    def test_student_intelligence_can_be_filtered_by_term(self):
        response = self.client.get(f"/api/schools/students/{self.student.public_id}/intelligence/?school_id={self.school.id}&term=First%20term")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["filters"]["selected_term"], "First term")
        self.assertEqual(len(response.data["assessment_history"]), 1)
        self.assertEqual(response.data["topic_signals"][0]["confidence"], "insufficient")

    def test_school_can_configure_intelligence_benchmarks(self):
        settings_url = f"/api/schools/roster/?school_id={self.school.id}"
        response = self.client.post(settings_url, {"action": "intelligence_benchmarks", "review_threshold": 70, "strength_threshold": 85}, format="json")
        self.assertEqual(response.status_code, 200)
        intelligence = self.client.get(f"/api/schools/students/{self.student.public_id}/intelligence/?school_id={self.school.id}")
        self.assertEqual(intelligence.data["summary"]["benchmarks"], {"review_threshold": 70.0, "strength_threshold": 85.0})
        self.assertEqual(intelligence.data["topic_signals"][0]["status"], "needs_support")

    def test_single_record_signal_is_marked_insufficient(self):
        AssessmentQuestionScore.objects.filter(student=self.student).delete()
        AssessmentScore.objects.filter(student=self.student).exclude(assessment__title="CA 1").delete()
        response = self.client.get(f"/api/schools/students/{self.student.public_id}/intelligence/?school_id={self.school.id}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["topic_signals"][0]["confidence"], "insufficient")

    def test_member_can_create_and_complete_a_student_support_plan(self):
        url = f"/api/schools/students/{self.student.public_id}/intelligence/?school_id={self.school.id}"
        response = self.client.post(url, {"subject_id": self.subject.id, "topic": "Equivalent fractions", "baseline_average": 50}, format="json")
        self.assertEqual(response.status_code, 201)
        plan = StudentIntervention.objects.get()
        self.assertEqual(plan.status, StudentIntervention.Status.DRAFT)

        response = self.client.patch(url, {"intervention_id": plan.id, "status": "complete"}, format="json")
        self.assertEqual(response.status_code, 200)
        plan.refresh_from_db()
        self.assertEqual(plan.status, StudentIntervention.Status.COMPLETE)
        self.assertEqual(float(plan.follow_up_average), 50.0)

    def test_support_plan_can_link_baseline_and_follow_up_assessments(self):
        baseline = Assessment.objects.get(title="CA 1")
        follow_up = Assessment.objects.get(title="CA 2")
        url = f"/api/schools/students/{self.student.public_id}/intelligence/?school_id={self.school.id}"
        response = self.client.post(url, {"subject_id": self.subject.id, "topic": "Fractions", "baseline_assessment_id": baseline.id, "expected_review_date": "2026-11-20"}, format="json")
        self.assertEqual(response.status_code, 201)
        plan = StudentIntervention.objects.get()
        self.assertEqual(plan.baseline_assessment_id, baseline.id)
        self.assertEqual(float(plan.baseline_average), 40.0)
        response = self.client.patch(url, {"intervention_id": plan.id, "status": "complete", "follow_up_assessment_id": follow_up.id}, format="json")
        self.assertEqual(response.status_code, 200)
        plan.refresh_from_db()
        self.assertEqual(plan.follow_up_assessment_id, follow_up.id)
        self.assertEqual(float(plan.follow_up_average), 60.0)
        self.assertEqual(plan.outcome_status, "improvement")

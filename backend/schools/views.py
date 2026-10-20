import json
import csv
import io
import re
from datetime import date

import requests

from django.conf import settings
from django.db import transaction
from django.db.models import Avg, Count, ExpressionWrapper, F, FloatField, Q
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import permissions, serializers, status
from rest_framework import parsers
from rest_framework.exceptions import PermissionDenied
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AcademicIntervention, Assessment, AssessmentImport, AssessmentQuestion, AssessmentQuestionScore, AssessmentScore, Assignment, AttendanceRecord, ClassTeacherAssignment, School, SchoolClass, SchoolMembership, Student, StudentIntervention, StudentRosterImport, Subject, TeachingAssignment
from .permissions import active_membership_or_403, class_subject_access_or_403


def _current_teacher_scope(membership):
    """Return active class ids and subject/class pairs visible to a teacher."""
    today = timezone.localdate()
    current = Q(is_active=True, starts_at__lte=today) & (Q(ends_at__isnull=True) | Q(ends_at__gte=today))
    class_ids = set(membership.class_teacher_assignments.filter(current).values_list("school_class_id", flat=True))
    pairs = set(membership.teaching_assignments.filter(current).values_list("school_class_id", "subject_id"))
    class_ids.update(class_id for class_id, _subject_id in pairs)
    return class_ids, pairs


def _teacher_scope_q(membership):
    today = timezone.localdate()
    current = Q(is_active=True, starts_at__lte=today) & (Q(ends_at__isnull=True) | Q(ends_at__gte=today))
    class_teacher_ids = set(membership.class_teacher_assignments.filter(current).values_list("school_class_id", flat=True))
    _class_ids, pairs = _current_teacher_scope(membership)
    scope = Q(school_class_id__in=class_teacher_ids)
    for class_id, subject_id in pairs:
        scope |= Q(school_class_id=class_id, subject_id=subject_id)
    return scope if _class_ids else Q(pk__in=[])


class SchoolSetupSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=180)
    academic_session = serializers.CharField(max_length=40)
    classes = serializers.ListField(child=serializers.CharField(max_length=100), required=False, default=list)
    subjects = serializers.ListField(child=serializers.CharField(max_length=100), required=False, default=list)

    def validate(self, attrs):
        attrs["name"] = attrs["name"].strip()
        attrs["academic_session"] = attrs["academic_session"].strip()
        attrs["classes"] = list(dict.fromkeys(value.strip() for value in attrs["classes"] if value.strip()))
        attrs["subjects"] = list(dict.fromkeys(value.strip() for value in attrs["subjects"] if value.strip()))
        if not attrs["name"]:
            raise serializers.ValidationError({"name": "Enter your school name."})
        if not attrs["academic_session"]:
            raise serializers.ValidationError({"academic_session": "Enter the current academic session."})
        return attrs


def unique_school_slug(name):
    base = slugify(name)[:45] or "school"
    slug = base
    suffix = 2
    while School.objects.filter(slug=slug).exists():
        slug = f"{base[:40]}-{suffix}"
        suffix += 1
    return slug


def active_workspace_membership(request):
    """Resolve a requested workspace, always constrained to the signed-in member."""
    memberships = SchoolMembership.objects.select_related("school").filter(
        user=request.user,
        status=SchoolMembership.Status.ACTIVE,
    ).filter(Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now())).order_by("created_at")
    requested_id = request.query_params.get("school_id") or request.data.get("school_id")
    if requested_id:
        membership = memberships.filter(school_id=requested_id).first()
        if membership is None:
            raise PermissionDenied("You do not have access to this school.")
        return membership
    return memberships.first()


def workspace_payload(membership):
    school = membership.school
    classes = school.classes.filter(is_active=True)
    subjects = school.subjects.filter(is_active=True)
    students = school.students.filter(is_active=True)
    if membership.role == SchoolMembership.Role.TEACHER:
        class_ids, assigned_pairs = _current_teacher_scope(membership)
        classes = classes.filter(id__in=class_ids)
        students = students.filter(school_class_id__in=class_ids)
        has_class_teacher_scope = membership.class_teacher_assignments.filter(school_class_id__in=class_ids, is_active=True).exists()
        if not has_class_teacher_scope:
            subjects = subjects.filter(id__in={subject_id for _class_id, subject_id in assigned_pairs})
    return {
        "id": school.id,
        "name": school.name,
        "slug": school.slug,
        "role": membership.role,
        "classes_count": classes.count(),
        "subjects_count": subjects.count(),
        "students_count": students.count(),
        "intelligence_benchmarks": {
            "review_threshold": float(school.intelligence_review_threshold),
            "strength_threshold": float(school.intelligence_strength_threshold),
        },
    }


class SchoolSetupView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "school_setup"

    @transaction.atomic
    def post(self, request):
        serializer = SchoolSetupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        school = School.objects.create(name=data["name"], slug=unique_school_slug(data["name"]))
        SchoolMembership.objects.create(school=school, user=request.user, role=SchoolMembership.Role.ADMIN, status=SchoolMembership.Status.ACTIVE)
        SchoolClass.objects.bulk_create([SchoolClass(school=school, name=name, academic_session=data["academic_session"]) for name in data["classes"]])
        Subject.objects.bulk_create([Subject(school=school, name=name) for name in data["subjects"]])
        return Response({"id": school.id, "name": school.name, "slug": school.slug}, status=201)


class SchoolWorkspaceView(APIView):
    """Return only the caller's first active school workspace, never another school's data."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        membership = active_workspace_membership(request)
        if membership is None:
            return Response({"workspace": None, "workspaces": []})
        memberships = SchoolMembership.objects.select_related("school").filter(
            user=request.user, status=SchoolMembership.Status.ACTIVE,
        ).filter(Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now())).order_by("created_at")
        return Response({"workspace": workspace_payload(membership), "workspaces": [workspace_payload(item) for item in memberships]})


class StudentSerializer(serializers.ModelSerializer):
    class_name = serializers.CharField(source="school_class.name", read_only=True)
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = Student
        fields = ("id", "public_id", "student_id", "admission_year", "first_name", "last_name", "full_name", "admission_number", "address_line", "city", "state", "guardian_name", "guardian_phone", "guardian_email", "school_class", "class_name", "is_active")
        read_only_fields = ("id", "public_id", "student_id", "full_name", "class_name", "is_active")


class SchoolClassInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    academic_session = serializers.CharField(max_length=40)

    def validate(self, attrs):
        attrs["name"] = attrs["name"].strip()
        attrs["academic_session"] = attrs["academic_session"].strip()
        if not attrs["name"]:
            raise serializers.ValidationError({"name": "Enter a class name."})
        if not attrs["academic_session"]:
            raise serializers.ValidationError({"academic_session": "Enter an academic session."})
        return attrs


class SchoolRosterView(APIView):
    """Read and maintain the current member's own school roster."""

    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [parsers.JSONParser, parsers.MultiPartParser, parsers.FormParser]

    def get_school_and_membership(self, request):
        membership = active_workspace_membership(request)
        if membership is None:
            raise serializers.ValidationError({"detail": "Set up a school workspace first."})
        return membership.school, membership

    def get(self, request):
        school, membership = self.get_school_and_membership(request)
        classes = school.classes.filter(is_active=True).values("id", "name", "academic_session")
        subjects = school.subjects.filter(is_active=True).values("id", "name", "code")
        students = school.students.select_related("school_class").filter(is_active=True)
        if membership.role == SchoolMembership.Role.TEACHER:
            assigned_class_ids, assigned_pairs = _current_teacher_scope(membership)
            assigned_subject_ids = {subject_id for _class_id, subject_id in assigned_pairs}
            students = students.filter(school_class_id__in=assigned_class_ids)
            classes = classes.filter(id__in=assigned_class_ids)
            if not membership.class_teacher_assignments.filter(school_class_id__in=assigned_class_ids, is_active=True).exists():
                subjects = subjects.filter(id__in=assigned_subject_ids)
        members = school.memberships.none()
        if membership.role in {SchoolMembership.Role.ADMIN, SchoolMembership.Role.ACADEMIC_HEAD}:
            members = school.memberships.select_related("user").filter(status=SchoolMembership.Status.ACTIVE).order_by("user__first_name", "user__username")
        student_payload = StudentSerializer(students, many=True).data
        student_ids = [item["id"] for item in student_payload]
        percentage = ExpressionWrapper(100.0 * F("score") / F("assessment__maximum_score"), output_field=FloatField())
        visible_assessments = Assessment.objects.filter(school=school)
        if membership.role == SchoolMembership.Role.TEACHER:
            visible_assessments = visible_assessments.filter(_teacher_scope_q(membership))
        academic = {
            item["student_id"]: item
            for item in AssessmentScore.objects.filter(
                student_id__in=student_ids,
                status=AssessmentScore.EntryStatus.ENTERED,
                score__isnull=False,
                assessment__maximum_score__gt=0,
                assessment__status=Assessment.Status.PUBLISHED,
                assessment__in=visible_assessments,
            ).values("student_id").annotate(academic_average=Avg(percentage), assessments_recorded=Count("id"))
        }
        attendance = {
            item["student_id"]: item
            for item in AttendanceRecord.objects.filter(student_id__in=student_ids)
            .values("student_id")
            .annotate(
                marked=Count("id", filter=~Q(status=AttendanceRecord.Status.EXCUSED)),
                attended=Count("id", filter=Q(status__in=(AttendanceRecord.Status.PRESENT, AttendanceRecord.Status.LATE))),
            )
        }
        for item in student_payload:
            academic_item = academic.get(item["id"])
            attendance_item = attendance.get(item["id"])
            item["academic_average"] = round(academic_item["academic_average"], 1) if academic_item else None
            item["assessments_recorded"] = academic_item["assessments_recorded"] if academic_item else 0
            item["attendance_rate"] = round(attendance_item["attended"] / attendance_item["marked"] * 100, 1) if attendance_item and attendance_item["marked"] else None
        return Response({
            "classes": list(classes),
            "subjects": list(subjects),
            "students": student_payload,
            "my_assignments": ([
                *({"type": "class_teacher", "class_id": item.school_class_id, "subject_id": None} for item in membership.class_teacher_assignments.filter(is_active=True)),
                *({"type": "subject_teacher", "class_id": item.school_class_id, "subject_id": item.subject_id} for item in membership.teaching_assignments.filter(is_active=True)),
            ] if membership.role == SchoolMembership.Role.TEACHER else []),
            "members": [{
                "id": item.id,
                "public_id": item.public_id,
                "name": item.user.get_full_name() or item.user.display_name or item.user.username,
                "email": item.user.email,
                "role": item.role,
                "assignment_count": item.teaching_assignments.filter(is_active=True).count() + item.class_teacher_assignments.filter(is_active=True).count(),
            } for item in members],
        })

    def post(self, request):
        school, membership = self.get_school_and_membership(request)
        if membership.role == SchoolMembership.Role.TEACHER:
            return Response({"detail": "Teachers cannot change the school roster."}, status=403)

        action = request.data.get("action")
        if action == "intelligence_benchmarks":
            if membership.role not in {SchoolMembership.Role.ADMIN, SchoolMembership.Role.ACADEMIC_HEAD}:
                raise PermissionDenied("Only a school administrator or academic head can change intelligence benchmarks.")
            try:
                review_threshold = float(request.data.get("review_threshold"))
                strength_threshold = float(request.data.get("strength_threshold"))
            except (TypeError, ValueError):
                raise serializers.ValidationError({"thresholds": "Enter numeric thresholds between 0 and 100."})
            school.intelligence_review_threshold = review_threshold
            school.intelligence_strength_threshold = strength_threshold
            school.full_clean()
            school.save(update_fields=("intelligence_review_threshold", "intelligence_strength_threshold", "updated_at"))
            return Response({"review_threshold": review_threshold, "strength_threshold": strength_threshold})
        if action == "student_import_file_preview":
            upload = request.FILES.get("file")
            if upload is None:
                raise serializers.ValidationError({"file": "Choose a CSV or XLSX roster file."})
            headers, raw_rows = TeachingWorkView._read_import_file(upload)
            mapping = {
                "first_name": str(request.data.get("first_name_column") or TeachingWorkView._suggest_column(headers, {"first name", "first_name", "given name", "forename"})),
                "last_name": str(request.data.get("last_name_column") or TeachingWorkView._suggest_column(headers, {"last name", "last_name", "surname", "family name"})),
                "class_name": str(request.data.get("class_column") or TeachingWorkView._suggest_column(headers, {"class", "class name", "form", "arm"})),
                "admission_number": str(request.data.get("admission_number_column") or TeachingWorkView._suggest_column(headers, {"admission number", "admission_number", "student number", "student id", "id"})),
                "admission_year": str(request.data.get("admission_year_column") or TeachingWorkView._suggest_column(headers, {"admission year", "admission_year", "year"})),
            }
            required = ("first_name", "last_name", "class_name")
            if any(mapping[key] not in headers for key in required):
                return Response({"valid": False, "needs_mapping": True, "columns": headers, "mapping": mapping, "row_count": len(raw_rows), "valid_count": 0, "errors": ["Choose columns for first name, last name, and class before validating."], "rows": []})
            rows = [{key: str(row.get(column, "")).strip() if column else "" for key, column in mapping.items()} for row in raw_rows]
            normalized_rows, errors = self._validate_roster_import(rows, school)
            return Response({"valid": not errors, "needs_mapping": False, "columns": headers, "mapping": mapping, "row_count": len(rows), "valid_count": len(normalized_rows), "errors": errors[:20], "rows": normalized_rows, "source_name": upload.name})
        if action == "student_import":
            rows = request.data.get("rows", [])
            if not isinstance(rows, list) or not rows:
                raise serializers.ValidationError({"rows": "Validate a roster file before importing it."})
            classes = {item.id: item for item in school.classes.filter(is_active=True)}
            if any(not isinstance(row, dict) or int(row.get("class_id", 0)) not in classes for row in rows):
                raise serializers.ValidationError({"rows": "The roster contains a class that is no longer active in this school."})
            source_name = str(request.data.get("source_name") or "student-roster.csv").strip()[:255]
            created_count = matched_count = 0
            with transaction.atomic():
                batch = StudentRosterImport.objects.create(school=school, source_name=source_name, source_type="xlsx" if source_name.casefold().endswith(".xlsx") else "csv", row_count=len(rows), created_by=membership)
                for row in rows:
                    admission_number = str(row.get("admission_number", "")).strip()
                    student = Student.objects.filter(school=school, is_active=True, admission_number__iexact=admission_number).first() if admission_number else Student.objects.filter(school=school, is_active=True, first_name__iexact=str(row.get("first_name", "")).strip(), last_name__iexact=str(row.get("last_name", "")).strip(), school_class_id=int(row["class_id"])).first()
                    if student is None:
                        student = Student.objects.create(school=school, school_class_id=int(row["class_id"]), first_name=str(row.get("first_name", "")).strip()[:80], last_name=str(row.get("last_name", "")).strip()[:80], admission_number=admission_number[:64], admission_year=int(row.get("admission_year") or timezone.now().year))
                        created_count += 1
                    else:
                        student.first_name = str(row.get("first_name", student.first_name)).strip()[:80]
                        student.last_name = str(row.get("last_name", student.last_name)).strip()[:80]
                        student.school_class_id = int(row["class_id"])
                        student.admission_number = admission_number or student.admission_number
                        student.admission_year = int(row.get("admission_year") or student.admission_year)
                        student.save()
                        matched_count += 1
                batch.created_count = created_count
                batch.matched_count = matched_count
                batch.save(update_fields=("created_count", "matched_count"))
            return Response({"import_id": batch.id, "row_count": len(rows), "created_count": created_count, "matched_count": matched_count}, status=201)
        if action == "assessment_status":
            assessment = get_object_or_404(Assessment, id=request.data.get("assessment_id"), school=school, school_class=school_class, subject=subject)
            next_status = str(request.data.get("status", "")).strip()
            transitions = {
                Assessment.Status.DRAFT: {"submitted": Assessment.Status.SUBMITTED},
                Assessment.Status.SUBMITTED: {"reviewed": Assessment.Status.REVIEWED},
                Assessment.Status.REVIEWED: {"published": Assessment.Status.PUBLISHED},
            }
            if next_status not in transitions.get(assessment.status, {}):
                raise serializers.ValidationError({"status": "This assessment cannot move to that status from its current state."})
            if next_status in {Assessment.Status.REVIEWED, Assessment.Status.PUBLISHED} and membership.role not in {SchoolMembership.Role.ADMIN, SchoolMembership.Role.ACADEMIC_HEAD}:
                raise PermissionDenied("Only a school administrator or academic head can approve or publish results.")
            assessment.status = next_status
            assessment.save(update_fields=("status", "updated_at"))
            return Response({"id": assessment.id, "status": assessment.status})
        if action == "class":
            serializer = SchoolClassInputSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            school_class, created = SchoolClass.objects.get_or_create(
                school=school,
                name=serializer.validated_data["name"].strip(),
                academic_session=serializer.validated_data["academic_session"].strip(),
                defaults={"is_active": True},
            )
            if not created and not school_class.is_active:
                school_class.is_active = True
                school_class.save(update_fields=("is_active",))
            return Response({"id": school_class.id, "name": school_class.name, "academic_session": school_class.academic_session}, status=201 if created else 200)
        if action == "subject":
            name = str(request.data.get("name", "")).strip()
            code = str(request.data.get("code", "")).strip()
            if not name:
                raise serializers.ValidationError({"name": "Enter a subject name."})
            subject, created = Subject.objects.get_or_create(school=school, name=name, defaults={"code": code, "is_active": True})
            if not created and not subject.is_active:
                subject.is_active = True
                subject.code = code or subject.code
                subject.save(update_fields=("is_active", "code"))
            return Response({"id": subject.id, "name": subject.name, "code": subject.code}, status=201 if created else 200)
        if action == "student":
            serializer = StudentSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            school_class = serializer.validated_data["school_class"]
            if school_class.school_id != school.id:
                return Response({"detail": "The selected class is outside this school."}, status=403)
            student = serializer.save(school=school)
            return Response(StudentSerializer(student).data, status=201)
        if action == "member":
            email = str(request.data.get("email", "")).strip().lower()
            role = str(request.data.get("role", "")).strip()
            if not email:
                raise serializers.ValidationError({"email": "Enter the staff member's Neba email address."})
            if role not in {SchoolMembership.Role.ADMIN, SchoolMembership.Role.ACADEMIC_HEAD, SchoolMembership.Role.TEACHER}:
                raise serializers.ValidationError({"role": "Choose a valid school role."})
            user = get_user_model().objects.filter(email__iexact=email).first()
            if user is None:
                raise serializers.ValidationError({"email": "No Neba account exists for this email yet."})
            school_member, created = SchoolMembership.objects.update_or_create(
                school=school,
                user=user,
                defaults={"role": role, "status": SchoolMembership.Status.ACTIVE, "expires_at": None},
            )
            return Response({"id": school_member.id, "public_id": school_member.public_id, "name": user.get_full_name() or user.display_name or user.username, "email": user.email, "role": school_member.role}, status=201 if created else 200)
        raise serializers.ValidationError({"action": "Choose class, subject, or student."})

    @staticmethod
    def _validate_roster_import(rows, school):
        classes = {}
        for item in school.classes.filter(is_active=True):
            classes.setdefault(item.name.casefold(), []).append(item)
        existing_admission_numbers = set(value.casefold() for value in Student.objects.filter(school=school, is_active=True).exclude(admission_number="").values_list("admission_number", flat=True))
        seen = set()
        normalized, errors = [], []
        for index, row in enumerate(rows, start=2):
            first_name = str(row.get("first_name", "")).strip()
            last_name = str(row.get("last_name", "")).strip()
            class_name = str(row.get("class_name", "")).strip()
            admission_number = str(row.get("admission_number", "")).strip()
            if not first_name or not last_name or not class_name:
                errors.append(f"Row {index}: first name, last name, and class are required.")
                continue
            matching_classes = classes.get(class_name.casefold(), [])
            if len(matching_classes) != 1:
                errors.append(f"Row {index}: class '{class_name}' does not match exactly one active class in this school.")
                continue
            identity = admission_number.casefold() if admission_number else f"{first_name.casefold()}|{last_name.casefold()}|{matching_classes[0].id}"
            if identity in seen:
                errors.append(f"Row {index}: duplicate student identity in this file.")
                continue
            seen.add(identity)
            try:
                admission_year = int(str(row.get("admission_year", "")).strip() or timezone.now().year)
            except (TypeError, ValueError):
                errors.append(f"Row {index}: admission year must be a number.")
                continue
            normalized.append({"first_name": first_name[:80], "last_name": last_name[:80], "class_id": matching_classes[0].id, "class_name": matching_classes[0].name, "admission_number": admission_number[:64], "admission_year": admission_year, "existing": admission_number.casefold() in existing_admission_numbers if admission_number else False})
        return normalized, errors


def _class_access_or_403(membership, school_class):
    if membership.role != SchoolMembership.Role.TEACHER:
        return
    today = timezone.localdate()
    assignment_filter = Q(
        teaching_assignments__school_class=school_class,
        teaching_assignments__is_active=True,
        teaching_assignments__starts_at__lte=today,
    ) & (Q(teaching_assignments__ends_at__isnull=True) | Q(teaching_assignments__ends_at__gte=today))
    class_teacher_filter = Q(
        class_teacher_assignments__school_class=school_class,
        class_teacher_assignments__is_active=True,
        class_teacher_assignments__starts_at__lte=today,
    ) & (Q(class_teacher_assignments__ends_at__isnull=True) | Q(class_teacher_assignments__ends_at__gte=today))
    if not SchoolMembership.objects.filter(Q(pk=membership.pk) & (assignment_filter | class_teacher_filter)).exists():
        raise PermissionDenied("You are not assigned to this class.")


def _class_teacher_access_or_403(membership, school_class):
    if membership.role != SchoolMembership.Role.TEACHER:
        return
    today = timezone.localdate()
    assignment_filter = Q(
        class_teacher_assignments__school_class=school_class,
        class_teacher_assignments__is_active=True,
        class_teacher_assignments__starts_at__lte=today,
    ) & (Q(class_teacher_assignments__ends_at__isnull=True) | Q(class_teacher_assignments__ends_at__gte=today))
    if not SchoolMembership.objects.filter(Q(pk=membership.pk) & assignment_filter).exists():
        raise PermissionDenied("Only the class teacher can manage this class register.")


def _parse_attendance_date(value):
    try:
        selected = date.fromisoformat(str(value or timezone.localdate()))
    except ValueError as exc:
        raise serializers.ValidationError({"date": "Use a valid date in YYYY-MM-DD format."}) from exc
    if selected > timezone.localdate():
        raise serializers.ValidationError({"date": "Attendance cannot be recorded for a future date."})
    return selected


class AttendanceView(APIView):
    """Read and save a daily class register, scoped to assigned school staff."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        membership = active_workspace_membership(request)
        if membership is None:
            raise serializers.ValidationError({"detail": "Set up a school workspace first."})
        student_public_id = request.query_params.get("student_id")
        if student_public_id:
            student = StudentDetailView().get_student_and_membership(request, student_public_id)[0]
            records = student.attendance_records.order_by("-date")[:60]
            totals = {choice: 0 for choice in AttendanceRecord.Status.values}
            history = []
            for item in records:
                totals[item.status] += 1
                history.append({"date": item.date, "status": item.status, "note": item.note})
            denominator = totals[AttendanceRecord.Status.PRESENT] + totals[AttendanceRecord.Status.LATE] + totals[AttendanceRecord.Status.ABSENT]
            attended = totals[AttendanceRecord.Status.PRESENT] + totals[AttendanceRecord.Status.LATE]
            return Response({
                "summary": {**totals, "attendance_rate": round(attended / denominator * 100, 1) if denominator else None, "days_recorded": sum(totals.values())},
                "history": history,
            })

        school_class = get_object_or_404(SchoolClass, id=request.query_params.get("class_id"), school=membership.school, is_active=True)
        _class_teacher_access_or_403(membership, school_class)
        selected_date = _parse_attendance_date(request.query_params.get("date"))
        records = {item.student_id: item for item in AttendanceRecord.objects.filter(school_class=school_class, date=selected_date)}
        students = Student.objects.filter(school=membership.school, school_class=school_class, is_active=True).order_by("last_name", "first_name")
        rows = []
        for student in students:
            record = records.get(student.id)
            rows.append({
                "student_id": student.id,
                "student_public_id": student.public_id,
                "student_number": student.student_id,
                "name": student.full_name,
                "status": record.status if record else "unmarked",
                "note": record.note if record else "",
            })
        counts = {status: sum(row["status"] == status for row in rows) for status in AttendanceRecord.Status.values}
        return Response({"date": selected_date, "class_id": school_class.id, "class_name": school_class.name, "rows": rows, "summary": {**counts, "unmarked": sum(row["status"] == "unmarked" for row in rows)}})

    @transaction.atomic
    def post(self, request):
        membership = active_workspace_membership(request)
        if membership is None:
            raise serializers.ValidationError({"detail": "Set up a school workspace first."})
        school_class = get_object_or_404(SchoolClass, id=request.data.get("class_id"), school=membership.school, is_active=True)
        _class_teacher_access_or_403(membership, school_class)
        selected_date = _parse_attendance_date(request.data.get("date"))
        rows = request.data.get("rows")
        if not isinstance(rows, list) or not rows:
            raise serializers.ValidationError({"rows": "Mark at least one student before saving attendance."})
        students = {item.id: item for item in Student.objects.filter(school=membership.school, school_class=school_class, is_active=True, id__in=[row.get("student_id") for row in rows if isinstance(row, dict)])}
        saved = 0
        for row in rows:
            student = students.get(row.get("student_id")) if isinstance(row, dict) else None
            if student is None:
                raise serializers.ValidationError({"rows": "Every attendance row must identify an active student in this class."})
            attendance_status = row.get("status")
            if attendance_status not in AttendanceRecord.Status.values:
                raise serializers.ValidationError({"status": f"Choose present, late, absent, or excused for {student.full_name}."})
            record, _ = AttendanceRecord.objects.update_or_create(
                student=student,
                date=selected_date,
                defaults={
                    "school": membership.school,
                    "school_class": school_class,
                    "status": attendance_status,
                    "note": str(row.get("note", "")).strip()[:240],
                    "recorded_by": membership,
                },
            )
            record.full_clean()
            saved += 1
        return Response({"saved": saved, "date": selected_date})


class StudentDetailView(APIView):
    """Read and update one student only within the caller's selected school workspace."""

    permission_classes = [permissions.IsAuthenticated]

    def get_student_and_membership(self, request, public_id):
        membership = active_workspace_membership(request)
        if membership is None:
            raise serializers.ValidationError({"detail": "Set up a school workspace first."})
        students = Student.objects.select_related("school_class").filter(school=membership.school, public_id=public_id, is_active=True)
        if membership.role == SchoolMembership.Role.TEACHER:
            subject_class_ids = membership.teaching_assignments.filter(is_active=True).values_list("school_class_id", flat=True)
            class_teacher_ids = membership.class_teacher_assignments.filter(is_active=True).values_list("school_class_id", flat=True)
            class_ids = set(subject_class_ids).union(class_teacher_ids)
            students = students.filter(school_class_id__in=class_ids)
        return get_object_or_404(students), membership

    def get(self, request, public_id):
        student, _membership = self.get_student_and_membership(request, public_id)
        return Response(StudentSerializer(student).data)

    def patch(self, request, public_id):
        student, membership = self.get_student_and_membership(request, public_id)
        if membership.role == SchoolMembership.Role.TEACHER:
            raise PermissionDenied("Teachers cannot update student records.")
        serializer = StudentSerializer(student, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        school_class = serializer.validated_data.get("school_class")
        if school_class is not None and school_class.school_id != membership.school_id:
            raise PermissionDenied("The selected class is outside this school.")
        serializer.save()
        return Response(StudentSerializer(student).data)


def _assessment_topic_average(assessment, student, topic):
    normalized = topic.casefold()
    question_scores = []
    for question in assessment.questions.all():
        if question.topic.casefold() == normalized and question.maximum_score:
            question_scores.extend(
                float(item.score) / float(question.maximum_score) * 100
                for item in question.scores.all()
                if item.student_id == student.id and item.status == AssessmentQuestionScore.EntryStatus.ENTERED and item.score is not None
            )
    if question_scores:
        return round(sum(question_scores) / len(question_scores), 1)
    if normalized in {item.casefold() for item in _topic_labels(assessment.topics)} and assessment.maximum_score:
        score = assessment.scores.filter(student=student, status=AssessmentScore.EntryStatus.ENTERED, score__isnull=False).first()
        if score is not None:
            return round(float(score.score) / float(assessment.maximum_score) * 100, 1)
    return None


def _assessment_topic_class_average(assessment, topic):
    normalized = topic.casefold()
    values = []
    for question in assessment.questions.all():
        if question.topic.casefold() == normalized and question.maximum_score:
            values.extend(
                float(item.score) / float(question.maximum_score) * 100
                for item in question.scores.all()
                if item.status == AssessmentQuestionScore.EntryStatus.ENTERED and item.score is not None
            )
    if values:
        return round(sum(values) / len(values), 1)
    if normalized in {item.casefold() for item in _topic_labels(assessment.topics)} and assessment.maximum_score:
        values = [float(item.score) / float(assessment.maximum_score) * 100 for item in assessment.scores.all() if item.status == AssessmentScore.EntryStatus.ENTERED and item.score is not None]
        return round(sum(values) / len(values), 1) if values else None
    return None


def _student_intelligence_payload(student, membership, academic_session="", term=""):
    """Return transparent learner signals from entered assessment scores only."""
    review_threshold = float(membership.school.intelligence_review_threshold)
    strength_threshold = float(membership.school.intelligence_strength_threshold)
    subject_ids = None
    if membership.role == SchoolMembership.Role.TEACHER:
        subject_ids = set(
            TeachingAssignment.objects.filter(
                membership=membership,
                school_class=student.school_class,
                is_active=True,
                starts_at__lte=timezone.localdate(),
            ).filter(Q(ends_at__isnull=True) | Q(ends_at__gte=timezone.localdate())).values_list("subject_id", flat=True)
        )

    score_queryset = AssessmentScore.objects.filter(
        student=student,
        status=AssessmentScore.EntryStatus.ENTERED,
        score__isnull=False,
        assessment__status=Assessment.Status.PUBLISHED,
    ).select_related("assessment__subject")
    question_queryset = AssessmentQuestionScore.objects.filter(
        student=student,
        status=AssessmentQuestionScore.EntryStatus.ENTERED,
        score__isnull=False,
        question__assessment__status=Assessment.Status.PUBLISHED,
    ).select_related("question__assessment__subject")
    if subject_ids is not None:
        score_queryset = score_queryset.filter(assessment__subject_id__in=subject_ids)
        question_queryset = question_queryset.filter(question__assessment__subject_id__in=subject_ids)
    if academic_session:
        score_queryset = score_queryset.filter(assessment__academic_session=academic_session)
        question_queryset = question_queryset.filter(question__assessment__academic_session=academic_session)
    if term:
        score_queryset = score_queryset.filter(assessment__term=term)
        question_queryset = question_queryset.filter(question__assessment__term=term)

    topic_data = {}
    question_assessment_ids = set()
    assessment_history = []
    all_percentages = []
    for score in score_queryset:
        assessment = score.assessment
        if not assessment.maximum_score:
            continue
        percentage = round(float(score.score) / float(assessment.maximum_score) * 100, 1)
        all_percentages.append(percentage)
        assessment_history.append({
            "id": assessment.id,
            "title": assessment.title,
            "subject": assessment.subject.name,
            "assessment_type": assessment.assessment_type,
            "date": assessment.assessment_date,
            "percentage": percentage,
            "score": float(score.score),
            "maximum_score": float(assessment.maximum_score),
        })

    def add_topic_score(*, subject, topic, percentage, assessment, evidence_type):
        key = (subject.id, topic.casefold())
        item = topic_data.setdefault(key, {
            "topic": topic,
            "subject": subject.name,
            "subject_id": subject.id,
            "percentages": [],
            "assessment_ids": set(),
            "dates": [],
            "question_level": evidence_type == "question-level",
            "evidence_sources": {},
        })
        item["percentages"].append(percentage)
        item["assessment_ids"].add(assessment.id)
        item["dates"].append((assessment.assessment_date, percentage))
        item["question_level"] = item["question_level"] or evidence_type == "question-level"
        item["evidence_sources"][assessment.id] = {
            "id": assessment.id,
            "title": assessment.title,
            "subject": assessment.subject.name,
            "date": assessment.assessment_date,
            "percentage": percentage,
            "evidence_type": evidence_type,
        }

    for question_score in question_queryset:
        question = question_score.question
        assessment = question.assessment
        if not question.maximum_score:
            continue
        question_assessment_ids.add(assessment.id)
        add_topic_score(
            subject=assessment.subject,
            topic=question.topic,
            percentage=round(float(question_score.score) / float(question.maximum_score) * 100, 1),
            assessment=assessment,
            evidence_type="question-level",
        )

    for score in score_queryset:
        assessment = score.assessment
        if assessment.id in question_assessment_ids or not assessment.maximum_score:
            continue
        percentage = round(float(score.score) / float(assessment.maximum_score) * 100, 1)
        for topic in _topic_labels(assessment.topics):
            add_topic_score(subject=assessment.subject, topic=topic, percentage=percentage, assessment=assessment, evidence_type="topic-tagged")

    signals = []
    for item in topic_data.values():
        average = round(sum(item["percentages"]) / len(item["percentages"]), 1)
        dated_scores = sorted(item["dates"], key=lambda entry: entry[0])
        change = round(dated_scores[-1][1] - dated_scores[0][1], 1) if len(dated_scores) >= 2 else None
        coverage = len(item["percentages"])
        assessment_count = len(item["assessment_ids"])
        confidence = "sufficient" if coverage >= 2 and assessment_count >= 2 else "early" if coverage >= 2 or assessment_count >= 2 else "insufficient"
        signals.append({
            "topic": item["topic"],
            "subject": item["subject"],
            "subject_id": item["subject_id"],
            "average": average,
            "coverage": coverage,
            "assessments": assessment_count,
            "confidence": confidence,
            "status": "needs_support" if average < review_threshold else "developing" if average < strength_threshold else "strength",
            "change": change,
            "evidence": f"{coverage} recorded {'question-level' if item['question_level'] else 'topic-tagged'} score{'s' if coverage != 1 else ''} across {assessment_count} assessment{'s' if assessment_count != 1 else ''}.",
            "evidence_sources": sorted(item["evidence_sources"].values(), key=lambda source: source["date"], reverse=True),
        })
    signals.sort(key=lambda item: (item["average"], item["topic"]))

    intervention_queryset = StudentIntervention.objects.filter(school=student.school, student=student).select_related("subject")
    if subject_ids is not None:
        intervention_queryset = intervention_queryset.filter(subject_id__in=subject_ids)
    interventions = [{
        "id": item.id,
        "title": item.title,
        "topic": item.topic,
        "subject": item.subject.name,
        "status": item.status,
        "baseline_average": float(item.baseline_average) if item.baseline_average is not None else None,
        "follow_up_average": float(item.follow_up_average) if item.follow_up_average is not None else None,
        "created_at": item.created_at,
        "completed_at": item.completed_at,
        "baseline_assessment_id": item.baseline_assessment_id,
        "follow_up_assessment_id": item.follow_up_assessment_id,
        "expected_review_date": item.expected_review_date,
        "outcome_status": item.outcome_status,
        "improvement": round(float(item.follow_up_average) - float(item.baseline_average), 1) if item.follow_up_average is not None and item.baseline_average is not None else None,
    } for item in intervention_queryset]
    return {
        "summary": {
            "overall_average": round(sum(all_percentages) / len(all_percentages), 1) if all_percentages else None,
            "assessments_recorded": len(assessment_history),
            "topics_needing_support": sum(item["status"] == "needs_support" for item in signals),
            "active_interventions": sum(item["status"] in {StudentIntervention.Status.DRAFT, StudentIntervention.Status.ACTIVE} for item in interventions),
            "benchmarks": {"review_threshold": review_threshold, "strength_threshold": strength_threshold},
        },
        "topic_signals": signals,
        "assessment_history": sorted(assessment_history, key=lambda item: item["date"], reverse=True),
        "interventions": interventions,
    }


class StudentIntelligenceView(APIView):
    """Private learner profile: evidence first, teacher decisions second."""

    permission_classes = [permissions.IsAuthenticated]

    def get_student_and_membership(self, request, public_id):
        membership = active_workspace_membership(request)
        if membership is None:
            raise serializers.ValidationError({"detail": "Set up a school workspace first."})
        students = Student.objects.select_related("school_class").filter(school=membership.school, public_id=public_id, is_active=True)
        if membership.role == SchoolMembership.Role.TEACHER:
            class_ids, _assigned_pairs = _current_teacher_scope(membership)
            students = students.filter(school_class_id__in=class_ids)
        return get_object_or_404(students), membership

    def get(self, request, public_id):
        student, membership = self.get_student_and_membership(request, public_id)
        academic_session = str(request.query_params.get("academic_session", "")).strip()
        term = str(request.query_params.get("term", "")).strip()
        payload = _student_intelligence_payload(student, membership, academic_session, term)
        published = Assessment.objects.filter(school=student.school, status=Assessment.Status.PUBLISHED, scores__student=student).values("academic_session", "term").distinct()
        payload["filters"] = {
            "academic_sessions": sorted({item["academic_session"] for item in published}),
            "terms": sorted({item["term"] for item in published}),
            "selected_academic_session": academic_session,
            "selected_term": term,
        }
        return Response(payload)

    def post(self, request, public_id):
        student, membership = self.get_student_and_membership(request, public_id)
        subject = get_object_or_404(Subject, id=request.data.get("subject_id"), school=membership.school)
        class_subject_access_or_403(request.user, membership.school, student.school_class, subject)
        topic = str(request.data.get("topic", "")).strip()
        if not topic:
            raise serializers.ValidationError({"topic": "Choose a topic before creating a support plan."})
        baseline = request.data.get("baseline_average")
        baseline_assessment_id = request.data.get("baseline_assessment_id")
        baseline_assessment = None
        if baseline_assessment_id:
            baseline_assessment = get_object_or_404(Assessment, id=baseline_assessment_id, school=membership.school, school_class=student.school_class, subject=subject, status=Assessment.Status.PUBLISHED)
            baseline = _assessment_topic_average(baseline_assessment, student, topic)
            if baseline is None:
                raise serializers.ValidationError({"baseline_assessment_id": "The selected assessment has no recorded evidence for this topic and learner."})
        review_date = request.data.get("expected_review_date")
        intervention = StudentIntervention(
            school=membership.school,
            student=student,
            school_class=student.school_class,
            subject=subject,
            topic=topic[:160],
            title=str(request.data.get("title") or f"Focused {topic} support").strip()[:180],
            rationale=str(request.data.get("rationale") or "Teacher review requested from recorded assessment evidence.").strip(),
            baseline_average=baseline or None,
            baseline_assessment=baseline_assessment,
            expected_review_date=date.fromisoformat(review_date) if review_date else None,
            created_by=membership,
        )
        intervention.full_clean()
        intervention.save()
        return Response({"id": intervention.id, "title": intervention.title, "status": intervention.status}, status=201)

    def patch(self, request, public_id):
        student, membership = self.get_student_and_membership(request, public_id)
        intervention = get_object_or_404(StudentIntervention, id=request.data.get("intervention_id"), school=membership.school, student=student)
        class_subject_access_or_403(request.user, membership.school, student.school_class, intervention.subject)
        status = str(request.data.get("status", "")).strip()
        if status not in StudentIntervention.Status.values:
            raise serializers.ValidationError({"status": "Choose draft, active, or complete."})
        intervention.status = status
        follow_up_assessment_id = request.data.get("follow_up_assessment_id")
        if follow_up_assessment_id:
            follow_up_assessment = get_object_or_404(Assessment, id=follow_up_assessment_id, school=membership.school, school_class=student.school_class, subject=intervention.subject, status=Assessment.Status.PUBLISHED)
            follow_up_average = _assessment_topic_average(follow_up_assessment, student, intervention.topic)
            if follow_up_average is None:
                raise serializers.ValidationError({"follow_up_assessment_id": "The selected assessment has no recorded evidence for this topic and learner."})
            intervention.follow_up_assessment = follow_up_assessment
            intervention.follow_up_average = follow_up_average
            intervention.outcome_status = "improvement" if intervention.baseline_average is not None and follow_up_average > float(intervention.baseline_average) else "decline" if intervention.baseline_average is not None and follow_up_average < float(intervention.baseline_average) else "no_clear_change"
        if status == StudentIntervention.Status.COMPLETE:
            intervention.completed_at = timezone.now()
            if intervention.follow_up_average is None:
                matching_signals = [item for item in _student_intelligence_payload(student, membership)["topic_signals"] if item["subject_id"] == intervention.subject_id and item["topic"].casefold() == intervention.topic.casefold()]
                if matching_signals:
                    intervention.follow_up_average = matching_signals[0]["average"]
                    intervention.outcome_status = "improvement" if intervention.baseline_average is not None and intervention.follow_up_average > float(intervention.baseline_average) else "decline" if intervention.baseline_average is not None and intervention.follow_up_average < float(intervention.baseline_average) else "no_clear_change"
        else:
            intervention.completed_at = None
        intervention.full_clean()
        intervention.save()
        return Response({"id": intervention.id, "status": intervention.status, "follow_up_average": float(intervention.follow_up_average) if intervention.follow_up_average is not None else None, "outcome_status": intervention.outcome_status})


def _teaching_evidence(school_class, subject, topic):
    """Aggregate only recorded scores relevant to one requested teaching topic."""
    normalized_topic = topic.casefold()
    assessments = Assessment.objects.filter(school=school_class.school, school_class=school_class, subject=subject, status=Assessment.Status.PUBLISHED).prefetch_related("scores", "questions__scores")
    percentages, assessment_ids, student_ids = [], set(), set()
    assessment_sources = {}
    for assessment in assessments:
        has_question_evidence = False
        for question in assessment.questions.all():
            if question.topic.casefold() != normalized_topic or not question.maximum_score:
                continue
            question_scores = [score for score in question.scores.all() if score.status == AssessmentQuestionScore.EntryStatus.ENTERED and score.score is not None]
            for score in question_scores:
                percentages.append(float(score.score) / float(question.maximum_score) * 100)
                student_ids.add(score.student_id)
            if question_scores:
                assessment_ids.add(assessment.id)
                assessment_sources[assessment.id] = {"id": assessment.id, "title": assessment.title, "date": assessment.assessment_date, "evidence_type": "question-level"}
                has_question_evidence = True
        if has_question_evidence or normalized_topic not in {item.casefold() for item in _topic_labels(assessment.topics)} or not assessment.maximum_score:
            continue
        entered = [score for score in assessment.scores.all() if score.status == AssessmentScore.EntryStatus.ENTERED and score.score is not None]
        percentages.extend(float(score.score) / float(assessment.maximum_score) * 100 for score in entered)
        student_ids.update(score.student_id for score in entered)
        if entered:
            assessment_ids.add(assessment.id)
            assessment_sources[assessment.id] = {"id": assessment.id, "title": assessment.title, "date": assessment.assessment_date, "evidence_type": "topic-tagged"}
    return {
        "topic": topic,
        "average": round(sum(percentages) / len(percentages), 1) if percentages else None,
        "coverage": len(percentages),
        "assessments": len(assessment_ids),
        "students": len(student_ids),
        "confidence": "sufficient" if len(percentages) >= 10 and len(assessment_ids) >= 2 else "early" if len(percentages) >= 5 or len(assessment_ids) >= 2 else "insufficient",
        "assessment_sources": sorted(assessment_sources.values(), key=lambda item: item["date"], reverse=True),
    }


def _teaching_draft(kind, evidence, school_class, subject):
    average = evidence["average"]
    evidence_line = f"{evidence['coverage']} recorded score{'s' if evidence['coverage'] != 1 else ''} from {evidence['assessments']} assessment{'s' if evidence['assessments'] != 1 else ''}."
    confidence_line = {"sufficient": "repeated evidence", "early": "an early signal", "insufficient": "insufficient evidence for a strong conclusion"}[evidence["confidence"]]
    common = {
        "revision": (f"{evidence['topic']} retrieval and practice", ["Start with two worked examples and ask learners to explain each step.", "Use four short practice questions, moving from guided to independent work.", "End with one exit question mapped to the same topic."], ["Check that every learner can explain the method, not only state an answer.", "Record the exit-question result before deciding the next response."]),
        "lesson": (f"Reteach {evidence['topic']}", ["Open with one misconception-revealing question from the prior assessment.", "Model the concept using a clear worked example and think aloud.", "Use paired practice, then a short individual check before closing."], ["Keep the reteach focused on the stated topic.", "Use a comparable follow-up question rather than reusing the same item."]),
        "practice": (f"Differentiated practice: {evidence['topic']}", ["Support group: one guided example with prompts at each step.", "Core group: three independent questions using the same method.", "Stretch group: one application problem that requires explanation."], ["Place learners using current evidence, not a fixed label.", "Allow movement between groups during the activity."]),
        "summary": (f"Progress summary: {evidence['topic']}", ["State what the recorded scores show in plain language.", "Name the teaching response the class will receive next.", "Set a follow-up check and a date for teacher review."], ["Do not describe the signal as a diagnosis.", "Share only the level of detail appropriate for the intended audience."]),
        "explain": (f"Teacher evidence note: {evidence['topic']}", ["The signal is based on recorded scores linked to this topic.", "Review the assessment items and learner work before deciding the cause.", "Choose reteaching, practice, or a diagnostic check based on that review."], ["Avoid assigning a cause from scores alone.", "Collect another comparable piece of evidence after the response."]),
    }
    title, steps, checks = common[kind]
    return {
        "title": title,
        "teacher_note": f"{school_class.name} {subject.name}: {evidence_line} This is {confidence_line}. The current topic average is {average if average is not None else 'not yet available'}%. This is a teacher-review draft, not an automatic recommendation.",
        "evidence": evidence,
        "sections": [{"heading": "Suggested teaching sequence", "items": steps}],
        "review_checks": checks,
        "source": "structured_fallback",
    }


class TeachingAssistantView(APIView):
    """Generate teacher-review resources from a selected, explainable topic signal."""

    permission_classes = [permissions.IsAuthenticated]
    allowed_kinds = {"revision", "lesson", "practice", "summary", "explain"}

    def post(self, request):
        membership = active_workspace_membership(request)
        if membership is None:
            raise serializers.ValidationError({"detail": "Set up a school workspace first."})
        school_class = get_object_or_404(SchoolClass, id=request.data.get("class_id"), school=membership.school)
        subject = get_object_or_404(Subject, id=request.data.get("subject_id"), school=membership.school)
        class_subject_access_or_403(request.user, membership.school, school_class, subject)
        topic = str(request.data.get("topic", "")).strip()[:160]
        kind = str(request.data.get("kind", "revision")).strip()
        if not topic:
            raise serializers.ValidationError({"topic": "Choose the topic you want to work on."})
        if kind not in self.allowed_kinds:
            raise serializers.ValidationError({"kind": "Choose revision, lesson, practice, summary, or explain."})
        evidence = _teaching_evidence(school_class, subject, topic)
        fallback = _teaching_draft(kind, evidence, school_class, subject)
        if not settings.OPENAI_API_KEY:
            return Response(fallback)

        instructions = (
            "You are Neba for Schools' teaching assistant. Create a concise teacher-review draft from the supplied assessment evidence. "
            "Do not diagnose a learner, infer personal circumstances, fabricate curriculum facts, or claim the draft has been approved. "
            "Do not use student names or identifiers. Keep activities practical for a Nigerian secondary-school classroom. "
            "Return valid JSON only with this exact shape: "
            '{"title": string, "teacher_note": string, "sections": [{"heading": string, "items": [string]}], "review_checks": [string]}. '
            "Use 1 to 3 sections, 2 to 4 items per section, and two review checks."
        )
        prompt = json.dumps({
            "request": kind,
            "class": school_class.name,
            "subject": subject.name,
            "topic": topic,
            "evidence": evidence,
            "teacher_review_boundary": "Use these scores as evidence to guide a teacher, not as a diagnosis or an automatic student decision.",
        })
        try:
            response = requests.post(
                "https://api.openai.com/v1/responses",
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}", "Content-Type": "application/json"},
                json={"model": getattr(settings, "SCHOOLS_AI_MODEL", settings.OPENAI_TEXT_MODEL), "instructions": instructions, "input": prompt},
                timeout=25,
            )
            if not response.ok:
                return Response(fallback)
            payload = response.json()
            output = str(payload.get("output_text", "")).strip()
            if not output:
                output = " ".join(item.get("text", "") for entry in payload.get("output", []) for item in entry.get("content", []) if item.get("type") == "output_text").strip()
            generated = json.loads(re.sub(r"^```(?:json)?\s*|\s*```$", "", output, flags=re.IGNORECASE))
            if not isinstance(generated.get("title"), str) or not isinstance(generated.get("sections"), list):
                return Response(fallback)
            generated["evidence"] = evidence
            generated["source"] = "ai_draft"
            return Response(generated)
        except (requests.RequestException, TypeError, ValueError, json.JSONDecodeError):
            return Response(fallback, status=status.HTTP_200_OK)


class SchoolMemberDetailView(APIView):
    """Read or change a school member's access, scoped to the active school."""

    permission_classes = [permissions.IsAuthenticated]

    def get_member_and_membership(self, request, public_id):
        membership = active_workspace_membership(request)
        if membership is None:
            raise serializers.ValidationError({"detail": "Set up a school workspace first."})
        if membership.role not in {SchoolMembership.Role.ADMIN, SchoolMembership.Role.ACADEMIC_HEAD}:
            raise PermissionDenied("You cannot view school staff access.")
        member = get_object_or_404(SchoolMembership.objects.select_related("user").filter(school=membership.school, public_id=public_id, status=SchoolMembership.Status.ACTIVE))
        return member, membership

    def serialize_member(self, member):
        subject_assignments = member.teaching_assignments.select_related("school_class", "subject").filter(is_active=True)
        class_assignments = member.class_teacher_assignments.select_related("school_class").filter(is_active=True)
        return {
            "public_id": member.public_id,
            "name": member.user.get_full_name() or member.user.display_name or member.user.username,
            "email": member.user.email,
            "role": member.role,
            "status": member.status,
            "created_at": member.created_at,
            "assignments": [
                {
                    "id": item.id,
                    "type": "class_teacher",
                    "class_id": item.school_class_id,
                    "class_name": item.school_class.name,
                    "academic_session": item.school_class.academic_session,
                    "subject_id": None,
                    "subject_name": None,
                }
                for item in class_assignments
            ] + [
                {
                    "id": item.id,
                    "type": "subject_teacher",
                    "class_id": item.school_class_id,
                    "class_name": item.school_class.name,
                    "academic_session": item.school_class.academic_session,
                    "subject_id": item.subject_id,
                    "subject_name": item.subject.name,
                }
                for item in subject_assignments
            ],
        }

    def get(self, request, public_id):
        member, _membership = self.get_member_and_membership(request, public_id)
        return Response(self.serialize_member(member))

    def patch(self, request, public_id):
        member, membership = self.get_member_and_membership(request, public_id)
        if membership.role != SchoolMembership.Role.ADMIN:
            raise PermissionDenied("Only school admins can change staff access.")
        action = str(request.data.get("action", "update_role")).strip()
        if action == "add_assignment":
            if member.role != SchoolMembership.Role.TEACHER:
                raise serializers.ValidationError({"role": "Change this staff member's school role to Teacher before assigning classes."})
            assignment_type = str(request.data.get("type", "")).strip()
            school_class = get_object_or_404(SchoolClass, id=request.data.get("class_id"), school=membership.school, is_active=True)
            if assignment_type == "class_teacher":
                item, _created = ClassTeacherAssignment.objects.update_or_create(
                    membership=member,
                    school_class=school_class,
                    defaults={"is_active": True, "ends_at": None},
                )
            elif assignment_type == "subject_teacher":
                subject = get_object_or_404(Subject, id=request.data.get("subject_id"), school=membership.school, is_active=True)
                item, _created = TeachingAssignment.objects.update_or_create(
                    membership=member,
                    school_class=school_class,
                    subject=subject,
                    defaults={"is_active": True, "ends_at": None},
                )
            else:
                raise serializers.ValidationError({"type": "Choose class teacher or subject teacher."})
            item.full_clean()
            return Response(self.serialize_member(member))
        if action == "remove_assignment":
            assignment_type = str(request.data.get("type", "")).strip()
            model = ClassTeacherAssignment if assignment_type == "class_teacher" else TeachingAssignment if assignment_type == "subject_teacher" else None
            if model is None:
                raise serializers.ValidationError({"type": "Choose a valid assignment type."})
            item = get_object_or_404(model, id=request.data.get("assignment_id"), membership=member, is_active=True)
            item.is_active = False
            item.ends_at = max(timezone.localdate(), item.starts_at)
            item.save(update_fields=("is_active", "ends_at", "updated_at"))
            return Response(self.serialize_member(member))
        if action != "update_role":
            raise serializers.ValidationError({"action": "Choose a valid staff access action."})
        role = str(request.data.get("role", "")).strip()
        if role not in {SchoolMembership.Role.ADMIN, SchoolMembership.Role.ACADEMIC_HEAD, SchoolMembership.Role.TEACHER}:
            raise serializers.ValidationError({"role": "Choose a valid school role."})
        member.role = role
        member.save(update_fields=("role", "updated_at"))
        if role != SchoolMembership.Role.TEACHER:
            member.teaching_assignments.filter(is_active=True).update(is_active=False, ends_at=timezone.localdate())
            member.class_teacher_assignments.filter(is_active=True).update(is_active=False, ends_at=timezone.localdate())
        return Response(self.serialize_member(member))


class TeachingWorkView(APIView):
    """Class-centred assessment and assignment records, always constrained to class/subject access."""
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [parsers.JSONParser, parsers.MultiPartParser, parsers.FormParser]

    def get_context(self, request):
        membership = active_workspace_membership(request)
        if membership is None:
            raise serializers.ValidationError({"detail": "Set up a school workspace first."})
        school_class = get_object_or_404(SchoolClass, id=request.query_params.get("class_id"), school=membership.school)
        subject = get_object_or_404(Subject, id=request.query_params.get("subject_id"), school=membership.school)
        class_subject_access_or_403(request.user, membership.school, school_class, subject)
        return membership, school_class, subject

    def get(self, request):
        _membership, school_class, subject = self.get_context(request)
        assessments = Assessment.objects.filter(school_class=school_class, subject=subject).prefetch_related("questions__scores")
        assignments = Assignment.objects.filter(school_class=school_class, subject=subject).order_by("-created_at")
        students = Student.objects.filter(school_class=school_class, is_active=True).values("id", "student_id", "first_name", "last_name")
        return Response({"students": list(students), "assessments": [{"id": item.id, "title": item.title, "type": item.assessment_type, "maximum_score": item.maximum_score, "status": item.status, "topics": item.topics, "entered_scores": item.scores.filter(status=AssessmentScore.EntryStatus.ENTERED).count(), "questions": [{"id": question.id, "number": question.number, "topic": question.topic, "learning_objective": question.learning_objective, "maximum_score": question.maximum_score, "scores": [{"student_id": score.student_id, "score": score.score, "status": score.status} for score in question.scores.all()]} for question in item.questions.all()]} for item in assessments], "assignments": [{"id": item.id, "title": item.title, "due_date": item.due_date, "status": item.status, "counts_toward_ca": item.counts_toward_ca} for item in assignments]})

    def post(self, request):
        membership, school_class, subject = self.get_context(request)
        action = request.data.get("action")
        if action == "assessment_status":
            assessment = get_object_or_404(Assessment, id=request.data.get("assessment_id"), school=membership.school, school_class=school_class, subject=subject)
            next_status = str(request.data.get("status", "")).strip()
            transitions = {
                Assessment.Status.DRAFT: {"submitted": Assessment.Status.SUBMITTED},
                Assessment.Status.SUBMITTED: {"reviewed": Assessment.Status.REVIEWED},
                Assessment.Status.REVIEWED: {"published": Assessment.Status.PUBLISHED},
            }
            if next_status not in transitions.get(assessment.status, {}):
                raise serializers.ValidationError({"status": "This assessment cannot move to that status from its current state."})
            if next_status in {Assessment.Status.REVIEWED, Assessment.Status.PUBLISHED} and membership.role not in {SchoolMembership.Role.ADMIN, SchoolMembership.Role.ACADEMIC_HEAD}:
                raise PermissionDenied("Only a school administrator or academic head can approve or publish results.")
            assessment.status = next_status
            assessment.save(update_fields=("status", "updated_at"))
            return Response({"id": assessment.id, "status": assessment.status})
        if action == "score_import_file_preview":
            assessment = get_object_or_404(Assessment, id=request.data.get("assessment_id"), school=membership.school, school_class=school_class, subject=subject, status=Assessment.Status.DRAFT)
            upload = request.FILES.get("file")
            if upload is None:
                raise serializers.ValidationError({"file": "Choose a CSV or XLSX file."})
            headers, raw_rows = self._read_import_file(upload)
            student_column = str(request.data.get("student_column") or self._suggest_column(headers, {"student_id", "student id", "student number", "admission number", "student"}))
            score_column = str(request.data.get("score_column") or self._suggest_column(headers, {"score", "mark", "marks", "total", "result"}))
            if student_column not in headers or score_column not in headers:
                return Response({"valid": False, "needs_mapping": True, "columns": headers, "suggested_mapping": {"student_column": student_column, "score_column": score_column}, "row_count": len(raw_rows), "valid_count": 0, "errors": ["Choose the column containing the student ID and the column containing the score."], "rows": []})
            rows = [{"student_id": str(row.get(student_column, "")).strip(), "score": str(row.get(score_column, "")).strip()} for row in raw_rows]
            parsed_rows, errors = self._validate_score_import(rows, assessment, membership.school)
            return Response({"valid": not errors, "needs_mapping": False, "columns": headers, "suggested_mapping": {"student_column": student_column, "score_column": score_column}, "row_count": len(rows), "valid_count": len(parsed_rows), "errors": errors[:20], "rows": rows, "source_name": upload.name})
        if action == "assessment":
            item = Assessment(school=membership.school, school_class=school_class, subject=subject, academic_session=str(request.data.get("academic_session", school_class.academic_session)), term=str(request.data.get("term", "First term")), title=str(request.data.get("title", "")).strip(), assessment_type=request.data.get("assessment_type", Assessment.Type.CA), maximum_score=request.data.get("maximum_score"), weight=request.data.get("weight") or None, topics=str(request.data.get("topics", "")).strip(), created_by=membership)
            item.full_clean(); item.save()
            return Response({"id": item.id, "title": item.title, "status": item.status}, status=201)
        if action == "assignment":
            item = Assignment.objects.create(school=membership.school, school_class=school_class, subject=subject, title=str(request.data.get("title", "")).strip(), instructions=str(request.data.get("instructions", "")).strip(), due_date=request.data.get("due_date") or None, maximum_score=request.data.get("maximum_score") or None, counts_toward_ca=bool(request.data.get("counts_toward_ca")), created_by=membership)
            if not item.title:
                raise serializers.ValidationError({"title": "Enter an assignment title."})
            return Response({"id": item.id, "title": item.title, "status": item.status}, status=201)
        if action == "scores":
            assessment = get_object_or_404(Assessment, id=request.data.get("assessment_id"), school=membership.school, school_class=school_class, subject=subject, status=Assessment.Status.DRAFT)
            rows = request.data.get("scores", [])
            if not isinstance(rows, list):
                raise serializers.ValidationError({"scores": "Provide a list of student scores."})
            saved = 0
            for row in rows:
                student = get_object_or_404(Student, id=row.get("student_id"), school=membership.school, school_class=school_class, is_active=True)
                status = row.get("status", AssessmentScore.EntryStatus.ENTERED)
                score = row.get("score") if status == AssessmentScore.EntryStatus.ENTERED else None
                record, _ = AssessmentScore.objects.update_or_create(assessment=assessment, student=student, defaults={"score": score, "status": status, "entered_by": membership})
                record.full_clean(); record.save(); saved += 1
            return Response({"saved": saved})
        if action == "score_import":
            assessment = get_object_or_404(Assessment, id=request.data.get("assessment_id"), school=membership.school, school_class=school_class, subject=subject, status=Assessment.Status.DRAFT)
            rows = request.data.get("rows", [])
            if not isinstance(rows, list) or not rows:
                raise serializers.ValidationError({"rows": "Provide at least one score row."})
            parsed_rows, errors = self._validate_score_import(rows, assessment, membership.school)
            if errors:
                raise serializers.ValidationError({"rows": errors[:20]})
            source_name = str(request.data.get("source_name") or "scores.csv").strip()[:255]
            with transaction.atomic():
                batch = AssessmentImport.objects.create(school=membership.school, assessment=assessment, source_name=source_name, source_type="csv", status=AssessmentImport.Status.COMPLETED, row_count=len(rows), saved_count=len(parsed_rows), created_by=membership)
                for student, score in parsed_rows:
                    AssessmentScore.objects.update_or_create(assessment=assessment, student=student, defaults={"score": score, "status": AssessmentScore.EntryStatus.ENTERED, "entered_by": membership, "import_batch": batch})
            return Response({"saved": len(parsed_rows), "source": "csv", "import_id": batch.id})
        if action == "score_import_preview":
            assessment = get_object_or_404(Assessment, id=request.data.get("assessment_id"), school=membership.school, school_class=school_class, subject=subject, status=Assessment.Status.DRAFT)
            rows = request.data.get("rows", [])
            if not isinstance(rows, list) or not rows:
                raise serializers.ValidationError({"rows": "Provide at least one score row."})
            parsed_rows, errors = self._validate_score_import(rows, assessment, membership.school)
            return Response({"valid": not errors, "row_count": len(rows), "valid_count": len(parsed_rows), "errors": errors[:20]})
        if action == "questions":
            assessment = get_object_or_404(Assessment, id=request.data.get("assessment_id"), school=membership.school, school_class=school_class, subject=subject, status=Assessment.Status.DRAFT)
            questions = request.data.get("questions", [])
            if not isinstance(questions, list) or not questions:
                raise serializers.ValidationError({"questions": "Add at least one mapped question."})
            seen, saved = set(), []
            for row in questions:
                try:
                    number = int(row.get("number"))
                except (TypeError, ValueError):
                    raise serializers.ValidationError({"questions": "Each question needs a valid number."})
                topic = str(row.get("topic", "")).strip()
                if number < 1 or number in seen or not topic:
                    raise serializers.ValidationError({"questions": "Question numbers must be unique and every question needs a topic."})
                seen.add(number)
                question, _ = AssessmentQuestion.objects.update_or_create(assessment=assessment, number=number, defaults={"topic": topic[:160], "learning_objective": str(row.get("learning_objective", "")).strip()[:300], "maximum_score": row.get("maximum_score") or None})
                question.full_clean(); question.save(); saved.append(question)
            AssessmentQuestion.objects.filter(assessment=assessment).exclude(number__in=seen).delete()
            return Response({"saved": len(saved), "questions": [{"id": item.id, "number": item.number, "topic": item.topic, "learning_objective": item.learning_objective, "maximum_score": item.maximum_score} for item in saved]})
        if action == "question_scores":
            assessment = get_object_or_404(Assessment, id=request.data.get("assessment_id"), school=membership.school, school_class=school_class, subject=subject, status=Assessment.Status.DRAFT)
            rows = request.data.get("scores", [])
            if not isinstance(rows, list) or not rows:
                raise serializers.ValidationError({"scores": "Provide question score rows."})
            saved = 0
            for row in rows:
                question = get_object_or_404(AssessmentQuestion, id=row.get("question_id"), assessment=assessment)
                student = get_object_or_404(Student, id=row.get("student_id"), school=membership.school, school_class=school_class, is_active=True)
                status = row.get("status", AssessmentQuestionScore.EntryStatus.ENTERED)
                score = row.get("score") if status == AssessmentQuestionScore.EntryStatus.ENTERED else None
                record, _ = AssessmentQuestionScore.objects.update_or_create(question=question, student=student, defaults={"score": score, "status": status, "entered_by": membership})
                record.full_clean(); record.save(); saved += 1
            return Response({"saved": saved})
        raise serializers.ValidationError({"action": "Choose assessment, assignment, score entry, CSV import, or question mapping."})

    @staticmethod
    def _suggest_column(headers, candidates):
        normalized = {re.sub(r"[^a-z0-9]+", " ", header.casefold()).strip(): header for header in headers}
        for candidate in candidates:
            if candidate in normalized:
                return normalized[candidate]
        return ""

    @staticmethod
    def _read_import_file(upload):
        if upload.size > 10 * 1024 * 1024:
            raise serializers.ValidationError({"file": "Keep result files under 10 MB."})
        name = (upload.name or "").casefold()
        if not name.endswith((".csv", ".xlsx")):
            raise serializers.ValidationError({"file": "Use a CSV or XLSX result file."})
        if name.endswith(".xlsx"):
            from openpyxl import load_workbook
            workbook = load_workbook(upload, read_only=True, data_only=True)
            sheet = workbook.active
            values = sheet.iter_rows(values_only=True)
            header_row = next(values, None)
            headers = [str(value).strip() if value is not None else "" for value in (header_row or [])]
            rows = [dict(zip(headers, row)) for row in values if any(value is not None and str(value).strip() for value in row)]
            workbook.close()
        else:
            content = upload.read().decode("utf-8-sig", errors="replace")
            reader = csv.DictReader(io.StringIO(content))
            headers = [str(header).strip() for header in (reader.fieldnames or [])]
            rows = [dict(row) for row in reader if any(value and str(value).strip() for value in row.values())]
        headers = list(dict.fromkeys(header for header in headers if header))
        if not headers:
            raise serializers.ValidationError({"file": "The first row must contain column headings."})
        if len(rows) > 5000:
            raise serializers.ValidationError({"file": "Keep one import to 5,000 result rows or fewer."})
        return headers, rows

    @staticmethod
    def _validate_score_import(rows, assessment, school):
        parsed_rows, errors, seen = [], [], set()
        students = {student.student_id.casefold(): student for student in Student.objects.filter(school=school, school_class=assessment.school_class, is_active=True)}
        for index, row in enumerate(rows, start=2):
            if not isinstance(row, dict):
                errors.append(f"Row {index}: row must contain student_id and score.")
                continue
            student_id = str(row.get("student_id", "")).strip()
            key = student_id.casefold()
            if not student_id:
                errors.append(f"Row {index}: student_id is required.")
                continue
            if key in seen:
                errors.append(f"Row {index}: duplicate student_id '{student_id}'.")
                continue
            seen.add(key)
            student = students.get(key)
            if student is None:
                errors.append(f"Row {index}: no active student matches '{student_id}'.")
                continue
            try:
                score = float(row.get("score"))
            except (TypeError, ValueError):
                errors.append(f"Row {index}: enter a numeric score.")
                continue
            if score < 0 or score > float(assessment.maximum_score):
                errors.append(f"Row {index}: score must be between 0 and {assessment.maximum_score}.")
                continue
            parsed_rows.append((student, score))
        return parsed_rows, errors


def _topic_labels(value):
    return list(dict.fromkeys(label.strip()[:160] for label in value.split(",") if label.strip()))


def _assessment_scope(membership):
    assessments = Assessment.objects.filter(school=membership.school, status=Assessment.Status.PUBLISHED).prefetch_related("scores", "questions__scores")
    if membership.role != SchoolMembership.Role.TEACHER:
        return assessments
    return assessments.filter(_teacher_scope_q(membership))


class AcademicIntelligenceView(APIView):
    """Deterministic, explainable signals from topic-tagged assessment results."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        membership = active_workspace_membership(request)
        if membership is None:
            raise serializers.ValidationError({"detail": "Set up a school workspace first."})
        review_threshold = float(membership.school.intelligence_review_threshold)
        strength_threshold = float(membership.school.intelligence_strength_threshold)
        assessments = _assessment_scope(membership).select_related("school_class", "subject")
        academic_session = str(request.query_params.get("academic_session", "")).strip()
        term = str(request.query_params.get("term", "")).strip()
        if academic_session:
            assessments = assessments.filter(academic_session=academic_session)
        if term:
            assessments = assessments.filter(term=term)
        if request.query_params.get("class_id"):
            assessments = assessments.filter(school_class_id=request.query_params["class_id"])
        if request.query_params.get("subject_id"):
            assessments = assessments.filter(subject_id=request.query_params["subject_id"])

        total_percentages, assessed_students, topic_data = [], set(), {}
        for assessment in assessments:
            entered_scores = [score for score in assessment.scores.all() if score.status == AssessmentScore.EntryStatus.ENTERED and score.score is not None]
            if not entered_scores or not assessment.maximum_score:
                continue
            percentages = [float(score.score) / float(assessment.maximum_score) * 100 for score in entered_scores]
            total_percentages.extend(percentages)
            assessed_students.update(score.student_id for score in entered_scores)
            question_evidence = False
            for question in assessment.questions.all():
                question_scores = [score for score in question.scores.all() if score.status == AssessmentQuestionScore.EntryStatus.ENTERED and score.score is not None]
                if not question_scores or not question.maximum_score:
                    continue
                question_evidence = True
                topic = question.topic
                key = (assessment.school_class_id, assessment.subject_id, topic.casefold())
                item = topic_data.setdefault(key, {"topic": topic, "class_id": assessment.school_class_id, "class_name": assessment.school_class.name, "subject_id": assessment.subject_id, "subject_name": assessment.subject.name, "percentages": [], "assessment_ids": set(), "student_ids": set(), "question_level": False, "evidence_sources": {}})
                item["percentages"].extend(float(score.score) / float(question.maximum_score) * 100 for score in question_scores)
                item["assessment_ids"].add(assessment.id)
                item["student_ids"].update(score.student_id for score in question_scores)
                item["evidence_sources"][assessment.id] = {"id": assessment.id, "title": assessment.title, "date": assessment.assessment_date, "evidence_type": "question-level"}
                item["question_level"] = True
            if not question_evidence:
                for topic in _topic_labels(assessment.topics):
                    key = (assessment.school_class_id, assessment.subject_id, topic.casefold())
                    item = topic_data.setdefault(key, {"topic": topic, "class_id": assessment.school_class_id, "class_name": assessment.school_class.name, "subject_id": assessment.subject_id, "subject_name": assessment.subject.name, "percentages": [], "assessment_ids": set(), "student_ids": set(), "question_level": False, "evidence_sources": {}})
                    item["percentages"].extend(percentages)
                    item["assessment_ids"].add(assessment.id)
                    item["student_ids"].update(score.student_id for score in entered_scores)
                    item["evidence_sources"][assessment.id] = {"id": assessment.id, "title": assessment.title, "date": assessment.assessment_date, "evidence_type": "topic-tagged"}

        topic_signals = []
        for item in topic_data.values():
            average = round(sum(item["percentages"]) / len(item["percentages"]), 1)
            coverage = len(item["percentages"])
            confidence = "sufficient" if coverage >= 10 and len(item["assessment_ids"]) >= 2 else "early" if coverage >= 5 or len(item["assessment_ids"]) >= 2 else "insufficient"
            topic_signals.append({
                "topic": item["topic"], "class_id": item["class_id"], "class_name": item["class_name"], "subject_id": item["subject_id"], "subject_name": item["subject_name"],
                "average": average, "assessed_students": len(item["student_ids"]), "assessments": len(item["assessment_ids"]), "coverage": coverage, "confidence": confidence,
                "evidence": f"{coverage} recorded {'question-level' if item['question_level'] else 'topic-tagged'} scores across {len(item['assessment_ids'])} assessment{'s' if len(item['assessment_ids']) != 1 else ''}.", "evidence_sources": sorted(item["evidence_sources"].values(), key=lambda source: source["date"], reverse=True),
            })
        topic_signals.sort(key=lambda item: item["average"])
        interventions = AcademicIntervention.objects.filter(school=membership.school).select_related("school_class", "subject")
        if membership.role == SchoolMembership.Role.TEACHER:
            interventions = interventions.filter(_teacher_scope_q(membership))
            interventions = list(interventions)
        else:
            interventions = list(interventions)
        return Response({
            "summary": {"overall_average": round(sum(total_percentages) / len(total_percentages), 1) if total_percentages else None, "students_assessed": len(assessed_students), "topics_needing_attention": sum(item["average"] < review_threshold for item in topic_signals), "active_interventions": sum(item.status in {AcademicIntervention.Status.DRAFT, AcademicIntervention.Status.ACTIVE} for item in interventions), "benchmarks": {"review_threshold": review_threshold, "strength_threshold": strength_threshold}},
            "topic_signals": topic_signals,
            "interventions": [{"id": item.id, "topic": item.topic, "title": item.title, "status": item.status, "class_name": item.school_class.name, "subject_name": item.subject.name, "baseline_average": float(item.baseline_average) if item.baseline_average is not None else None} for item in interventions[:12]],
            "filters": {
                "academic_sessions": sorted(set(_assessment_scope(membership).values_list("academic_session", flat=True))),
                "terms": sorted(set(_assessment_scope(membership).values_list("term", flat=True))),
                "selected_academic_session": academic_session,
                "selected_term": term,
            },
        })

    def post(self, request):
        membership = active_workspace_membership(request)
        if membership is None:
            raise serializers.ValidationError({"detail": "Set up a school workspace first."})
        school_class = get_object_or_404(SchoolClass, id=request.data.get("class_id"), school=membership.school)
        subject = get_object_or_404(Subject, id=request.data.get("subject_id"), school=membership.school)
        class_subject_access_or_403(request.user, membership.school, school_class, subject)
        topic = str(request.data.get("topic", "")).strip()
        if not topic:
            raise serializers.ValidationError({"topic": "Choose a topic before creating an intervention."})
        baseline = request.data.get("baseline_average")
        baseline_assessment = None
        baseline_assessment_id = request.data.get("baseline_assessment_id")
        if baseline_assessment_id:
            baseline_assessment = get_object_or_404(Assessment, id=baseline_assessment_id, school=membership.school, school_class=school_class, subject=subject, status=Assessment.Status.PUBLISHED)
            baseline = _assessment_topic_class_average(baseline_assessment, topic)
            if baseline is None:
                raise serializers.ValidationError({"baseline_assessment_id": "The selected assessment has no recorded evidence for this topic."})
        intervention = AcademicIntervention(school=membership.school, school_class=school_class, subject=subject, topic=topic[:160], title=str(request.data.get("title") or f"Focused {topic} revision").strip()[:180], rationale=str(request.data.get("rationale") or f"Teacher review requested after topic-tagged assessment evidence showed {topic} below the selected benchmark.").strip(), baseline_average=baseline or None, baseline_assessment=baseline_assessment, expected_review_date=date.fromisoformat(request.data["expected_review_date"]) if request.data.get("expected_review_date") else None, created_by=membership)
        intervention.full_clean(); intervention.save()
        return Response({"id": intervention.id, "title": intervention.title, "status": intervention.status, "topic": intervention.topic}, status=201)

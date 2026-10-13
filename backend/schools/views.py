from django.db import transaction
from django.db.models import Q
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import permissions, serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import School, SchoolClass, SchoolMembership, Student, Subject
from .permissions import active_membership_or_403


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
    return {
        "id": school.id,
        "name": school.name,
        "slug": school.slug,
        "role": membership.role,
        "classes_count": school.classes.filter(is_active=True).count(),
        "subjects_count": school.subjects.filter(is_active=True).count(),
        "students_count": school.students.filter(is_active=True).count(),
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
        fields = ("id", "first_name", "last_name", "full_name", "admission_number", "school_class", "class_name", "is_active")


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
            assigned_class_ids = membership.teaching_assignments.filter(is_active=True).values_list("school_class_id", flat=True)
            students = students.filter(school_class_id__in=assigned_class_ids)
            classes = classes.filter(id__in=assigned_class_ids)
        members = school.memberships.none()
        if membership.role in {SchoolMembership.Role.ADMIN, SchoolMembership.Role.ACADEMIC_HEAD}:
            members = school.memberships.select_related("user").filter(status=SchoolMembership.Status.ACTIVE).order_by("user__first_name", "user__username")
        return Response({
            "classes": list(classes),
            "subjects": list(subjects),
            "students": StudentSerializer(students, many=True).data,
            "members": [{
                "id": item.id,
                "name": item.user.get_full_name() or item.user.display_name or item.user.username,
                "email": item.user.email,
                "role": item.role,
            } for item in members],
        })

    def post(self, request):
        school, membership = self.get_school_and_membership(request)
        if membership.role == SchoolMembership.Role.TEACHER:
            return Response({"detail": "Teachers cannot change the school roster."}, status=403)

        action = request.data.get("action")
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
            return Response({"id": school_member.id, "name": user.get_full_name() or user.display_name or user.username, "email": user.email, "role": school_member.role}, status=201 if created else 200)
        raise serializers.ValidationError({"action": "Choose class, subject, or student."})

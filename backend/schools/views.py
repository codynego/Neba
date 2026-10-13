from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import permissions, serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import School, SchoolClass, SchoolMembership, Subject


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
        membership = SchoolMembership.objects.select_related("school").filter(
            user=request.user,
            status=SchoolMembership.Status.ACTIVE,
        ).filter(Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now())).order_by("created_at").first()
        if membership is None:
            return Response({"workspace": None})

        school = membership.school
        return Response({"workspace": {
            "id": school.id,
            "name": school.name,
            "slug": school.slug,
            "role": membership.role,
            "classes_count": school.classes.filter(is_active=True).count(),
            "subjects_count": school.subjects.filter(is_active=True).count(),
        }})

from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from .models import ClassTeacherAssignment, SchoolMembership, TeachingAssignment


def active_membership_or_403(user, school):
    """Return the caller's active membership for this school or deny the request."""
    membership = SchoolMembership.objects.filter(
        school=school,
        user=user,
        status=SchoolMembership.Status.ACTIVE,
    ).filter(Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now())).first()
    if membership is None:
        raise PermissionDenied("You do not have access to this school.")
    return membership


def class_subject_access_or_403(user, school, school_class, subject=None):
    """Enforce school and teacher assignment scope before reading or changing records."""
    if school_class.school_id != school.id or (subject is not None and subject.school_id != school.id):
        raise PermissionDenied("The requested class or subject is outside this school.")
    membership = active_membership_or_403(user, school)
    if membership.role in {SchoolMembership.Role.ADMIN, SchoolMembership.Role.ACADEMIC_HEAD}:
        return membership

    today = timezone.localdate()
    current = Q(is_active=True, starts_at__lte=today) & (Q(ends_at__isnull=True) | Q(ends_at__gte=today))
    if ClassTeacherAssignment.objects.filter(membership=membership, school_class=school_class).filter(current).exists():
        return membership
    if subject is None:
        raise PermissionDenied("Teachers need a class-teacher assignment or a subject-specific assignment.")
    if not TeachingAssignment.objects.filter(membership=membership, school_class=school_class, subject=subject).filter(current).exists():
        raise PermissionDenied("You are not assigned to this class and subject.")
    return membership

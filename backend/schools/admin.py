from django.contrib import admin

from .models import School, SchoolClass, SchoolMembership, Student, StudentIntervention, Subject, TeachingAssignment


@admin.register(School)
class SchoolAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "created_at")
    search_fields = ("name", "slug")


@admin.register(SchoolMembership)
class SchoolMembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "school", "role", "status", "expires_at")
    list_filter = ("role", "status", "school")
    search_fields = ("user__username", "user__email", "school__name")


@admin.register(SchoolClass)
class SchoolClassAdmin(admin.ModelAdmin):
    list_display = ("name", "school", "academic_session", "is_active")
    list_filter = ("school", "academic_session", "is_active")


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "school", "is_active")
    list_filter = ("school", "is_active")


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ("last_name", "first_name", "school", "school_class", "admission_number", "is_active")
    list_filter = ("school", "school_class", "is_active")
    search_fields = ("first_name", "last_name", "admission_number")


@admin.register(TeachingAssignment)
class TeachingAssignmentAdmin(admin.ModelAdmin):
    list_display = ("membership", "school_class", "subject", "starts_at", "ends_at", "is_active")
    list_filter = ("is_active", "school_class__school")


@admin.register(StudentIntervention)
class StudentInterventionAdmin(admin.ModelAdmin):
    list_display = ("title", "student", "subject", "topic", "status", "school", "updated_at")
    list_filter = ("status", "school", "subject")
    search_fields = ("title", "topic", "student__first_name", "student__last_name")

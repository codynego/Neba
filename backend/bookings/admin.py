from django.contrib import admin
from .models import Application
from django.utils import timezone
from django.contrib import messages
from rest_framework.exceptions import APIException
from .models import ApplicationMessage, TaskMessage, TaskChange, TaskIssue
from .workflow import resolve_issue

@admin.register(Application, ApplicationMessage, TaskMessage, TaskChange)
class BookingHistoryAdmin(admin.ModelAdmin):
    def get_readonly_fields(self, request, obj=None):
        return tuple(field.name for field in self.model._meta.fields)
    def has_add_permission(self, request): return False
    def has_change_permission(self, request, obj=None): return False
    def has_delete_permission(self, request, obj=None): return False

@admin.register(TaskIssue)
class TaskIssueAdmin(admin.ModelAdmin):
    list_display = ("task", "reporter", "kind", "status", "outcome", "created_at")
    list_filter = ("status", "kind")
    readonly_fields = ("task", "reporter", "kind", "details", "status", "reviewed_by", "created_at", "resolved_at")
    actions = ("mark_reviewing", "resolve_selected")
    def get_readonly_fields(self, request, obj=None):
        if obj and obj.status == TaskIssue.Status.RESOLVED:
            return self.readonly_fields + ("outcome", "resolution")
        return self.readonly_fields
    def has_add_permission(self, request): return False
    def has_delete_permission(self, request, obj=None): return False
    @admin.action(description="Mark open issues as under review")
    def mark_reviewing(self, request, queryset):
        queryset.filter(status="open").update(status="reviewing", reviewed_by=request.user)
    @admin.action(description="Resolve using the saved outcome and member-facing explanation")
    def resolve_selected(self, request, queryset):
        for issue in queryset:
            try: resolve_issue(issue, request.user, issue.outcome, issue.resolution)
            except APIException as error: self.message_user(request, str(error.detail), level=messages.ERROR)
            else: self.message_user(request, f"Issue {issue.pk} resolved.")


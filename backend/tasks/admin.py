from django.contrib import admin
from .models import Task
from accounts.notifications import notify
@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("title", "requester", "moderation_status", "risk_level", "status", "is_private", "city")
    list_filter = ("moderation_status", "risk_level", "involves_item", "status")
    readonly_fields = ("requester", "status", "target_helper", "requested_offer", "is_private", "risk_level", "policy_version")
    def save_model(self, request, obj, form, change):
        previous = Task.objects.filter(pk=obj.pk).values_list("moderation_status", flat=True).first() if change else None
        super().save_model(request, obj, form, change)
        if previous == Task.ModerationStatus.HELD and obj.moderation_status == Task.ModerationStatus.APPROVED:
            notify(obj.requester, "Task review approved", f"/tasks/{obj.pk}", obj.title)
            if obj.target_helper:
                notify(obj.target_helper, "Someone requested your skills", f"/tasks/{obj.pk}", obj.title)
        elif previous == Task.ModerationStatus.HELD and obj.moderation_status == Task.ModerationStatus.REJECTED:
            notify(obj.requester, "Task review declined", f"/tasks/{obj.pk}", obj.moderation_reason or obj.title)
    def has_add_permission(self, request): return False
    def has_delete_permission(self, request, obj=None): return False

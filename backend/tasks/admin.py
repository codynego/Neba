from django.contrib import admin
from .models import Task
@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("title", "requester", "status", "is_private", "city")
    readonly_fields = ("requester", "status", "target_helper", "requested_offer", "is_private")
    def has_add_permission(self, request): return False
    def has_delete_permission(self, request, obj=None): return False

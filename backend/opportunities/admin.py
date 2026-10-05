from django.contrib import admin

from .models import Opportunity, OpportunityApplication, SavedOpportunity


@admin.register(Opportunity)
class OpportunityAdmin(admin.ModelAdmin):
    list_display = ("title", "provider", "category", "review_status", "deadline", "is_published", "is_remote")
    list_filter = ("category", "review_status", "is_published", "is_remote", "country")
    search_fields = ("title", "provider", "summary")
    readonly_fields = ("public_id", "created_at", "updated_at")


@admin.register(SavedOpportunity)
class SavedOpportunityAdmin(admin.ModelAdmin):
    list_display = ("user", "opportunity", "status", "updated_at")
    list_filter = ("status",)
    search_fields = ("user__username", "opportunity__title")


@admin.register(OpportunityApplication)
class OpportunityApplicationAdmin(admin.ModelAdmin):
    list_display = ("user", "opportunity", "status", "next_action_at", "updated_at")
    list_filter = ("status",)
    search_fields = ("user__username", "opportunity__title")

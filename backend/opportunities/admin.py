from django.contrib import admin

from .models import Opportunity, OpportunityApplication, OpportunityCheck, OpportunityCorrection, OpportunityThanks, SavedOpportunity


@admin.register(Opportunity)
class OpportunityAdmin(admin.ModelAdmin):
    list_display = ("title", "provider", "category", "application_channel", "review_status", "deadline", "is_published", "is_remote")
    list_filter = ("category", "application_channel", "review_status", "is_published", "is_remote", "country")
    search_fields = ("title", "provider", "summary")
    readonly_fields = ("public_id", "created_at", "updated_at")

    def save_model(self, request, obj, form, change):
        obj.is_published = obj.review_status == Opportunity.ReviewStatus.APPROVED
        super().save_model(request, obj, form, change)


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


@admin.register(OpportunityCheck)
class OpportunityCheckAdmin(admin.ModelAdmin):
    list_display = ("title", "user", "verdict", "evidence_confidence", "risk_level", "status", "checked_at")
    list_filter = ("status", "verdict", "evidence_confidence", "risk_level", "input_type")
    search_fields = ("title", "organization", "submitted_url", "user__username")
    readonly_fields = ("public_id", "created_at", "updated_at", "checked_at")


@admin.register(OpportunityCorrection)
class OpportunityCorrectionAdmin(admin.ModelAdmin):
    list_display = ("opportunity", "reason", "reporter", "status", "created_at")
    list_filter = ("reason", "status")
    search_fields = ("opportunity__title", "reporter__username", "details")
    readonly_fields = ("created_at",)


@admin.register(OpportunityThanks)
class OpportunityThanksAdmin(admin.ModelAdmin):
    list_display = ("opportunity", "user", "created_at")
    search_fields = ("opportunity__title", "user__username")

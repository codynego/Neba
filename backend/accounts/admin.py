from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.html import format_html
from rest_framework.authtoken.models import Token
from rest_framework.exceptions import APIException
from .models import User, IdentityVerification, SafetyReport, TrustAudit, PushSubscription
from .trust import review_identity

@admin.register(User)
class MemberAdmin(UserAdmin):
    list_display = ("username", "display_name", "is_active", "email_verified_at", "phone_verified_at", "identity_verified_at")
    readonly_fields = ("email_verified_at", "phone_verified_at", "identity_verified_at")
    fieldsets = UserAdmin.fieldsets + (("Neba profile", {"fields": ("display_name", "phone", "address", "neighborhood", "city", "state", "latitude", "longitude", "profile_photo_key", "profile_photo_content_type", "email_verified_at", "nearby_task_emails", "phone_verified_at", "identity_verified_at", "photo_visible")}),)
    actions = ("suspend_members",)
    @admin.action(description="Suspend selected members and revoke their login tokens")
    def suspend_members(self, request, queryset):
        for user in queryset.exclude(pk=request.user.pk).filter(is_superuser=False):
            user.is_active = False
            user.save(update_fields=("is_active",))
            Token.objects.filter(user=user).delete()
            TrustAudit.objects.create(actor=request.user, subject=user, action="member_suspended")
    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        if "is_active" in form.changed_data:
            if not obj.is_active:
                Token.objects.filter(user=obj).delete()
            TrustAudit.objects.create(actor=request.user, subject=obj, action="member_reactivated" if obj.is_active else "member_suspended")

@admin.register(IdentityVerification)
class IdentityAdmin(admin.ModelAdmin):
    list_display = ("user", "status", "created_at", "reviewed_by")
    list_filter = ("status",)
    fields = ("user", "full_name", "document_type", "status", "capture_instruction", "consent_version", "adult_confirmed", "publish_photo", "evidence", "document_checked", "face_matched", "challenge_matched", "adult_checked", "review_note", "created_at", "reviewed_at", "reviewed_by")
    readonly_fields = ("user", "full_name", "document_type", "status", "capture_instruction", "consent_version", "adult_confirmed", "publish_photo", "evidence", "created_at", "reviewed_at", "reviewed_by")
    actions = ("approve_reviewed", "reject_reviewed")
    def has_add_permission(self, request):
        return False
    def has_view_permission(self, request, obj=None):
        return request.user.has_perm("accounts.review_identityverification")
    def has_change_permission(self, request, obj=None):
        return request.user.has_perm("accounts.review_identityverification") and super().has_change_permission(request, obj)
    def has_delete_permission(self, request, obj=None):
        return False
    @admin.display(description="Private evidence (access is audited)")
    def evidence(self, obj):
        base = f"/api/auth/verification/{obj.pk}/evidence/"
        return format_html('<a href="{}document/" target="_blank">Identity document</a> · <a href="{}portrait/" target="_blank">Portrait</a> · <a href="{}challenge/" target="_blank">Camera challenge</a>', base, base, base)
    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        TrustAudit.objects.create(actor=request.user, subject=obj.user, action="identity_checklist_updated", note=f"submission {obj.pk}")
    def decide(self, request, queryset, approve):
        for submission in queryset:
            try:
                review_identity(submission, request.user, approve, submission.review_note)
            except APIException as error:
                self.message_user(request, str(error.detail), level="error")
            else:
                self.message_user(request, f"Submission {submission.pk} decided.")
    @admin.action(description="Approve after saving all four review checks")
    def approve_reviewed(self, request, queryset):
        self.decide(request, queryset, True)
    @admin.action(description="Reject using saved member-facing review notes")
    def reject_reviewed(self, request, queryset):
        self.decide(request, queryset, False)

@admin.register(SafetyReport)
class ReportAdmin(admin.ModelAdmin):
    list_display = ("reporter", "reported_user", "reason", "status", "created_at")
    list_filter = ("status", "reason")
    readonly_fields = ("reporter", "reported_user", "reason", "details", "created_at", "reviewed_by")
    def has_add_permission(self, request):
        return False
    def save_model(self, request, obj, form, change):
        obj.reviewed_by = request.user
        super().save_model(request, obj, form, change)
        TrustAudit.objects.create(actor=request.user, subject=obj.reported_user, action="report_reviewed", note=f"report {obj.pk}: {obj.status}")

@admin.register(TrustAudit)
class AuditAdmin(admin.ModelAdmin):
    list_display = ("actor", "subject", "action", "created_at")
    readonly_fields = ("actor", "subject", "action", "note", "created_at")
    def has_add_permission(self, request):
        return False
    def has_change_permission(self, request, obj=None):
        return False
    def has_delete_permission(self, request, obj=None):
        return False

@admin.register(PushSubscription)
class PushSubscriptionAdmin(admin.ModelAdmin):
    list_display = ("user", "endpoint", "updated_at")
    readonly_fields = ("user", "endpoint", "p256dh", "auth", "user_agent", "created_at", "updated_at")
    def has_add_permission(self, request):
        return False
    def has_change_permission(self, request, obj=None):
        return False


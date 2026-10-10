from django.contrib import admin

from .models import BillingProfile, Checkout, Payment, Subscription, WebhookEvent


@admin.register(BillingProfile)
class BillingProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "provider_customer_id", "updated_at")
    readonly_fields = ("user", "provider_customer_id", "created_at", "updated_at")


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ("user", "plan", "status", "interval", "currency", "amount", "next_billed_at")
    list_filter = ("status", "plan", "interval")
    readonly_fields = tuple(field.name for field in Subscription._meta.fields)


@admin.register(Checkout)
class CheckoutAdmin(admin.ModelAdmin):
    list_display = ("user", "kind", "status", "amount", "currency", "created_at")
    list_filter = ("kind", "status", "currency")
    readonly_fields = tuple(field.name for field in Checkout._meta.fields)


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("user", "provider_charge_id", "amount", "currency", "status", "created_at")
    readonly_fields = tuple(field.name for field in Payment._meta.fields)


@admin.register(WebhookEvent)
class WebhookEventAdmin(admin.ModelAdmin):
    list_display = ("provider_event_id", "event_type", "processed", "received_at")
    readonly_fields = tuple(field.name for field in WebhookEvent._meta.fields)

import hashlib
import hmac
import json
import time
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.credits import balance_for
from accounts.models import CreditTransaction, User
from .models import BillingProfile, Checkout, Payment, Subscription, WebhookEvent
from .provider import BillingProviderError, configured, create_checkout, create_portal_session
from .entitlements import opportunity_check_usage


CREDIT_PACKAGES = {100: Decimal("1000.00"), 300: Decimal("2500.00"), 1000: Decimal("7500.00")}


def _plans():
    currency = settings.BILLING_PLUS_CURRENCY
    return [
        {
            "code": "free",
            "name": "Free",
            "description": "A clear place to find, save and pursue good opportunities.",
            "features": ["Opportunity discovery and matching", "Unlimited saves and application tracking", "3 evidence-based opportunity checks each month", "Community contributions and earned credits"],
            "prices": [],
        },
        {
            "code": "plus",
            "name": "Plus",
            "description": "More intelligence for an active opportunity search.",
            "featured": True,
            "features": ["Everything in Free", "30 evidence-based opportunity checks each month", "Expanded AI preparation tools", "Credits still work alongside your plan"],
            "prices": [
                {"interval": "month", "amount": settings.BILLING_PLUS_MONTHLY_PRICE, "currency": currency, "configured": bool(settings.BACHS_PLUS_MONTHLY_PRODUCT_ID)},
                {"interval": "year", "amount": settings.BILLING_PLUS_YEARLY_PRICE, "currency": currency, "configured": bool(settings.BACHS_PLUS_YEARLY_PRODUCT_ID)},
            ],
        },
    ]


def _iso(value):
    return value.isoformat() if value else None


def _subscription_for(user):
    return Subscription.objects.filter(user=user).first()


class PlansView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({"plans": _plans(), "payments_configured": configured()})


class BillingStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        subscription = _subscription_for(request.user)
        payments = Payment.objects.filter(user=request.user).select_related("checkout")[:12]
        return Response({
            "plan": "plus" if subscription and subscription.entitled else "free",
            "payments_configured": configured(),
            "credit_balance": balance_for(request.user),
            "usage": {"opportunity_checks": opportunity_check_usage(request.user)},
            "subscription": None if not subscription else {
                "plan": subscription.plan,
                "status": subscription.status,
                "interval": subscription.interval,
                "amount": str(subscription.amount) if subscription.amount is not None else None,
                "currency": subscription.currency,
                "current_period_end": _iso(subscription.current_period_end),
                "next_billed_at": _iso(subscription.next_billed_at),
                "cancel_at_period_end": subscription.cancel_at_period_end,
            },
            "payments": [{
                "id": item.provider_charge_id,
                "kind": item.checkout.kind if item.checkout else "payment",
                "description": f"{item.checkout.credits:,} credits" if item.checkout and item.checkout.kind == Checkout.Kind.CREDITS else "GetNeba Plus",
                "amount": str(item.amount),
                "currency": item.currency,
                "status": item.status,
                "created_at": item.created_at,
            } for item in payments],
        })


class CheckoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        kind = str(request.data.get("kind", "subscription"))
        if kind == Checkout.Kind.SUBSCRIPTION:
            interval = str(request.data.get("interval", "month"))
            if interval not in ("month", "year"):
                return Response({"detail": "Choose monthly or yearly billing."}, status=400)
            current = _subscription_for(request.user)
            if current and current.entitled:
                return Response({"detail": "Your Plus plan is already active. Use Manage billing to change it."}, status=409)
            product_id = settings.BACHS_PLUS_MONTHLY_PRODUCT_ID if interval == "month" else settings.BACHS_PLUS_YEARLY_PRODUCT_ID
            if not product_id:
                return Response({"detail": "This plan is not available for checkout yet."}, status=503)
            amount = Decimal(settings.BILLING_PLUS_MONTHLY_PRICE if interval == "month" else settings.BILLING_PLUS_YEARLY_PRICE)
            currency = settings.BILLING_PLUS_CURRENCY
            checkout = Checkout(
                user=request.user, reference="pending", kind=kind, plan="plus", interval=interval,
                product_id=product_id, amount=amount, currency=currency,
            )
            checkout.reference = f"getneba_{checkout.public_id.hex}"
            checkout.save()
            payload = {
                "product_cart": [{"product_id": product_id, "quantity": 1}],
                "customer": {"email": request.user.email, "name": request.user.display_name or request.user.username},
                "success_url": f"{settings.FRONTEND_URL}/billing?checkout=success",
                "cancel_url": f"{settings.FRONTEND_URL}/pricing?checkout=cancelled",
                "reference": checkout.reference,
                "metadata": {"getneba_user_id": str(request.user.pk), "getneba_plan": "plus", "getneba_interval": interval},
            }
        elif kind == Checkout.Kind.CREDITS:
            try:
                credits = int(request.data.get("credits", 0))
            except (TypeError, ValueError):
                credits = 0
            if credits < 10 or credits > 5000 or credits % 10:
                return Response({"detail": "Choose between 10 and 5,000 credits in steps of 10."}, status=400)
            amount = CREDIT_PACKAGES.get(credits, Decimal(credits) * Decimal("10.00"))
            checkout = Checkout(
                user=request.user, reference="pending", kind=kind, credits=credits,
                amount=amount, currency="NGN",
            )
            checkout.reference = f"getneba_{checkout.public_id.hex}"
            checkout.save()
            payload = {
                "pricing": {"currency": "NGN", "amount": str(amount)},
                "customer": {"email": request.user.email, "name": request.user.display_name or request.user.username},
                "success_url": f"{settings.FRONTEND_URL}/credits?checkout=success",
                "cancel_url": f"{settings.FRONTEND_URL}/credits?checkout=cancelled",
                "reference": checkout.reference,
                "metadata": {"getneba_user_id": str(request.user.pk), "getneba_credits": str(credits)},
            }
        else:
            return Response({"detail": "Unknown checkout type."}, status=400)

        try:
            result = create_checkout(payload, f"checkout-{checkout.public_id.hex}")
        except BillingProviderError as exc:
            checkout.status = "failed"
            checkout.save(update_fields=("status", "updated_at"))
            return Response({"detail": str(exc)}, status=503)
        checkout.provider_checkout_id = result.get("checkout_id")
        checkout.checkout_url = result.get("checkout_url", "")
        checkout.status = result.get("status", "open")
        checkout.expires_at = parse_datetime(result.get("expires_at", ""))
        checkout.save(update_fields=("provider_checkout_id", "checkout_url", "status", "expires_at", "updated_at"))
        return Response({"checkout_url": checkout.checkout_url, "checkout_id": checkout.provider_checkout_id}, status=status.HTTP_201_CREATED)


class PortalView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        profile = BillingProfile.objects.filter(user=request.user).first()
        if not profile or not profile.provider_customer_id:
            return Response({"detail": "No billing account is connected yet."}, status=404)
        try:
            result = create_portal_session(profile.provider_customer_id, f"portal-{request.user.pk}-{int(time.time())}")
        except BillingProviderError as exc:
            return Response({"detail": str(exc)}, status=503)
        return Response({"url": result.get("url")})


def _verify_signature(request):
    secret = settings.BACHS_WEBHOOK_SECRET
    if not secret:
        return False
    raw = request.body
    v2 = request.headers.get("X-Bachs-Signature-V2", "")
    if v2:
        pieces = [part.split("=", 1) for part in v2.split(",") if "=" in part]
        timestamps = [value for key, value in pieces if key == "t"]
        signatures = [value for key, value in pieces if key == "v1"]
        if not timestamps:
            return False
        timestamp = timestamps[0]
    else:
        timestamp = request.headers.get("X-Bachs-Timestamp", "")
        signatures = [request.headers.get("X-Bachs-Signature", "")]
    try:
        if abs(time.time() - int(timestamp)) > 300:
            return False
    except (TypeError, ValueError):
        return False
    expected = hmac.new(secret.encode(), f"{timestamp}.".encode() + raw, hashlib.sha256).hexdigest()
    return any(signature and hmac.compare_digest(expected, signature) for signature in signatures)


def _event_user(data):
    metadata = data.get("metadata") or {}
    user_id = metadata.get("getneba_user_id")
    if user_id:
        user = User.objects.filter(pk=user_id).first()
        if user:
            return user
    customer = data.get("customer") or {}
    customer_id = customer.get("customer_id") or customer.get("id")
    if customer_id:
        profile = BillingProfile.objects.filter(provider_customer_id=customer_id).select_related("user").first()
        if profile:
            return profile.user
    email = customer.get("email")
    return User.objects.filter(email__iexact=email).first() if email else None


def _capture_customer(user, data):
    customer = data.get("customer") or {}
    customer_id = customer.get("customer_id") or customer.get("id")
    if user and customer_id:
        BillingProfile.objects.update_or_create(user=user, defaults={"provider_customer_id": customer_id})


def _decimal(value):
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None


def _process_collection(data):
    checkout_id = data.get("checkout_id")
    reference = data.get("reference")
    checkout = Checkout.objects.select_for_update().filter(provider_checkout_id=checkout_id).first() if checkout_id else None
    if not checkout and reference:
        checkout = Checkout.objects.select_for_update().filter(reference=reference).first()
    user = checkout.user if checkout else _event_user(data)
    if not user:
        return
    _capture_customer(user, data)
    charge_id = data.get("charge_id")
    amount = _decimal(data.get("amount"))
    currency = str(data.get("currency", "")).upper()
    if charge_id and amount is not None:
        Payment.objects.update_or_create(
            provider_charge_id=charge_id,
            defaults={"user": user, "checkout": checkout, "amount": amount, "currency": currency, "status": "succeeded"},
        )
    if not checkout:
        return
    checkout.status = "completed"
    if checkout.kind == Checkout.Kind.CREDITS and not checkout.fulfilled_at:
        if amount == checkout.amount and currency == checkout.currency:
            key = f"bachs-credit-purchase:{charge_id or checkout.provider_checkout_id}"
            CreditTransaction.objects.get_or_create(
                idempotency_key=key,
                defaults={"user": user, "amount": checkout.credits, "action": "credit_purchase", "description": f"Purchased {checkout.credits:,} credits"},
            )
            checkout.fulfilled_at = timezone.now()
    checkout.save(update_fields=("status", "fulfilled_at", "updated_at"))


def _process_subscription(event_type, data):
    user = _event_user(data)
    if not user:
        return
    _capture_customer(user, data)
    subscription_id = data.get("subscription_id") or data.get("id")
    if not subscription_id:
        return
    product_id = data.get("product_id") or (data.get("product") or {}).get("id") or ""
    interval = (data.get("billing_cycle") or {}).get("interval", "")
    status_value = "canceled" if event_type.endswith("deleted") else str(data.get("status", "active")).lower()
    defaults = {
        "user": user,
        "provider_product_id": product_id,
        "plan": "plus",
        "interval": interval,
        "status": status_value,
        "currency": str(data.get("currency", "")).upper(),
        "amount": _decimal(data.get("amount")),
        "current_period_start": parse_datetime(data.get("current_period_start") or ""),
        "current_period_end": parse_datetime(data.get("current_period_end") or ""),
        "next_billed_at": parse_datetime(data.get("next_billed_at") or ""),
        "cancel_at_period_end": bool(data.get("cancel_at_period_end", False)),
        "canceled_at": parse_datetime(data.get("canceled_at") or ""),
    }
    Subscription.objects.update_or_create(provider_subscription_id=subscription_id, defaults=defaults)


@method_decorator(csrf_exempt, name="dispatch")
class WebhookView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        if not _verify_signature(request):
            return Response({"detail": "Invalid webhook signature."}, status=400)
        try:
            payload = json.loads(request.body)
        except (TypeError, ValueError):
            return Response({"detail": "Invalid JSON."}, status=400)
        event_id = str(payload.get("id", ""))
        event_type = str(payload.get("type", ""))
        if not event_id or not event_type:
            return Response({"detail": "Invalid event envelope."}, status=400)
        with transaction.atomic():
            event, created = WebhookEvent.objects.select_for_update().get_or_create(
                provider_event_id=event_id, defaults={"event_type": event_type}
            )
            if not created and event.processed:
                return Response({"received": True, "duplicate": True})
            data = payload.get("data") or {}
            if event_type == "collection.succeeded":
                _process_collection(data)
            elif event_type == "checkout.completed":
                checkout_id = data.get("checkout_id") or data.get("id")
                checkout = Checkout.objects.filter(provider_checkout_id=checkout_id).first()
                if checkout:
                    checkout.status = "completed"
                    checkout.save(update_fields=("status", "updated_at"))
                    _capture_customer(checkout.user, data)
            elif event_type == "checkout.expired":
                Checkout.objects.filter(provider_checkout_id=data.get("checkout_id") or data.get("id")).update(status="expired")
            elif event_type.startswith("customer.subscription."):
                _process_subscription(event_type, data)
            event.processed = True
            event.processed_at = timezone.now()
            event.save(update_fields=("processed", "processed_at"))
        return Response({"received": True})

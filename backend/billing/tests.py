import hashlib
import hmac
import json
import time
from unittest.mock import Mock, patch

from django.test import override_settings
from rest_framework.test import APITestCase

from accounts.credits import balance_for
from accounts.models import User
from .models import BillingProfile, Checkout, Payment, Subscription, WebhookEvent


@override_settings(
    BACHS_API_KEY="sk_sandbox_test",
    BACHS_BASE_URL="https://sandbox-api.bachs.io",
    BACHS_WEBHOOK_SECRET="whsec_test",
    BACHS_PLUS_MONTHLY_PRODUCT_ID="prod_monthly",
    BACHS_PLUS_YEARLY_PRODUCT_ID="prod_yearly",
    FRONTEND_URL="https://getneba.app",
)
class BillingApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="ada", email="ada@example.com", password="password", display_name="Ada")

    def _sign(self, body):
        timestamp = str(int(time.time()))
        signature = hmac.new(b"whsec_test", f"{timestamp}.".encode() + body, hashlib.sha256).hexdigest()
        return {"HTTP_X_BACHS_SIGNATURE_V2": f"t={timestamp},v1={signature}"}

    def _webhook(self, payload):
        body = json.dumps(payload, separators=(",", ":")).encode()
        return self.client.generic("POST", "/api/billing/webhook/", body, content_type="application/json", **self._sign(body))

    def test_plans_are_public_and_report_checkout_readiness(self):
        response = self.client.get("/api/billing/plans/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([plan["code"] for plan in response.data["plans"]], ["free", "plus"])
        self.assertTrue(response.data["plans"][1]["prices"][0]["configured"])

    @patch("billing.provider.requests.request")
    def test_subscription_checkout_uses_server_side_product_and_reference(self, send):
        provider_response = Mock(ok=True)
        provider_response.json.return_value = {
            "checkout_id": "chk_monthly",
            "checkout_url": "https://sandbox-checkout.bachs.io/c/test",
            "status": "open",
            "expires_at": "2026-10-10T18:00:00Z",
        }
        send.return_value = provider_response
        self.client.force_authenticate(self.user)
        response = self.client.post("/api/billing/checkout/", {"kind": "subscription", "interval": "month"}, format="json")
        self.assertEqual(response.status_code, 201)
        checkout = Checkout.objects.get(user=self.user)
        self.assertEqual(checkout.product_id, "prod_monthly")
        self.assertTrue(checkout.reference.startswith("getneba_"))
        payload = send.call_args.kwargs["json"]
        self.assertEqual(payload["product_cart"], [{"product_id": "prod_monthly", "quantity": 1}])
        self.assertEqual(payload["metadata"]["getneba_user_id"], str(self.user.pk))
        self.assertEqual(send.call_args.kwargs["headers"]["Authorization"], "Bearer sk_sandbox_test")

    @patch("billing.provider.requests.request")
    def test_credit_checkout_is_priced_on_the_server(self, send):
        provider_response = Mock(ok=True)
        provider_response.json.return_value = {
            "checkout_id": "chk_credits",
            "checkout_url": "https://sandbox-checkout.bachs.io/c/credits",
            "status": "open",
            "expires_at": "2026-10-10T18:00:00Z",
        }
        send.return_value = provider_response
        self.client.force_authenticate(self.user)
        response = self.client.post("/api/billing/checkout/", {"kind": "credits", "credits": 300, "price": "1.00"}, format="json")
        self.assertEqual(response.status_code, 201)
        checkout = Checkout.objects.get(user=self.user)
        self.assertEqual(str(checkout.amount), "2500.00")
        self.assertEqual(send.call_args.kwargs["json"]["pricing"], {"currency": "NGN", "amount": "2500.00"})

    def test_signed_collection_fulfils_credit_purchase_exactly_once(self):
        checkout = Checkout.objects.create(
            user=self.user,
            provider_checkout_id="chk_credit_paid",
            reference="getneba_credit_paid",
            kind=Checkout.Kind.CREDITS,
            credits=300,
            amount="2500.00",
            currency="NGN",
            status="open",
        )
        payload = {
            "id": "evt_paid_once",
            "type": "collection.succeeded",
            "data": {
                "charge_id": "ch_paid_once",
                "checkout_id": checkout.provider_checkout_id,
                "reference": checkout.reference,
                "status": "SUCCEEDED",
                "amount": "2500.00",
                "currency": "NGN",
                "customer": {"id": "cust_ada", "email": self.user.email},
            },
        }
        first = self._webhook(payload)
        second = self._webhook(payload)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(balance_for(self.user), 300)
        self.assertEqual(Payment.objects.count(), 1)
        self.assertEqual(WebhookEvent.objects.count(), 1)
        self.assertEqual(BillingProfile.objects.get(user=self.user).provider_customer_id, "cust_ada")

    def test_subscription_webhook_grants_plus_and_bad_signature_is_rejected(self):
        payload = {
            "id": "evt_subscription",
            "type": "customer.subscription.created",
            "data": {
                "subscription_id": "sub_ada",
                "product_id": "prod_monthly",
                "status": "active",
                "amount": "5.00",
                "currency": "USD",
                "billing_cycle": {"interval": "month", "frequency": 1},
                "current_period_start": "2026-10-10T12:00:00Z",
                "current_period_end": "2026-11-10T12:00:00Z",
                "next_billed_at": "2026-11-10T12:00:00Z",
                "customer": {"customer_id": "cust_ada", "email": self.user.email},
                "metadata": {"getneba_user_id": str(self.user.pk)},
            },
        }
        response = self._webhook(payload)
        self.assertEqual(response.status_code, 200)
        subscription = Subscription.objects.get(user=self.user)
        self.assertTrue(subscription.entitled)
        self.assertEqual(subscription.interval, "month")
        body = json.dumps({**payload, "id": "evt_bad"}).encode()
        rejected = self.client.generic("POST", "/api/billing/webhook/", body, content_type="application/json", HTTP_X_BACHS_SIGNATURE_V2="t=1,v1=bad")
        self.assertEqual(rejected.status_code, 400)

    def test_billing_status_exposes_plan_usage_and_history_without_secrets(self):
        Subscription.objects.create(user=self.user, provider_subscription_id="sub_status", status="active", plan="plus")
        self.client.force_authenticate(self.user)
        response = self.client.get("/api/billing/status/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["plan"], "plus")
        self.assertEqual(response.data["usage"]["opportunity_checks"]["limit"], 30)
        self.assertNotIn("api_key", response.data)

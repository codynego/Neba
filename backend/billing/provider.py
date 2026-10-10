import requests

from django.conf import settings


class BillingProviderError(Exception):
    pass


def configured():
    return bool(settings.BACHS_API_KEY)


def request(method, path, *, payload=None, idempotency_key=""):
    if not configured():
        raise BillingProviderError("Payments are not configured yet.")
    headers = {"Authorization": f"Bearer {settings.BACHS_API_KEY}"}
    if payload is not None:
        headers["Content-Type"] = "application/json"
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key
    try:
        response = requests.request(
            method,
            f"{settings.BACHS_BASE_URL}{path}",
            json=payload,
            headers=headers,
            timeout=15,
        )
    except requests.RequestException as exc:
        raise BillingProviderError("The payment service is temporarily unavailable.") from exc
    if not response.ok:
        try:
            detail = response.json().get("detail")
        except (ValueError, AttributeError):
            detail = None
        raise BillingProviderError(detail or "The payment service could not start this request.")
    try:
        return response.json()
    except ValueError as exc:
        raise BillingProviderError("The payment service returned an invalid response.") from exc


def create_checkout(payload, idempotency_key):
    return request("POST", "/v1/checkout-sessions", payload=payload, idempotency_key=idempotency_key)


def create_portal_session(customer_id, idempotency_key):
    return request("POST", f"/v1/customers/{customer_id}/portal-sessions", idempotency_key=idempotency_key)

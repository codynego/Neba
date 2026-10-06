import json
import logging
import base64

from django.conf import settings

from .models import Notification, PushSubscription


logger = logging.getLogger(__name__)


def _decode_base64url(value):
    try:
        return base64.urlsafe_b64decode(value + "=" * ((4 - len(value) % 4) % 4))
    except (ValueError, TypeError):
        return b""


def configured():
    public_key = _decode_base64url(settings.WEB_PUSH_VAPID_PUBLIC_KEY)
    private_key = _decode_base64url(settings.WEB_PUSH_VAPID_PRIVATE_KEY)
    return bool(
        settings.WEB_PUSH_VAPID_SUBJECT
        and len(public_key) == 65
        and public_key[:1] == b"\x04"
        and len(private_key) == 32
    )


def deliver(notification_id):
    if not configured():
        return
    try:
        from pywebpush import WebPushException, webpush
    except ImportError:
        logger.warning("Web push is configured but pywebpush is unavailable.")
        return
    try:
        notification = Notification.objects.select_related("recipient").get(pk=notification_id)
    except Notification.DoesNotExist:
        return
    payload = json.dumps({
        "title": notification.title,
        "body": notification.detail or "Open GetNeba for details.",
        "path": notification.path,
        "notification_id": notification.pk,
    })
    for subscription in PushSubscription.objects.filter(user=notification.recipient).iterator():
        try:
            webpush(
                subscription_info={"endpoint": subscription.endpoint, "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth}},
                data=payload,
                vapid_private_key=settings.WEB_PUSH_VAPID_PRIVATE_KEY,
                vapid_claims={"sub": settings.WEB_PUSH_VAPID_SUBJECT},
                ttl=60 * 60 * 24,
                timeout=5,
            )
        except WebPushException as error:
            status = getattr(getattr(error, "response", None), "status_code", None)
            if status in (404, 410):
                subscription.delete()
            else:
                logger.warning("Web push delivery failed for subscription %s: %s", subscription.pk, status or error)
        except Exception:
            logger.exception("Web push delivery failed for subscription %s", subscription.pk)

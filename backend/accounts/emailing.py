import html
import json
import logging
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode


logger = logging.getLogger(__name__)


class EmailUnavailable(Exception):
    pass


def email_configured():
    return bool(settings.RESEND_API_KEY and settings.DEFAULT_FROM_EMAIL)


def _post(path, payload, idempotency_key):
    if not email_configured():
        raise EmailUnavailable("Email delivery is not configured.")
    request = Request(
        f"https://api.resend.com/{path}",
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {settings.RESEND_API_KEY}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "GetNeba/1.0 (transactional-email)",
            "Idempotency-Key": idempotency_key[:256],
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=settings.EMAIL_HTTP_TIMEOUT_SECONDS) as response:
            return json.load(response)
    except HTTPError as error:
        detail = error.read(1000).decode("utf-8", errors="replace")
        logger.error("Resend rejected an email request with status %s: %s", error.code, detail)
        raise EmailUnavailable("Email delivery failed.") from None
    except (URLError, TimeoutError, ValueError):
        logger.exception("Resend could not be reached.")
        raise EmailUnavailable("Email delivery failed.") from None


def _frame(preview, heading, body, action_label=None, action_url=None, footer=None):
    action = ""
    if action_label and action_url:
        action = f'<p style="margin:28px 0"><a href="{html.escape(action_url)}" style="background:#173f35;color:#fff;padding:13px 20px;border-radius:8px;text-decoration:none;font-weight:700">{html.escape(action_label)}</a></p>'
    footer_html = f'<p style="color:#66756f;font-size:13px;margin-top:30px">{html.escape(footer)}</p>' if footer else ""
    return f"""<!doctype html><html><body style="margin:0;background:#edf8f2;font-family:Arial,sans-serif;color:#17352e">
    <span style="display:none;max-height:0;overflow:hidden">{html.escape(preview)}</span>
    <div style="max-width:580px;margin:30px auto;background:#fff;border-radius:14px;padding:34px">
      <p style="font-size:13px;letter-spacing:.12em;font-weight:700;color:#43806f">GETNEBA</p>
      <h1 style="font-size:28px;line-height:1.15">{html.escape(heading)}</h1>
      <div style="font-size:16px;line-height:1.6">{body}</div>{action}{footer_html}
    </div></body></html>"""


def send_email(to, subject, html_body, text, idempotency_key):
    return _post("emails", {
        "from": settings.DEFAULT_FROM_EMAIL,
        "to": [to],
        "subject": subject,
        "html": html_body,
        "text": text,
    }, idempotency_key)


def send_batch(messages, idempotency_key):
    if not messages:
        return {"data": []}
    return _post("emails/batch", messages, idempotency_key)


def verification_link(user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    return f"{settings.FRONTEND_URL}/verify-email?{urlencode({'uid': uid, 'token': token})}"


def password_reset_link(user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    return f"{settings.FRONTEND_URL}/reset-password?{urlencode({'uid': uid, 'token': token})}"


def send_verification_email(user):
    link = verification_link(user)
    name = html.escape(user.display_name or user.username)
    body = f"<p>Hi {name},</p><p>Confirm this email address to secure your GetNeba account and receive account notifications.</p>"
    return send_email(user.email, "Verify your GetNeba email", _frame("Confirm your email address", "Verify your email", body, "Verify email", link, "This link expires after it is used or your account details change."),
        f"Verify your GetNeba email: {link}", f"verify-email-{user.pk}-{default_token_generator.make_token(user)}")


def send_password_reset_email(user):
    link = password_reset_link(user)
    name = html.escape(user.display_name or user.username)
    body = f"<p>Hi {name},</p><p>We received a request to reset your password. If this was not you, you can ignore this message.</p>"
    return send_email(user.email, "Reset your GetNeba password", _frame("Reset your GetNeba password", "Reset your password", body, "Choose a new password", link, "For your security, this link becomes invalid after your password changes."),
        f"Reset your GetNeba password: {link}", f"password-reset-{user.pk}-{default_token_generator.make_token(user)}")


def send_application_accepted_email(application):
    user = application.applicant
    if not user.email or not user.email_verified_at:
        return None
    link = f"{settings.FRONTEND_URL}/tasks/{application.task.public_id}"
    title = html.escape(application.task.title)
    body = f"<p>Your application for <strong>{title}</strong> was accepted.</p><p>You can now coordinate securely in the task workspace.</p>"
    return send_email(user.email, "Your task application was accepted", _frame("Your application was accepted", "You got the task", body, "Open task workspace", link),
        f"Your application for {application.task.title} was accepted. Open: {link}", f"application-accepted-{application.pk}")


def send_task_approved_email(task):
    user = task.requester
    if not user.email or not user.email_verified_at:
        return None
    link = f"{settings.FRONTEND_URL}/tasks/{task.public_id}"
    title = html.escape(task.title)
    body = f"<p>Your task <strong>{title}</strong> passed review and is now visible to nearby helpers.</p>"
    return send_email(user.email, "Your GetNeba task is live", _frame("Your task is live", "Task approved", body, "View task", link),
        f"Your task is now live: {link}", f"task-approved-{task.pk}")


def send_direct_request_decision_email(task, accepted):
    user = task.requester
    if not user.email or not user.email_verified_at:
        return None
    link = f"{settings.FRONTEND_URL}/tasks/{task.public_id}" if accepted else f"{settings.FRONTEND_URL}/activity"
    decision = "accepted" if accepted else "declined"
    body = f"<p>Your helper request for <strong>{html.escape(task.title)}</strong> was {decision}.</p>"
    return send_email(user.email, f"Your helper request was {decision}", _frame(f"Helper request {decision}", f"Request {decision}", body, "View activity", link),
        f"Your helper request was {decision}. Open: {link}", f"direct-request-{decision}-{task.pk}")


def send_nearby_task_emails(task):
    if task.is_private or task.status != "open" or task.moderation_status != "approved" or task.nearby_email_sent_at:
        return 0
    from django.utils import timezone
    from .models import User

    candidates = User.objects.filter(
        is_active=True,
        nearby_task_emails=True,
        email_verified_at__isnull=False,
        city__iexact=task.city,
        state__iexact=task.state,
    ).exclude(pk=task.requester_id).exclude(email="").order_by("id")[:settings.NEARBY_EMAIL_BATCH_LIMIT]
    link = f"{settings.FRONTEND_URL}/tasks/{task.public_id}"
    messages = []
    for user in candidates:
        if task.category not in (user.skills or []):
            continue
        location = task.neighborhood or task.city
        body = f"<p>A new <strong>{html.escape(task.get_category_display())}</strong> task appeared near {html.escape(location)}.</p><p><strong>{html.escape(task.title)}</strong></p>"
        messages.append({
            "from": settings.DEFAULT_FROM_EMAIL,
            "to": [user.email],
            "subject": f"New task near you: {task.title}"[:150],
            "html": _frame("A new task matches your skills", "New task near you", body, "View task", link, "You enabled nearby-task emails in your GetNeba profile. You can turn them off there anytime."),
            "text": f"A new task near {location} matches your skills: {task.title}. View: {link}",
        })
    if messages:
        send_batch(messages, f"nearby-task-{task.pk}")
    task.nearby_email_sent_at = timezone.now()
    task.save(update_fields=("nearby_email_sent_at",))
    return len(messages)


def safely(callback, *args):
    try:
        return callback(*args)
    except EmailUnavailable as error:
        logger.warning("A GetNeba email could not be delivered: %s", error)
        return None

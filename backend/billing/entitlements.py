from django.utils import timezone

from opportunities.models import OpportunityCheck
from .models import Subscription


FREE_MONTHLY_CHECKS = 3
PLUS_MONTHLY_CHECKS = 30


def has_plus(user):
    subscription = Subscription.objects.filter(user=user).first()
    return bool(subscription and subscription.entitled)


def opportunity_check_usage(user):
    now = timezone.now()
    used = OpportunityCheck.objects.filter(
        user=user,
        created_at__year=now.year,
        created_at__month=now.month,
    ).exclude(status=OpportunityCheck.Status.FAILED).count()
    limit = PLUS_MONTHLY_CHECKS if has_plus(user) else FREE_MONTHLY_CHECKS
    return {"used": used, "limit": limit, "remaining": max(0, limit - used), "resets_at": _next_month(now).isoformat()}


def _next_month(value):
    if value.month == 12:
        return value.replace(year=value.year + 1, month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    return value.replace(month=value.month + 1, day=1, hour=0, minute=0, second=0, microsecond=0)

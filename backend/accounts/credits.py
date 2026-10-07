from datetime import datetime, time, timedelta

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from opportunities.models import Opportunity
from .models import CreditTransaction

DAILY_CONTRIBUTION_CAP = 50
CONTRIBUTION_REWARD = 10


def _today_window():
    today = timezone.localdate()
    start = timezone.make_aware(datetime.combine(today, time.min))
    return start, start + timedelta(days=1)


def balance_for(user):
    return CreditTransaction.objects.filter(user=user).aggregate(total=Sum("amount"))["total"] or 0


def award_contribution_credits(opportunity):
    """Reward one approved, unique personal contribution, once only."""
    user = opportunity.created_by
    if not user:
        return 0
    key = f"approved-contribution:{opportunity.public_id}"
    with transaction.atomic():
        if CreditTransaction.objects.filter(idempotency_key=key).exists():
            return 0
        if opportunity.source_url:
            duplicate = Opportunity.objects.filter(
                source_url=opportunity.source_url,
                review_status=Opportunity.ReviewStatus.APPROVED,
            ).exclude(pk=opportunity.pk).exists()
        else:
            duplicate = Opportunity.objects.filter(
                title__iexact=opportunity.title.strip(),
                provider__iexact=opportunity.provider.strip(),
                review_status=Opportunity.ReviewStatus.APPROVED,
            ).exclude(pk=opportunity.pk).exists()
        if duplicate:
            return 0
        start, end = _today_window()
        earned_today = CreditTransaction.objects.filter(
            user=user,
            action="approved_contribution",
            created_at__gte=start,
            created_at__lt=end,
        ).aggregate(total=Sum("amount"))["total"] or 0
        reward = min(CONTRIBUTION_REWARD, max(0, DAILY_CONTRIBUTION_CAP - earned_today))
        if reward <= 0:
            return 0
        CreditTransaction.objects.create(
            user=user,
            amount=reward,
            action="approved_contribution",
            idempotency_key=key,
            description=f"Approved contribution: {opportunity.title[:180]}",
        )
        return reward

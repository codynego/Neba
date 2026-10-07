from django.db.models import Sum
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .credits import DAILY_CONTRIBUTION_CAP, balance_for
from .models import CreditTransaction


class CreditsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        earned_today = CreditTransaction.objects.filter(
            user=request.user,
            action="approved_contribution",
            created_at__date=today,
        ).aggregate(total=Sum("amount"))["total"] or 0
        transactions = CreditTransaction.objects.filter(user=request.user)[:20]
        return Response({
            "balance": balance_for(request.user),
            "earned_today": earned_today,
            "daily_cap": DAILY_CONTRIBUTION_CAP,
            "transactions": [{"amount": item.amount, "action": item.action, "description": item.description, "created_at": item.created_at} for item in transactions],
        })

import re
from decimal import Decimal

from django.conf import settings
from rest_framework.exceptions import ValidationError

from .models import Task


POLICY_VERSION = "mvp-v1"

PROHIBITED_PATTERNS = (
    (r"\b(collect|deliver|carry|pick\s*up|transport)\s+(some\s+)?cash\b", "Cash collection or delivery is not allowed on Neba."),
    (r"\b(withdraw|deposit|transfer|send)\s+(cash|money|funds?)\b", "Financial transactions are not allowed on Neba."),
    (r"\b(atm|bank\s+account|account\s+login|online\s+banking|crypto(?:currency)?|bitcoin)\b", "Financial-account and cryptocurrency tasks are not allowed on Neba."),
    (r"\b(password|passcode|one[- ]time password|otp|pin)\b", "Tasks must not request passwords, OTPs, PINs, or account access."),
    (r"\b(gun|firearm|ammunition|weapon|explosive)\b", "Weapons and dangerous goods are not allowed on Neba."),
    (r"\b(cocaine|heroin|methamphetamine|illegal drugs?|controlled substance)\b", "Illegal drugs and controlled substances are not allowed on Neba."),
    (r"\b(stolen goods?|fake id|forged document|counterfeit document)\b", "Stolen goods and fraudulent documents are not allowed on Neba."),
    (r"\b(sexual services?|escort services?)\b", "Sexual services are not allowed on Neba."),
    (r"\b(babysit|babysitter|childcare|child care|watch my child|watch my kids?)\b", "Unsupervised childcare is not supported in the Neba MVP."),
)

REVIEW_PATTERNS = (
    r"\bsealed package\b",
    r"\bno questions asked\b",
    r"\bconfidential package\b",
    r"\b(prescription medicine|prescription medication)\b",
    r"\bunknown contents?\b",
)


def _value(attrs, instance, name, default=None):
    if name in attrs:
        return attrs[name]
    return getattr(instance, name, default) if instance else default


def apply_task_policy(attrs, instance=None):
    text = " ".join(str(_value(attrs, instance, field, "") or "") for field in ("title", "description", "reward_note")).lower()
    for pattern, message in PROHIBITED_PATTERNS:
        if re.search(pattern, text, flags=re.IGNORECASE):
            raise ValidationError({"description": message})

    involves_item = bool(_value(attrs, instance, "involves_item", False))
    if involves_item:
        item_type = _value(attrs, instance, "item_type", "")
        item_value = _value(attrs, instance, "item_value")
        already_paid = bool(_value(attrs, instance, "item_already_paid", False))
        if not item_type:
            raise ValidationError({"item_type": "Choose the type of item being handled."})
        if item_value is None or Decimal(item_value) <= 0:
            raise ValidationError({"item_value": "Enter the estimated value of the item."})
        if Decimal(item_value) > Decimal(settings.TASK_ITEM_VALUE_LIMIT):
            raise ValidationError({"item_value": f"Neba currently supports items worth up to ₦{settings.TASK_ITEM_VALUE_LIMIT:,.0f}."})
        if not already_paid:
            raise ValidationError({"item_already_paid": "For the MVP, helpers can only collect items that are already paid for."})
        attrs["risk_level"] = Task.RiskLevel.MEDIUM
    else:
        attrs.update({"item_type": "", "item_value": None, "item_already_paid": False, "risk_level": Task.RiskLevel.LOW})

    held = any(re.search(pattern, text, flags=re.IGNORECASE) for pattern in REVIEW_PATTERNS)
    if instance and instance.moderation_status in (Task.ModerationStatus.HELD, Task.ModerationStatus.REJECTED):
        attrs["moderation_status"] = instance.moderation_status
        attrs["moderation_reason"] = instance.moderation_reason
    else:
        attrs["moderation_status"] = Task.ModerationStatus.HELD if held else Task.ModerationStatus.APPROVED
        attrs["moderation_reason"] = "Potentially sensitive item or wording requires a manual review." if held else ""
    attrs["policy_version"] = POLICY_VERSION
    return attrs

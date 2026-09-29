import base64
import hashlib
import hmac
import io
import json
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from cryptography.fernet import Fernet, InvalidToken
from PIL import Image, UnidentifiedImageError
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError
from .models import Block, IdentityVerification, TrustAudit, User

class ProviderUnavailable(APIException):
    status_code = 503
    default_detail = "SMS verification is not available right now. Please try again later."

def phone_configured():
    return bool(settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_VERIFY_SERVICE_SID)

def normalize_phone(value):
    value = re.sub(r"[\s()-]", "", str(value))
    if re.fullmatch(r"0[789]\d{9}", value):
        value = "+234" + value[1:]
    if not re.fullmatch(r"\+[1-9]\d{7,14}", value):
        raise ValidationError({"phone": "Use a valid phone number with country code, e.g. +2348012345678."})
    if not any(value.startswith(prefix) for prefix in settings.PHONE_ALLOWED_PREFIXES):
        raise ValidationError({"phone": "SMS verification is not supported for this country yet."})
    return value

def destination_hash(phone):
    return hmac.new(settings.SECRET_KEY.encode(), phone.encode(), hashlib.sha256).hexdigest()

def twilio_request(resource, values):
    if not phone_configured():
        raise ProviderUnavailable()
    auth = base64.b64encode(f"{settings.TWILIO_ACCOUNT_SID}:{settings.TWILIO_AUTH_TOKEN}".encode()).decode()
    req = Request(
        f"https://verify.twilio.com/v2/Services/{settings.TWILIO_VERIFY_SERVICE_SID}/{resource}",
        data=urlencode(values).encode(),
        headers={"Authorization": "Basic " + auth, "Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urlopen(req, timeout=12) as response:
            return json.load(response)
    except HTTPError as error:
        if resource == "VerificationCheck" and error.code in (400, 404, 429):
            return {"status": "failed"}
        raise ProviderUnavailable() from None
    except (URLError, TimeoutError, ValueError):
        raise ProviderUnavailable() from None

def encryption_key():
    key = settings.VERIFICATION_ENCRYPTION_KEY
    if not key:
        raise ProviderUnavailable("Private verification uploads are not available right now.")
    try:
        return Fernet(key.encode() if isinstance(key, str) else key)
    except (ValueError, TypeError):
        raise ImproperlyConfigured("VERIFICATION_ENCRYPTION_KEY must be a valid Fernet key.") from None

def encrypt_image(upload):
    if not upload or upload.size > 3 * 1024 * 1024:
        raise ValidationError("Choose a JPEG or PNG photo under 3 MB.")
    try:
        raw = upload.read(3 * 1024 * 1024 + 1)
        with Image.open(io.BytesIO(raw)) as image:
            if image.format not in ("JPEG", "PNG") or getattr(image, "n_frames", 1) != 1:
                raise ValidationError("Use a still JPEG or PNG image.")
            if min(image.size) < 200 or max(image.size) > 6000 or image.width * image.height > 20_000_000:
                raise ValidationError("Use a clear photo between 200 and 6000 pixels per side.")
            image.load()
            image = image.convert("RGB")
            image.thumbnail((1600, 1600))
            output = io.BytesIO()
            image.save(output, format="JPEG", quality=88)
            return encryption_key().encrypt(output.getvalue())
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise ValidationError("This file could not be read as a safe photo.") from None

def decrypt_image(value):
    try:
        return encryption_key().decrypt(bytes(value))
    except InvalidToken:
        raise ProviderUnavailable("This verification photo could not be opened.") from None

def blocked_ids(user):
    if not user.is_authenticated:
        return []
    return list(Block.objects.filter(Q(blocker=user) | Q(blocked=user)).values_list("blocker_id", "blocked_id"))

def blocked_user_ids(user):
    return {other for pair in blocked_ids(user) for other in pair if other != user.id}

def are_blocked(first, second):
    return Block.objects.filter(Q(blocker=first, blocked=second) | Q(blocker=second, blocked=first)).exists()

def require_phone(user):
    if not user.is_active or not user.phone:
        raise PermissionDenied("Add a phone number to your profile before continuing.")

def require_profile(user):
    if not user.is_active or not user.profile_complete:
        raise PermissionDenied("Complete your profile photo, phone number, and location before continuing.")

def require_helper(user):
    require_profile(user)

@transaction.atomic
def review_identity(submission, actor, approve, note=""):
    if not actor.is_active or not actor.has_perm("accounts.review_identityverification"):
        raise PermissionDenied("You do not have permission to review identity evidence.")
    submission = IdentityVerification.objects.select_for_update().select_related("user").get(pk=submission.pk)
    user = User.objects.select_for_update().get(pk=submission.user_id)
    if submission.status != IdentityVerification.Status.PENDING:
        raise ValidationError("This submission has already been decided.")
    if approve:
        if not user.is_active or not user.phone or not user.phone_verified_at:
            raise ValidationError("The account must be active and phone verified.")
        if not all((submission.document_checked, submission.face_matched, submission.challenge_matched, submission.adult_checked)):
            raise ValidationError("Confirm the document, face match, camera challenge, and adult eligibility before approval.")
        if not all((submission.document_image, submission.portrait_image, submission.challenge_image)):
            raise ValidationError("All private evidence must be present before approval.")
        submission.status = IdentityVerification.Status.APPROVED
        user.identity_verified_at = timezone.now()
        if not user.profile_photo_key:
            user.profile_photo = submission.portrait_image if submission.publish_photo else b""
            user.photo_visible = submission.publish_photo
    else:
        if not note.strip():
            raise ValidationError("Give the member a reason and a way to correct the submission.")
        submission.status = IdentityVerification.Status.REJECTED
        user.identity_verified_at = None
        if not user.profile_photo_key:
            user.profile_photo = b""
            user.photo_visible = False
    user.save(update_fields=("identity_verified_at", "profile_photo", "photo_visible"))
    submission.reviewed_at = timezone.now()
    submission.reviewed_by = actor
    submission.review_note = note[:500]
    submission.save()
    TrustAudit.objects.create(actor=actor, subject=user, action="identity_approved" if approve else "identity_rejected", note=note[:500])
    from .notifications import notify
    notify(user, "Identity review approved" if approve else "Identity review needs changes", "/verify", note[:300])
    return submission

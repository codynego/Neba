import io
import uuid

from PIL import Image, UnidentifiedImageError
from botocore.exceptions import BotoCoreError, ClientError
from rest_framework import serializers
from rest_framework.exceptions import APIException, ValidationError

from . import r2


ALLOWED_TYPES = ("image/jpeg", "image/png", "image/webp")
MAX_PHOTO_SIZE = 5 * 1024 * 1024
MAX_PHOTOS = 4


class PhotoUploadsUnavailable(APIException):
    status_code = 503
    default_detail = "Photo uploads are not available right now."


def upload_ticket(user, folder, data):
    content_type = serializers.ChoiceField(choices=ALLOWED_TYPES).run_validation(data.get("content_type"))
    serializers.IntegerField(min_value=1, max_value=MAX_PHOTO_SIZE).run_validation(data.get("size"))
    if not r2.configured():
        raise PhotoUploadsUnavailable()
    extension = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[content_type]
    key = f"{folder}/{user.pk}/{uuid.uuid4().hex}.{extension}"
    try:
        url = r2.upload_url(key, content_type)
    except (BotoCoreError, ClientError):
        raise PhotoUploadsUnavailable() from None
    return {"upload_url": url, "key": key, "content_type": content_type, "max_size": MAX_PHOTO_SIZE, "expires_in": 600}


def validate_photo_keys(user, folder, keys):
    keys = list(dict.fromkeys(keys or []))
    if len(keys) > MAX_PHOTOS:
        raise ValidationError(f"Add no more than {MAX_PHOTOS} photos.")
    prefix = f"{folder}/{user.pk}/"
    for key in keys:
        if not isinstance(key, str) or not key.startswith(prefix) or "/" in key[len(prefix):]:
            raise ValidationError("One of these photo uploads does not belong to you.")
        try:
            metadata = r2.object_metadata(key)
            size = int(metadata.get("ContentLength", 0))
            content_type = str(metadata.get("ContentType", "")).lower()
            if not 0 < size <= MAX_PHOTO_SIZE or content_type not in ALLOWED_TYPES:
                raise ValidationError("Choose JPEG, PNG, or WebP photos under 5 MB.")
            raw = r2.object_bytes(key, MAX_PHOTO_SIZE)
            with Image.open(io.BytesIO(raw)) as image:
                if image.format not in ("JPEG", "PNG", "WEBP") or getattr(image, "n_frames", 1) != 1:
                    raise ValidationError("Choose still JPEG, PNG, or WebP photos.")
                if min(image.size) < 200 or max(image.size) > 6000 or image.width * image.height > 20_000_000:
                    raise ValidationError("Use clear photos between 200 and 6000 pixels per side.")
                image.load()
        except ValidationError:
            raise
        except (BotoCoreError, ClientError, UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning):
            raise ValidationError("One of the uploaded photos could not be read safely.") from None
    return keys

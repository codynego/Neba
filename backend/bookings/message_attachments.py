import io
import re
import uuid

from PIL import Image, UnidentifiedImageError
from botocore.exceptions import BotoCoreError, ClientError
from rest_framework import serializers
from rest_framework.exceptions import APIException, ValidationError

from accounts import r2


ALLOWED_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
}
MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024
MAX_ATTACHMENTS = 4


class MessageUploadsUnavailable(APIException):
    status_code = 503
    default_detail = "Message attachments are not available right now. You can still send a text message."


def clean_name(value):
    name = re.sub(r"[\x00-\x1f\x7f]+", "", str(value or "attachment")).strip()
    name = name.replace("/", "-").replace("\\", "-")
    return (name or "attachment")[:120]


def upload_ticket(user, data):
    content_type = serializers.ChoiceField(choices=tuple(ALLOWED_TYPES)).run_validation(data.get("content_type"))
    size = serializers.IntegerField(min_value=1, max_value=MAX_ATTACHMENT_SIZE).run_validation(data.get("size"))
    name = clean_name(data.get("name"))
    if not r2.configured():
        raise MessageUploadsUnavailable()
    key = f"message-attachments/{user.pk}/{uuid.uuid4().hex}.{ALLOWED_TYPES[content_type]}"
    try:
        url = r2.upload_url(key, content_type)
    except (BotoCoreError, ClientError):
        raise MessageUploadsUnavailable() from None
    return {"upload_url": url, "key": key, "name": name, "content_type": content_type, "size": size,
            "max_size": MAX_ATTACHMENT_SIZE, "expires_in": 600}


def validate_attachments(user, values):
    values = values or []
    if len(values) > MAX_ATTACHMENTS:
        raise ValidationError(f"Attach no more than {MAX_ATTACHMENTS} files to one message.")
    checked = []
    seen = set()
    prefix = f"message-attachments/{user.pk}/"
    for value in values:
        key = str(value.get("key", "")) if isinstance(value, dict) else ""
        if not key.startswith(prefix) or "/" in key[len(prefix):] or key in seen:
            raise ValidationError("One of these attachments does not belong to you.")
        seen.add(key)
        name = clean_name(value.get("name"))
        expected_type = str(value.get("content_type", "")).lower()
        try:
            metadata = r2.object_metadata(key)
            size = int(metadata.get("ContentLength", 0))
            content_type = str(metadata.get("ContentType", "")).lower()
            if not 0 < size <= MAX_ATTACHMENT_SIZE or content_type not in ALLOWED_TYPES or content_type != expected_type:
                raise ValidationError("Choose a JPEG, PNG, WebP, or PDF file under 10 MB.")
            raw = r2.object_bytes(key, MAX_ATTACHMENT_SIZE)
            if content_type == "application/pdf":
                if not raw.startswith(b"%PDF-"):
                    raise ValidationError("That PDF file could not be verified.")
            else:
                with Image.open(io.BytesIO(raw)) as image:
                    if image.format not in ("JPEG", "PNG", "WEBP") or getattr(image, "n_frames", 1) != 1:
                        raise ValidationError("Choose a still JPEG, PNG, or WebP image.")
                    if max(image.size) > 8000 or image.width * image.height > 30_000_000:
                        raise ValidationError("That image is too large to display safely.")
                    image.load()
        except ValidationError:
            raise
        except (BotoCoreError, ClientError, UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning):
            raise ValidationError("One of the attachments could not be read safely.") from None
        checked.append({"key": key, "name": name, "content_type": content_type, "size": size})
    return checked


def attachment_response(message, index):
    try:
        attachment = (message.attachments or [])[int(index)]
    except (IndexError, TypeError, ValueError):
        return None
    if not r2.configured():
        raise MessageUploadsUnavailable()
    return {"url": r2.download_url(attachment["key"]),
            "download_url": r2.download_url(attachment["key"], attachment["name"]), "name": attachment["name"],
            "content_type": attachment["content_type"], "size": attachment["size"]}

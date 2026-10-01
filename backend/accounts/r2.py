from functools import lru_cache
import re
import unicodedata

import boto3
from botocore.config import Config
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


def configured():
    return all((settings.R2_ENDPOINT_URL, settings.R2_ACCESS_KEY_ID, settings.R2_SECRET_ACCESS_KEY, settings.R2_BUCKET_NAME))


@lru_cache(maxsize=1)
def client():
    if not configured():
        raise ImproperlyConfigured("Cloudflare R2 is not configured.")
    return boto3.client(
        "s3",
        endpoint_url=settings.R2_ENDPOINT_URL,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )


def upload_url(key, content_type):
    return client().generate_presigned_url(
        "put_object",
        Params={"Bucket": settings.R2_BUCKET_NAME, "Key": key, "ContentType": content_type},
        ExpiresIn=600,
    )


def download_url(key, download_name=None):
    params = {"Bucket": settings.R2_BUCKET_NAME, "Key": key}
    if download_name:
        safe_name = unicodedata.normalize("NFKD", str(download_name)).encode("ascii", "ignore").decode("ascii")
        safe_name = re.sub(r'[^A-Za-z0-9._ -]+', "", safe_name).strip(" .")[:100] or "download"
        params["ResponseContentDisposition"] = f'attachment; filename="{safe_name}"'
    return client().generate_presigned_url(
        "get_object",
        Params=params,
        ExpiresIn=900,
    )


def object_metadata(key):
    return client().head_object(Bucket=settings.R2_BUCKET_NAME, Key=key)


def object_bytes(key, maximum_size):
    response = client().get_object(Bucket=settings.R2_BUCKET_NAME, Key=key)
    return response["Body"].read(maximum_size + 1)


def delete_object(key):
    if key:
        client().delete_object(Bucket=settings.R2_BUCKET_NAME, Key=key)

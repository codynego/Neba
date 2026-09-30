import os
from pathlib import Path

import dj_database_url
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent


def env_list(name, default=""):
    return [value.strip() for value in os.getenv(name, default).split(",") if value.strip()]


SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "development-only-change-me")
DEBUG = os.getenv("DJANGO_DEBUG", "false").lower() == "true"
IS_VERCEL = bool(os.getenv("VERCEL"))

if IS_VERCEL and SECRET_KEY == "development-only-change-me":
    raise ImproperlyConfigured("DJANGO_SECRET_KEY must be set outside development.")

ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")
if IS_VERCEL:
    ALLOWED_HOSTS.append(".vercel.app")
    if os.getenv("VERCEL_URL"):
        ALLOWED_HOSTS.append(os.environ["VERCEL_URL"])

INSTALLED_APPS = [
    "django.contrib.admin", "django.contrib.auth", "django.contrib.contenttypes",
    "django.contrib.sessions", "django.contrib.messages", "django.contrib.staticfiles",
    "rest_framework", "rest_framework.authtoken", "corsheaders",
    "accounts.apps.AccountsConfig", "locations", "tasks", "offers", "bookings",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
ROOT_URLCONF = "config.urls"
TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [], "APP_DIRS": True,
    "OPTIONS": {"context_processors": [
        "django.template.context_processors.debug",
        "django.template.context_processors.request",
        "django.contrib.auth.context_processors.auth",
        "django.contrib.messages.context_processors.messages",
    ]},
}]
WSGI_APPLICATION = "config.wsgi.application"
database_url = os.getenv("DATABASE_URL")
if IS_VERCEL and not database_url:
    raise ImproperlyConfigured("DATABASE_URL must be set for Vercel deployments.")
DATABASES = {
    "default": dj_database_url.parse(
        database_url or f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=0,
        conn_health_checks=True,
    )
}
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
AUTH_USER_MODEL = "accounts.User"
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework.authentication.TokenAuthentication", "rest_framework.authentication.SessionAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticatedOrReadOnly"],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.ScopedRateThrottle"],
    "DEFAULT_THROTTLE_RATES": {
        "phone_send": "5/hour", "phone_check": "15/hour", "identity_submit": "3/day",
        "capture_challenge": "10/hour", "safety_report": "10/hour", "block_user": "30/hour",
        "task_messages": "120/hour",
        "register": "5/hour", "login": "10/hour", "password_reset": "5/hour",
        "email_verification": "5/hour",
    },
}
CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", "http://localhost:3000")
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS")
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Africa/Lagos"
USE_I18N = True
USE_TZ = True
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

redis_url = os.getenv("REDIS_URL")
if redis_url:
    CACHES = {
        "default": {
            "BACKEND": "django_redis.cache.RedisCache",
            "LOCATION": redis_url,
            "OPTIONS": {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
        }
    }

API_CACHE_TTLS = {
    "cities": int(os.getenv("CITY_CACHE_TTL_SECONDS", "3600")),
    "tasks": int(os.getenv("TASK_LIST_CACHE_TTL_SECONDS", "60")),
    "offers": int(os.getenv("OFFER_LIST_CACHE_TTL_SECONDS", "60")),
    "profiles": int(os.getenv("PUBLIC_PROFILE_CACHE_TTL_SECONDS", "120")),
}

if IS_VERCEL and not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = int(os.getenv("DJANGO_SECURE_HSTS_SECONDS", "31536000"))
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = "same-origin"

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_VERIFY_SERVICE_SID = os.getenv("TWILIO_VERIFY_SERVICE_SID", "")
PHONE_ALLOWED_PREFIXES = tuple(x.strip() for x in os.getenv("PHONE_ALLOWED_PREFIXES", "+234").split(",") if x.strip())
VERIFICATION_ENCRYPTION_KEY = os.getenv("VERIFICATION_ENCRYPTION_KEY", "")
VERIFICATION_RETENTION_DAYS = int(os.getenv("VERIFICATION_RETENTION_DAYS", "30"))
R2_ENDPOINT_URL = os.getenv("R2_ENDPOINT_URL", "")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID", "")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY", "")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME", "")
TASK_ITEM_VALUE_LIMIT = int(os.getenv("TASK_ITEM_VALUE_LIMIT", "50000"))
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
DEFAULT_FROM_EMAIL = os.getenv("EMAIL_FROM", "GetNeba <notifications@getneba.app>")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://www.getneba.app").rstrip("/")
EMAIL_HTTP_TIMEOUT_SECONDS = int(os.getenv("EMAIL_HTTP_TIMEOUT_SECONDS", "10"))
NEARBY_EMAIL_BATCH_LIMIT = min(int(os.getenv("NEARBY_EMAIL_BATCH_LIMIT", "50")), 100)
DATA_UPLOAD_MAX_MEMORY_SIZE = 12 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 3 * 1024 * 1024

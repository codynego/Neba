import os
from datetime import timedelta
from pathlib import Path

import dj_database_url
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Load local development settings for plain Django commands such as
# `python manage.py migrate`. Vercel's environment variables remain the
# source of truth in deployment because existing variables are not replaced.
load_dotenv(BASE_DIR / ".env.local", override=False)
load_dotenv(BASE_DIR / ".env", override=False)


def env_list(name, default=""):
    return [value.strip() for value in os.getenv(name, default).split(",") if value.strip()]


SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "development-only-change-me")
DEBUG = os.getenv("DJANGO_DEBUG", "false").lower() == "true"
IS_VERCEL = bool(os.getenv("VERCEL"))
LEGACY_MARKETPLACE_ENABLED = os.getenv("LEGACY_MARKETPLACE_ENABLED", "false").lower() == "true"

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
    "rest_framework", "rest_framework.authtoken", "rest_framework_simplejwt.token_blacklist", "corsheaders",
    "accounts.apps.AccountsConfig", "billing.apps.BillingConfig", "locations", "tasks", "offers", "bookings", "opportunities.apps.OpportunitiesConfig",
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
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework_simplejwt.authentication.JWTAuthentication", "rest_framework.authentication.SessionAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticatedOrReadOnly"],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.ScopedRateThrottle"],
    "DEFAULT_THROTTLE_RATES": {
        "phone_send": "5/hour", "phone_check": "15/hour", "identity_submit": "3/day",
        "capture_challenge": "10/hour", "safety_report": "10/hour", "block_user": "30/hour",
        "task_messages": "120/hour", "application_messages": "120/hour",
        "opportunity_check": "10/hour",
        "register": "5/hour", "login": "10/hour", "password_reset": "5/hour",
        "email_verification": "5/hour",
    },
}
CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", "http://localhost:3000")
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS")
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=10),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": False,
    "AUTH_HEADER_TYPES": ("Bearer",),
}
AUTH_REFRESH_COOKIE = "getneba_refresh"
AUTH_COOKIE_SECURE = os.getenv("AUTH_COOKIE_SECURE")
AUTH_COOKIE_SAMESITE = os.getenv("AUTH_COOKIE_SAMESITE")
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
WEB_PUSH_VAPID_PUBLIC_KEY = os.getenv("WEB_PUSH_VAPID_PUBLIC_KEY", "")
WEB_PUSH_VAPID_PRIVATE_KEY = os.getenv("WEB_PUSH_VAPID_PRIVATE_KEY", "")
WEB_PUSH_VAPID_SUBJECT = os.getenv("WEB_PUSH_VAPID_SUBJECT", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_REALTIME_MODEL = os.getenv("OPENAI_REALTIME_MODEL", "gpt-realtime")
OPENAI_TEXT_MODEL = os.getenv("OPENAI_TEXT_MODEL", "gpt-4.1-mini")
OPPORTUNITY_CHECK_MODEL = os.getenv("OPPORTUNITY_CHECK_MODEL", OPENAI_TEXT_MODEL)
OPPORTUNITY_FEED_URLS = env_list("OPPORTUNITY_FEED_URLS", "https://www.afdb.org/en/vacancies/news-and-events/rss")
OPPORTUNITY_FETCH_LIMIT = min(int(os.getenv("OPPORTUNITY_FETCH_LIMIT", "5")), 20)
CRON_SECRET = os.getenv("CRON_SECRET", "")
BACHS_API_KEY = os.getenv("BACHS_API_KEY", "")
BACHS_WEBHOOK_SECRET = os.getenv("BACHS_WEBHOOK_SECRET", "")
BACHS_BASE_URL = os.getenv("BACHS_BASE_URL", "").rstrip("/") or (
    "https://api.bachs.io" if BACHS_API_KEY.startswith("sk_live_") else "https://sandbox-api.bachs.io"
)
BACHS_PLUS_MONTHLY_PRODUCT_ID = os.getenv("BACHS_PLUS_MONTHLY_PRODUCT_ID", "")
BACHS_PLUS_YEARLY_PRODUCT_ID = os.getenv("BACHS_PLUS_YEARLY_PRODUCT_ID", "")
BILLING_PLUS_MONTHLY_PRICE = os.getenv("BILLING_PLUS_MONTHLY_PRICE", "5.00")
BILLING_PLUS_YEARLY_PRICE = os.getenv("BILLING_PLUS_YEARLY_PRICE", "48.00")
BILLING_PLUS_CURRENCY = os.getenv("BILLING_PLUS_CURRENCY", "USD").upper()
DATA_UPLOAD_MAX_MEMORY_SIZE = 12 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 3 * 1024 * 1024

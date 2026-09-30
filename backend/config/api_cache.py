import hashlib
import json

from django.conf import settings
from django.core.cache import cache
from rest_framework.response import Response


VERSION_PREFIX = "neba:api-cache-version"


def cache_ttl(name, default=60):
    return int(getattr(settings, "API_CACHE_TTLS", {}).get(name, default))


def cache_version(namespace):
    key = f"{VERSION_PREFIX}:{namespace}"
    version = cache.get(key)
    if version is None:
        cache.add(key, 1, timeout=None)
        version = cache.get(key, 1)
    return int(version)


def invalidate_cache(namespace):
    key = f"{VERSION_PREFIX}:{namespace}"
    try:
        cache.incr(key)
    except ValueError:
        cache.set(key, 2, timeout=None)


def request_cache_key(namespace, request, scope="public"):
    query = sorted((key, sorted(values)) for key, values in request.query_params.lists())
    identity = {
        "host": request.get_host(),
        "path": request.path,
        "query": query,
        "scope": scope,
    }
    digest = hashlib.sha256(json.dumps(identity, separators=(",", ":")).encode()).hexdigest()
    return f"neba:api:{namespace}:v{cache_version(namespace)}:{digest}"


class CachedListMixin:
    cache_namespace = None
    cache_timeout = 60

    def should_cache_list(self):
        return True

    def cache_scope(self):
        user = self.request.user
        return f"user:{user.pk}" if user.is_authenticated else "public"

    def list(self, request, *args, **kwargs):
        if not self.cache_namespace or not self.should_cache_list():
            return super().list(request, *args, **kwargs)

        key = request_cache_key(self.cache_namespace, request, self.cache_scope())
        cached = cache.get(key)
        if cached is not None:
            response = Response(cached)
            response["X-Neba-Cache"] = "HIT"
            return response

        response = super().list(request, *args, **kwargs)
        if response.status_code == 200:
            cache.set(key, response.data, timeout=self.cache_timeout)
            response["X-Neba-Cache"] = "MISS"
        return response

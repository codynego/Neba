from django.core.cache import cache
from rest_framework.test import APITestCase

from .models import City


class CityCacheTests(APITestCase):
    def setUp(self):
        cache.clear()

    def test_city_list_is_cached_and_invalidated_on_write(self):
        City.objects.create(name="Abuja", state="FCT")
        first = self.client.get("/api/cities/")
        second = self.client.get("/api/cities/")
        self.assertEqual(first["X-Neba-Cache"], "MISS")
        self.assertEqual(second["X-Neba-Cache"], "HIT")

        City.objects.create(name="Lagos", state="Lagos")
        refreshed = self.client.get("/api/cities/")
        self.assertEqual(refreshed["X-Neba-Cache"], "MISS")
        self.assertEqual(refreshed.data["count"], 2)

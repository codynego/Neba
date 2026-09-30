from django.contrib.auth import get_user_model
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from bookings.models import Application
from locations.models import City
from offers.models import Offer
from tasks.models import Task

from config.api_cache import invalidate_cache
from .models import Block, Review


def invalidate(*names):
    for name in names:
        invalidate_cache(name)


@receiver((post_save, post_delete), sender=City)
def city_changed(**kwargs):
    invalidate("cities")


@receiver((post_save, post_delete), sender=Task)
def task_changed(**kwargs):
    invalidate("tasks", "profiles")


@receiver((post_save, post_delete), sender=Offer)
def offer_changed(**kwargs):
    invalidate("offers", "profiles")


@receiver((post_save, post_delete), sender=Application)
def application_changed(**kwargs):
    invalidate("tasks", "profiles")


@receiver((post_save, post_delete), sender=Review)
def review_changed(**kwargs):
    invalidate("tasks", "offers", "profiles")


@receiver((post_save, post_delete), sender=Block)
def block_changed(**kwargs):
    invalidate("tasks", "offers", "profiles")


@receiver((post_save, post_delete), sender=get_user_model())
def user_changed(**kwargs):
    invalidate("tasks", "offers", "profiles")

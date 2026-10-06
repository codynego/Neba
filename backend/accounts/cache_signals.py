from django.contrib.auth import get_user_model
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from config.api_cache import invalidate_cache
from .models import Block


def invalidate(*names):
    for name in names:
        invalidate_cache(name)


@receiver((post_save, post_delete), sender=Block)
def block_changed(**kwargs):
    invalidate("profiles")


@receiver((post_save, post_delete), sender=get_user_model())
def user_changed(**kwargs):
    invalidate("profiles")

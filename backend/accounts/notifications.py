from django.db import transaction

from .models import Notification
from .push import deliver

def notify(user, title, path, detail=""):
    if user.is_active:
        notification = Notification.objects.create(recipient=user, title=title[:140], path=path[:200], detail=detail[:300])
        transaction.on_commit(lambda: deliver(notification.pk))
        return notification

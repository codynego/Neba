from .models import Notification

def notify(user, title, path, detail=""):
    if user.is_active:
        return Notification.objects.create(recipient=user, title=title[:140], path=path, detail=detail[:300])

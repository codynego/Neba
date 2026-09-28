from datetime import timedelta
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from accounts.models import IdentityVerification, PhoneSendAttempt, CaptureChallenge, TrustAudit

class Command(BaseCommand):
    help = "Remove expired identity evidence. Schedule daily; opt-in profile photos remain until consent withdrawal."
    def handle(self, *args, **options):
        cutoff = timezone.now() - timedelta(days=settings.VERIFICATION_RETENTION_DAYS)
        count = 0
        with transaction.atomic():
            for submission in IdentityVerification.objects.select_for_update().filter(created_at__lt=cutoff):
                if not any((submission.document_image, submission.portrait_image, submission.challenge_image)):
                    continue
                submission.document_image = submission.portrait_image = submission.challenge_image = b""
                if submission.status == "pending":
                    submission.status = "expired"
                submission.full_name = ""
                submission.save(update_fields=("document_image", "portrait_image", "challenge_image", "status", "full_name"))
                TrustAudit.objects.create(subject=submission.user, action="evidence_purged", note=f"submission {submission.pk}")
                count += 1
            PhoneSendAttempt.objects.filter(created_at__lt=cutoff).delete()
            CaptureChallenge.objects.filter(expires_at__lt=cutoff).delete()
        self.stdout.write(f"Purged evidence from {count} submissions.")

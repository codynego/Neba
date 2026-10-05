from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from bookings.models import Application, ApplicationMessage, TaskChange, TaskIssue, TaskMessage
from locations.models import City
from offers.models import Offer
from tasks.models import Task


class Command(BaseCommand):
    help = "Dry-run or purge legacy task marketplace data without touching users or opportunities."

    def add_arguments(self, parser):
        parser.add_argument("--confirm", action="store_true", help="Permanently delete the legacy marketplace records.")

    def handle(self, *args, **options):
        counts = {
            "tasks": Task.objects.count(),
            "offers": Offer.objects.count(),
            "applications": Application.objects.count(),
            "application_messages": ApplicationMessage.objects.count(),
            "task_messages": TaskMessage.objects.count(),
            "task_changes": TaskChange.objects.count(),
            "task_issues": TaskIssue.objects.count(),
            "cities": City.objects.count(),
        }
        self.stdout.write("Legacy marketplace records:")
        for name, count in counts.items():
            self.stdout.write(f"  {name}: {count}")
        if not options["confirm"]:
            self.stdout.write(self.style.WARNING("Dry run only. Re-run with --confirm to permanently delete these records."))
            return
        if not counts["tasks"] and not counts["offers"] and not counts["cities"]:
            self.stdout.write("Nothing to delete.")
            return
        try:
            with transaction.atomic():
                Task.objects.all().delete()
                Offer.objects.all().delete()
                City.objects.all().delete()
        except Exception as error:
            raise CommandError(f"Legacy marketplace purge rolled back: {error}") from error
        self.stdout.write(self.style.SUCCESS("Legacy marketplace records deleted. Users, organizations, opportunities, and notifications were not targeted."))

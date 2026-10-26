"""Import official tender notices into Neba's moderation queue.

The importers intentionally favour a smaller set of actionable notices over a
large unreviewed archive: each record must have a future deadline and an
official detail or document URL. Nothing is published automatically.
"""

import gzip
import json
from datetime import timedelta

import requests
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from opportunities.management.commands.fetch_opportunities import DEFAULT_USER_AGENT, clean_text, parse_date
from opportunities.models import Opportunity


NOCOPO_PROVIDER = "Nigeria Bureau of Public Procurement (NOCOPO)"
WORLD_BANK_PROVIDER = "World Bank"


def nested_values(value):
    """Yield every mapping from a variable-shaped public API response."""
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from nested_values(child)
    elif isinstance(value, list):
        for child in value:
            yield from nested_values(child)


def first_url(*collections):
    for collection in collections:
        for item in collection or []:
            if isinstance(item, dict) and str(item.get("url") or "").startswith(("https://", "http://")):
                return str(item["url"])
    return ""


def nocopo_rows(content):
    """Extract open Nigerian tender releases from OCDS JSONL/Gzip data."""
    try:
        text = gzip.decompress(content).decode("utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        raise CommandError(f"Invalid NOCOPO gzip data: {exc}") from exc

    for line in text.splitlines():
        try:
            record = json.loads(line)
        except json.JSONDecodeError:
            continue
        release = record.get("compiledRelease") or record.get("release") or record
        if not isinstance(release, dict):
            continue
        tender = release.get("tender") or {}
        title = clean_text(tender.get("title"), 220)
        deadline = parse_date((tender.get("tenderPeriod") or {}).get("endDate"))
        source_url = first_url(tender.get("documents"), release.get("documents"))
        if not title or not deadline or not source_url:
            continue
        yield {
            "title": title,
            "summary": clean_text(tender.get("description"), 1800),
            "provider": clean_text((release.get("buyer") or {}).get("name"), 180) or NOCOPO_PROVIDER,
            "deadline": deadline,
            "source_url": source_url,
            "reference": str(tender.get("id") or release.get("ocid") or ""),
            "country": "Nigeria",
            "eligible_countries": ["Nigeria"],
        }


def world_bank_rows(payload):
    """Normalise the World Bank's public procurement-notices JSON response."""
    seen = set()
    for item in nested_values(payload):
        title = clean_text(item.get("notice_title") or item.get("title"), 220)
        deadline = parse_date(item.get("submission_deadline_date") or item.get("deadline"))
        notice_id = str(item.get("id") or item.get("notice_id") or "").strip()
        source_url = str(item.get("notice_url") or item.get("url") or "").strip()
        if not source_url and notice_id:
            source_url = f"https://projects.worldbank.org/en/projects-operations/procurement-detail?procurementId={notice_id}"
        key = source_url or notice_id
        if not title or not deadline or not key or key in seen:
            continue
        seen.add(key)
        country = clean_text(item.get("project_ctry_name") or item.get("country"), 120)
        yield {
            "title": title,
            "summary": clean_text(" · ".join(filter(None, (item.get("project_name"), item.get("notice_type")))), 1800),
            "provider": WORLD_BANK_PROVIDER,
            "deadline": deadline,
            "source_url": source_url,
            "reference": notice_id,
            "country": country,
            "eligible_countries": [],
        }


def queue_tender(row, source_name):
    if Opportunity.objects.filter(source_url=row["source_url"]).exists():
        return False
    deadline = row["deadline"]
    if deadline <= timezone.now():
        return False
    reference = f" Reference: {row['reference']}." if row.get("reference") else ""
    Opportunity.objects.create(
        title=row["title"],
        provider=row["provider"],
        summary=row["summary"] or f"Official tender notice from {source_name}.",
        category=Opportunity.Category.TENDER,
        application_mode=Opportunity.ApplicationMode.EXTERNAL,
        application_url=row["source_url"],
        source_url=row["source_url"],
        deadline=deadline,
        country=row["country"],
        eligible_countries=row["eligible_countries"],
        requires_business=True,
        review_status=Opportunity.ReviewStatus.PENDING,
        is_published=False,
        review_note=f"Imported from {source_name}; verify deadline, eligibility, and official instructions before publishing.{reference}",
    )
    return True


class Command(BaseCommand):
    help = "Fetch official Nigerian and World Bank tender notices into the review queue."

    def add_arguments(self, parser):
        parser.add_argument("--source", choices=("all", "nocopo", "world-bank"), default="all")
        parser.add_argument("--limit", type=int, default=None)
        parser.add_argument("--timeout", type=int, default=12)

    def handle(self, *args, **options):
        from django.conf import settings

        limit = options["limit"] or settings.TENDER_FETCH_LIMIT
        if limit < 1:
            raise CommandError("--limit must be at least 1")
        sources = []
        if options["source"] in ("all", "nocopo"):
            sources.append(("NOCOPO", settings.TENDER_NOCOPO_URL, "binary", nocopo_rows))
        if options["source"] in ("all", "world-bank"):
            sources.append(("World Bank", settings.TENDER_WORLD_BANK_URL, "json", world_bank_rows))

        created = 0
        for source_name, source_url, kind, parser in sources:
            if created >= limit:
                break
            try:
                response = requests.get(source_url, headers={"User-Agent": DEFAULT_USER_AGENT}, timeout=options["timeout"])
                response.raise_for_status()
                rows = parser(response.content if kind == "binary" else response.json())
                for row in rows:
                    if created >= limit:
                        break
                    if queue_tender(row, source_name):
                        created += 1
                        self.stdout.write(f"Queued: {row['title']}")
            except (requests.RequestException, ValueError, CommandError) as exc:
                self.stderr.write(self.style.WARNING(f"Skipped {source_name}: {exc}"))
        self.stdout.write(self.style.SUCCESS(f"Queued {created} new tender{'s' if created != 1 else ''} for review."))

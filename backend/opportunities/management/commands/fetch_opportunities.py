import json
import re
from email.utils import parsedate_to_datetime
from html import unescape
from urllib.parse import urlparse
from xml.etree import ElementTree

import requests
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from opportunities.models import Opportunity


DEFAULT_USER_AGENT = "GetNebaOpportunityFetcher/1.0"
SUPPORTED_CATEGORIES = {value for value, _ in Opportunity.Category.choices}


def clean_text(value, limit=None):
    value = re.sub(r"<[^>]+>", " ", unescape(str(value or "")))
    value = re.sub(r"\s+", " ", value).strip()
    return value[:limit] if limit else value


def category_for(title, description):
    text = f"{title} {description}".lower()
    terms = {
        "scholarship": ("scholarship", "scholarships", "funded study", "tuition"),
        "grant": ("grant", "grants", "non-repayable"),
        "internship": ("internship", "intern", "industrial attachment"),
        "fellowship": ("fellowship", "fellows"),
        "competition": ("competition", "challenge", "prize"),
        "training": ("training", "bootcamp", "course", "workshop"),
        "startup": ("startup", "accelerator", "incubator"),
        "tender": ("tender", "procurement", "rfq"),
        "job": ("job", "hiring", "vacancy", "career"),
    }
    for category, keywords in terms.items():
        if any(keyword in text for keyword in keywords):
            return category
    return "funding" if any(word in text for word in ("fund", "finance", "capital")) else "grant"


def parse_date(value):
    if not value:
        return None
    try:
        parsed = parsedate_to_datetime(str(value))
        return parsed.astimezone(timezone.get_current_timezone()) if parsed.tzinfo else timezone.make_aware(parsed)
    except (TypeError, ValueError, OverflowError):
        try:
            parsed = timezone.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else timezone.make_aware(parsed)
        except (TypeError, ValueError, OverflowError):
            return None


def first_value(item, *keys):
    for key in keys:
        value = item.get(key)
        if value:
            return value
    return ""


def parse_json_items(payload):
    if isinstance(payload, list):
        return payload
    for key in ("items", "opportunities", "results", "data"):
        value = payload.get(key) if isinstance(payload, dict) else None
        if isinstance(value, list):
            return value
    return []


def parse_feed(content, content_type, source_url):
    if "json" in content_type or content.lstrip().startswith(("{", "[")):
        try:
            payload = json.loads(content)
        except json.JSONDecodeError as exc:
            raise CommandError(f"Invalid JSON feed {source_url}: {exc}") from exc
        rows = []
        for item in parse_json_items(payload):
            if not isinstance(item, dict):
                continue
            link = first_value(item, "url", "link", "application_url", "source_url")
            title = clean_text(first_value(item, "title", "name"), 220)
            description = clean_text(first_value(item, "summary", "description", "content", "excerpt"), 1800)
            if title and link:
                rows.append({"title": title, "description": description, "link": link, "deadline": first_value(item, "deadline", "closing_date", "end_date"), "provider": clean_text(first_value(item, "provider", "organization", "company"), 180)})
        return rows

    try:
        root = ElementTree.fromstring(content)
    except ElementTree.ParseError as exc:
        raise CommandError(f"Invalid XML feed {source_url}: {exc}") from exc
    rows = []
    for item in root.findall(".//item") + root.findall(".//{http://www.w3.org/2005/Atom}entry"):
        def text(*names):
            for name in names:
                node = item.find(name)
                if node is None:
                    node = item.find(f"{{http://www.w3.org/2005/Atom}}{name}")
                if node is not None and (node.text or node.attrib.get("href")):
                    return node.text or node.attrib.get("href")
            return ""

        link = text("link")
        if not link:
            atom_link = item.find("{http://www.w3.org/2005/Atom}link")
            link = atom_link.attrib.get("href", "") if atom_link is not None else ""
        title = clean_text(text("title"), 220)
        description = clean_text(text("description", "summary", "content"), 1800)
        if title and link:
            rows.append({"title": title, "description": description, "link": link, "deadline": text("deadline", "closingDate", "published"), "provider": ""})
    return rows


class Command(BaseCommand):
    help = "Fetch a small number of opportunities into the manual review queue."

    def add_arguments(self, parser):
        parser.add_argument("--source", action="append", dest="sources", help="RSS, Atom, or JSON feed URL. May be repeated.")
        parser.add_argument("--limit", type=int, default=None, help="Maximum new opportunities to save across all feeds.")
        parser.add_argument("--timeout", type=int, default=15, help="Feed request timeout in seconds.")

    def handle(self, *args, **options):
        from django.conf import settings

        sources = options.get("sources") or getattr(settings, "OPPORTUNITY_FEED_URLS", [])
        limit = options.get("limit") or getattr(settings, "OPPORTUNITY_FETCH_LIMIT", 5)
        if not sources:
            self.stdout.write(self.style.WARNING("No opportunity feeds configured; nothing fetched."))
            return
        if limit < 1:
            raise CommandError("--limit must be at least 1")

        created = 0
        for source_url in sources:
            if created >= limit:
                break
            try:
                response = requests.get(source_url, headers={"User-Agent": DEFAULT_USER_AGENT}, timeout=options["timeout"])
                response.raise_for_status()
                rows = parse_feed(response.text, response.headers.get("content-type", ""), source_url)
            except (requests.RequestException, CommandError) as exc:
                self.stderr.write(self.style.WARNING(f"Skipped {source_url}: {exc}"))
                continue
            provider_default = urlparse(source_url).netloc.removeprefix("www.") or "Source"
            for row in rows:
                if created >= limit:
                    break
                link = str(row["link"]).strip()
                if not link or Opportunity.objects.filter(source_url=link).exists():
                    continue
                title = clean_text(row["title"], 220)
                summary = clean_text(row["description"], 1800) or f"Review this opportunity on {provider_default}."
                if not title:
                    continue
                provider = row["provider"] or provider_default
                Opportunity.objects.create(
                    title=title,
                    provider=provider,
                    summary=summary,
                    category=category_for(title, summary),
                    application_mode=Opportunity.ApplicationMode.EXTERNAL,
                    application_url=link,
                    source_url=link,
                    deadline=parse_date(row.get("deadline")),
                    review_status=Opportunity.ReviewStatus.PENDING,
                    is_published=False,
                    review_note="Fetched automatically; awaiting manual review.",
                )
                created += 1
                self.stdout.write(f"Queued: {title}")
        self.stdout.write(self.style.SUCCESS(f"Fetched {created} new opportunit{'y' if created == 1 else 'ies'} for review."))

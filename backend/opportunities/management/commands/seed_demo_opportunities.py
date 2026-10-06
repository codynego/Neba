from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from opportunities.models import Opportunity


class Command(BaseCommand):
    help = "Create or update a small set of published demo opportunities for local development."

    def handle(self, *args, **options):
        now = timezone.now()
        demo_rows = [
            {
                "title": "Technical Co-founder Wanted",
                "provider": "Kora Labs",
                "summary": "Help shape a young product from the ground up. We are looking for a hands-on technical co-founder to turn an early prototype into a useful product for African businesses.",
                "category": Opportunity.Category.STARTUP,
                "benefit": "Co-founder role · Equity discussion",
                "deadline": now + timedelta(days=20),
                "country": "Nigeria",
                "location_label": "Lagos or Remote",
                "is_remote": True,
                "eligibility_notes": "Open to builders with product experience and a practical startup mindset.",
                "eligible_countries": ["Nigeria", "Ghana", "Kenya"],
                "education_levels": [],
                "fields_of_study": ["Computer Science", "Engineering", "Product Design"],
                "employment_statuses": ["Self-employed", "Employed", "Seeking work"],
                "application_url": "https://example.com/getneba-demo/kora-labs",
            },
            {
                "title": "Backend Developer — Fintech Project",
                "provider": "Northstar Finance",
                "summary": "Join a small product team building safer, simpler tools for small businesses. You will help design APIs, improve reliability, and work closely with product and frontend teammates.",
                "category": Opportunity.Category.JOB,
                "benefit": "₦150,000 monthly stipend",
                "deadline": now + timedelta(days=12),
                "country": "Nigeria",
                "location_label": "Lagos",
                "is_remote": False,
                "eligibility_notes": "Comfort with Python, Django or another backend framework, and relational databases.",
                "eligible_countries": ["Nigeria"],
                "education_levels": ["Undergraduate", "Graduate / postgraduate", "Recent graduate"],
                "fields_of_study": ["Computer Science", "Engineering", "Information Technology"],
                "employment_statuses": ["Employed", "Seeking work", "Self-employed"],
                "application_url": "https://example.com/getneba-demo/northstar-finance",
            },
            {
                "title": "Women Build Digital Skills Fellowship",
                "provider": "Makers Circle Africa",
                "summary": "A practical 10-week fellowship for women across Africa who want to grow confidence in digital work, collaborate with peers, and build a portfolio project.",
                "category": Opportunity.Category.FELLOWSHIP,
                "benefit": "Fully funded · Mentorship included",
                "deadline": now + timedelta(days=28),
                "country": "Nigeria",
                "location_label": "Africa-wide · Remote",
                "is_remote": True,
                "eligibility_notes": "Designed for early-career women with an interest in technology, design, research, or digital business.",
                "eligible_countries": ["Nigeria", "Ghana", "Kenya", "South Africa"],
                "education_levels": ["Undergraduate", "Graduate / postgraduate", "Recent graduate", "Not currently studying"],
                "fields_of_study": ["Computer Science", "Design", "Business", "Social Sciences"],
                "employment_statuses": ["Student", "Seeking work", "Self-employed", "Between roles"],
                "application_url": "https://example.com/getneba-demo/makers-circle",
            },
            {
                "title": "Early-Stage Founder Grant",
                "provider": "The Launch Fund",
                "summary": "Non-dilutive support for founders testing a clear business idea and building their first repeatable customer pipeline.",
                "category": Opportunity.Category.GRANT,
                "benefit": "₦500,000 grant · Founder coaching",
                "deadline": now + timedelta(days=36),
                "country": "Nigeria",
                "location_label": "Nigeria",
                "is_remote": True,
                "eligibility_notes": "Your business should have a defined customer problem and an early validation signal.",
                "eligible_countries": ["Nigeria"],
                "education_levels": [],
                "fields_of_study": ["Business", "Engineering", "Agriculture", "Technology"],
                "employment_statuses": ["Self-employed", "Employed"],
                "requires_business": True,
                "application_url": "https://example.com/getneba-demo/launch-fund",
            },
            {
                "title": "Data Analysis Career Starter Bootcamp",
                "provider": "Open Path Academy",
                "summary": "Build practical foundations in spreadsheets, SQL, dashboards, and communicating insights through a guided eight-week learning sprint.",
                "category": Opportunity.Category.TRAINING,
                "benefit": "Free · Certificate on completion",
                "deadline": now + timedelta(days=16),
                "country": "Nigeria",
                "location_label": "Remote",
                "is_remote": True,
                "eligibility_notes": "Open to learners changing direction or building their first portfolio in data work.",
                "eligible_countries": ["Nigeria", "Ghana", "Kenya"],
                "education_levels": ["Secondary school", "Undergraduate", "Graduate / postgraduate", "Vocational / technical training", "Recent graduate"],
                "fields_of_study": ["Computer Science", "Statistics", "Business", "Economics"],
                "employment_statuses": ["Student", "Seeking work", "Between roles", "Employed"],
                "application_url": "https://example.com/getneba-demo/open-path",
            },
            {
                "title": "Future Makers Undergraduate Scholarship",
                "provider": "Bright Steps Foundation",
                "summary": "Tuition and learning support for Nigerian undergraduates with strong academic promise and a clear plan for using their education to create impact.",
                "category": Opportunity.Category.SCHOLARSHIP,
                "benefit": "Tuition support · Learning allowance",
                "deadline": now + timedelta(days=45),
                "country": "Nigeria",
                "location_label": "Nigeria",
                "is_remote": False,
                "eligibility_notes": "For current undergraduate students with financial need and a consistent academic record.",
                "eligible_countries": ["Nigeria"],
                "education_levels": ["Undergraduate"],
                "fields_of_study": ["Computer Science", "Engineering", "Medicine", "Education", "Agriculture"],
                "employment_statuses": ["Student"],
                "min_age": 16,
                "max_age": 30,
                "application_url": "https://example.com/getneba-demo/bright-steps",
            },
        ]

        created = 0
        updated = 0
        for row in demo_rows:
            defaults = {
                **row,
                "is_published": True,
                "review_status": Opportunity.ReviewStatus.APPROVED,
                "source_url": row["application_url"],
            }
            opportunity, was_created = Opportunity.objects.update_or_create(
                title=row["title"], provider=row["provider"], defaults=defaults
            )
            created += int(was_created)
            updated += int(not was_created)
            self.stdout.write(f"{'Created' if was_created else 'Updated'}: {opportunity.title}")

        self.stdout.write(self.style.SUCCESS(f"Seeded {created} demo opportunities ({updated} updated)."))

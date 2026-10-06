from datetime import date, timedelta
from io import StringIO
from unittest.mock import Mock, patch

from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import User
from .models import Opportunity


class OpportunityApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="radar", email="radar@example.test", display_name="Radar User", password="test-password-123", country="Nigeria", education_level="Undergraduate", field_of_study="Computer Science", opportunity_interests=["scholarship"])
        self.client.force_authenticate(self.user)
        self.opportunity = Opportunity.objects.create(title="Developer Scholarship", provider="Example Foundation", summary="Funding for undergraduate developers.", category="scholarship", application_url="https://example.test/apply", deadline=timezone.now() + timedelta(days=14), eligible_countries=["Nigeria"], education_levels=["Undergraduate"], fields_of_study=["Computer Science"])

    def test_dashboard_returns_transparent_match_and_tracker_actions_work(self):
        dashboard = self.client.get("/api/opportunities/dashboard/")
        self.assertEqual(dashboard.status_code, 200, dashboard.data)
        self.assertEqual(dashboard.data["match_count"], 1)
        self.assertGreaterEqual(dashboard.data["top_matches"][0]["match"]["score"], 55)
        saved = self.client.post(f"/api/opportunities/{self.opportunity.public_id}/save/", {}, format="json")
        self.assertEqual(saved.status_code, 201, saved.data)
        application = self.client.post("/api/opportunity-applications/", {"opportunity_id": str(self.opportunity.public_id), "status": "preparing"}, format="json")
        self.assertEqual(application.status_code, 201, application.data)

    @override_settings(OPPORTUNITY_FEED_URLS=["https://source.example/feed.xml"], OPPORTUNITY_FETCH_LIMIT=1)
    @patch("opportunities.management.commands.fetch_opportunities.requests.get")
    def test_fetch_command_queues_new_opportunity_for_review(self, mock_get):
        response = Mock()
        response.headers = {"content-type": "application/rss+xml"}
        response.text = "<rss><channel><item><title>New scholarship</title><link>https://source.example/new</link><description>Funding for students.</description></item></channel></rss>"
        mock_get.return_value = response
        output = StringIO()

        call_command("fetch_opportunities", stdout=output)

        item = Opportunity.objects.get(source_url="https://source.example/new")
        self.assertEqual(item.review_status, Opportunity.ReviewStatus.PENDING)
        self.assertFalse(item.is_published)
        self.assertIn("Fetched 1 new opportunity", output.getvalue())
        mock_get.assert_called_once()

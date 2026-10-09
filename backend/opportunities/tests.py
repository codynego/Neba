from datetime import date, timedelta
from io import StringIO
from unittest.mock import Mock, patch

from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import Organization, User
from .matching import build_match_context, diverse_recommendations, rank_opportunities
from .models import Opportunity, OpportunityCorrection, SavedOpportunity
from .views import match_for


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

    def test_onboarding_intents_interest_areas_remote_and_state_feed_match(self):
        self.user.goals = ["build"]
        self.user.opportunity_interests = ["software-&-technology", "remote"]
        self.user.state = "Lagos"
        self.user.save(update_fields=["goals", "opportunity_interests", "state"])
        item = Opportunity.objects.create(
            title="Remote Technical Co-founder",
            provider="Lagos Startup Lab",
            summary="Build software for a fintech product in Lagos.",
            category="startup",
            application_url="https://example.test/cofounder",
            is_remote=True,
            location_label="Lagos, Nigeria",
        )
        result = match_for(self.user, item)
        self.assertGreater(result["score"], 52)
        self.assertIn("Fits your build direction", result["reasons"])
        self.assertIn("Matches your remote preference", result["reasons"])

    def test_match_v2_separates_eligibility_confidence_from_fit(self):
        result = match_for(self.user, self.opportunity)
        self.assertEqual(result["version"], "v2")
        self.assertEqual(result["eligibility"], "eligible")
        self.assertEqual(result["confidence"], "high")
        self.assertGreaterEqual(result["score"], 70)
        self.assertGreater(result["breakdown"]["eligibility"], 0)

        self.user.country = "Ghana"
        self.user.save(update_fields=("country",))
        excluded = match_for(self.user, self.opportunity)
        self.assertEqual(excluded["eligibility"], "unlikely")
        self.assertLess(excluded["score"], 50)
        self.assertIn("Published country criteria may not match your profile", excluded["missing"])

    def test_recommendations_learn_from_existing_activity_and_hide_archived_items(self):
        similar = Opportunity.objects.create(
            title="Women in Technology Fellowship",
            provider="Example Foundation",
            summary="A software fellowship for undergraduate builders.",
            category="fellowship",
            eligible_countries=["Nigeria"],
            education_levels=["Undergraduate"],
        )
        archived = Opportunity.objects.create(
            title="Archived Scholarship",
            provider="Old Foundation",
            summary="A scholarship that the member has dismissed.",
            category="scholarship",
        )
        SavedOpportunity.objects.create(user=self.user, opportunity=self.opportunity)
        SavedOpportunity.objects.create(user=self.user, opportunity=archived, status=SavedOpportunity.Status.ARCHIVED)
        context = build_match_context(self.user)
        ranked = rank_opportunities(self.user, [similar, archived], context)
        self.assertEqual([row[1] for row in ranked], [similar])
        self.assertGreater(match_for(self.user, similar, context)["breakdown"]["activity"], 0)

    def test_diverse_top_matches_reduce_repeated_categories_and_providers(self):
        first = self.opportunity
        repeated = Opportunity.objects.create(title="Second Scholarship", provider=first.provider, summary="Another scholarship.", category="scholarship")
        different = Opportunity.objects.create(title="Product Internship", provider="Different Labs", summary="A product internship.", category="internship")
        ranked = [(90, first, {}), (89, repeated, {}), (88, different, {})]
        selected = diverse_recommendations(ranked, 2)
        self.assertEqual([row[1] for row in selected], [first, different])

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

    def test_personal_share_keeps_provider_separate_and_cannot_receive_applications(self):
        contributor = User.objects.create_user(username="connector", email="connector@example.test", display_name="Community Connector", password="test-password-123")
        self.client.force_authenticate(contributor)
        response = self.client.post("/api/my-opportunities/", {
            "title": "Global Product Internship",
            "provider": "Example Labs",
            "summary": "A paid internship open to early-career product builders.",
            "share_note": "This could help someone looking for their first product role.",
            "category": "internship",
            "application_mode": "internal",
            "application_url": "https://example.test/careers/product-intern",
            "source_url": "https://example.test/careers/product-intern",
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        shared = Opportunity.objects.get(public_id=response.data["public_id"])
        self.assertEqual(shared.provider, "Example Labs")
        self.assertEqual(shared.application_mode, Opportunity.ApplicationMode.EXTERNAL)
        shared.review_status = Opportunity.ReviewStatus.APPROVED
        shared.is_published = True
        shared.save(update_fields=("review_status", "is_published"))

        self.client.force_authenticate(self.user)
        application = self.client.post("/api/opportunity-applications/", {
            "opportunity_id": str(shared.public_id),
            "status": "preparing",
            "application_message": "Private introduction",
            "shared_fields": ["profile", "skills"],
        }, format="json")
        self.assertEqual(application.status_code, 201, application.data)
        self.assertEqual(application.data["application_message"], "")
        self.assertEqual(application.data["shared_fields"], [])

        self.client.force_authenticate(contributor)
        hidden = self.client.get(f"/api/opportunity-applications/{application.data['public_id']}/")
        self.assertEqual(hidden.status_code, 404)

    def test_thanks_and_corrections_create_honest_community_signals(self):
        thanked = self.client.post(f"/api/opportunities/{self.opportunity.public_id}/thank/", {}, format="json")
        self.assertEqual(thanked.status_code, 201, thanked.data)
        self.assertTrue(thanked.data["thanked"])
        self.assertEqual(thanked.data["thanks_count"], 1)

        thanked_again = self.client.post(f"/api/opportunities/{self.opportunity.public_id}/thank/", {}, format="json")
        self.assertEqual(thanked_again.data["thanks_count"], 1)

        correction = self.client.post(f"/api/opportunities/{self.opportunity.public_id}/correction/", {"reason": "deadline", "details": "The official page lists a different date."}, format="json")
        self.assertEqual(correction.status_code, 201, correction.data)
        report = OpportunityCorrection.objects.get(pk=correction.data["id"])
        self.assertEqual(report.reporter, self.user)
        self.assertEqual(report.status, OpportunityCorrection.Status.OPEN)

        removed = self.client.delete(f"/api/opportunities/{self.opportunity.public_id}/thank/")
        self.assertEqual(removed.status_code, 200, removed.data)
        self.assertEqual(removed.data["thanks_count"], 0)

    def test_internal_application_shares_a_snapshot_and_keeps_notes_private(self):
        owner = User.objects.create_user(username="provider", email="provider@example.test", display_name="Provider Owner", password="test-password-123")
        organization = Organization.objects.create(owner=owner, name="Example Foundation", status=Organization.Status.VERIFIED)
        internal = Opportunity.objects.create(
            title="Foundation Fellowship",
            provider=organization.name,
            summary="A fellowship with applications reviewed inside GetNeba.",
            category="fellowship",
            application_mode=Opportunity.ApplicationMode.INTERNAL,
            organization=organization,
        )
        self.user.bio = "Original application biography"
        self.user.save(update_fields=("bio",))
        application = self.client.post("/api/opportunity-applications/", {
            "opportunity_id": str(internal.public_id),
            "status": "applied",
            "application_message": "I would like to be considered.",
            "shared_fields": ["profile"],
        }, format="json")
        self.assertEqual(application.status_code, 201, application.data)
        self.client.patch(f"/api/opportunity-applications/{application.data['public_id']}/", {"notes": "Private preparation note"}, format="json")
        self.user.bio = "Biography changed after applying"
        self.user.save(update_fields=("bio",))

        self.client.force_authenticate(owner)
        provider_view = self.client.get(f"/api/opportunity-applications/{application.data['public_id']}/")
        self.assertEqual(provider_view.status_code, 200, provider_view.data)
        self.assertEqual(provider_view.data["notes"], "")
        self.assertEqual(provider_view.data["shared_profile"]["profile"]["bio"], "Original application biography")

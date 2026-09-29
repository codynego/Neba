from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from django.utils import timezone

class TaskFlowTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.requester = User.objects.create_user(username="requester", password="strong-password-123", display_name="Requester")
        self.helper = User.objects.create_user(username="helper", password="strong-password-123", display_name="Helper")
        for index, user in enumerate((self.requester, self.helper)):
            user.phone = f"+234801234567{index}"
            user.phone_verified_at = timezone.now()
            user.identity_verified_at = timezone.now()
            user.profile_photo_key = f"profile-photos/{user.pk}/test.jpg"
            user.photo_visible = True
            user.address = "12 Test Street"
            user.neighborhood = "Garki"
            user.city = "Abuja"
            user.state = "FCT"
            user.save()
        self.payload = {
            "title": "Move a table", "description": "Carry one table upstairs",
            "category": "moving", "city": "Abuja", "state": "FCT",
            "reward_amount": "5000.00", "policy_confirmed": True,
        }

    def test_post_apply_accept_complete_and_city_filter(self):
        self.client.force_authenticate(self.requester)
        created = self.client.post("/api/tasks/", self.payload, format="json")
        self.assertEqual(created.status_code, 201)
        task_id = created.data["id"]

        self.client.force_authenticate(self.helper)
        applied = self.client.post("/api/applications/", {
            "task": task_id, "message": "I can arrive at 2pm.", "contact_phone": "08012345678"
        }, format="json")
        self.assertEqual(applied.status_code, 201)
        self.assertEqual(self.client.post("/api/applications/", {
            "task": task_id, "message": "Again"
        }, format="json").status_code, 400)

        self.client.force_authenticate(self.requester)
        accepted = self.client.post(f"/api/applications/{applied.data['id']}/accept/")
        self.assertEqual(accepted.status_code, 200)
        self.assertEqual(accepted.data["status"], "accepted")
        completed = self.client.post(f"/api/tasks/{task_id}/complete/")
        self.assertEqual(completed.status_code, 201)
        self.client.force_authenticate(self.helper)
        pending = self.client.get(f"/api/tasks/{task_id}/workspace/").data["pending_change"]
        confirmed = self.client.post(f"/api/tasks/{task_id}/changes/{pending['id']}/respond/", {"decision": "accept"})
        self.assertEqual(confirmed.status_code, 200)
        self.assertEqual(self.client.get(f"/api/tasks/{task_id}/").data["status"], "completed")

        self.client.force_authenticate(self.helper)
        self.assertEqual(self.client.get("/api/tasks/?city=Abuja").data["count"], 0)

    def test_browsing_requires_authentication_on_list_and_detail(self):
        from tasks.models import Task
        from offers.models import Offer
        task = Task.objects.create(requester=self.requester, **{key: value for key, value in self.payload.items() if key != "policy_confirmed"})
        offer = Offer.objects.create(provider=self.helper, title="Moving help", description="Help moving", category="moving", city="Abuja", state="FCT", starting_price=5000)
        self.client.force_authenticate(user=None)
        for path in ("/api/tasks/", f"/api/tasks/{task.pk}/", "/api/offers/", f"/api/offers/{offer.pk}/"):
            self.assertEqual(self.client.get(path).status_code, 401)

    def test_non_owner_cannot_complete(self):
        self.client.force_authenticate(self.requester)
        task_id = self.client.post("/api/tasks/", self.payload, format="json").data["id"]
        self.client.force_authenticate(self.helper)
        self.assertEqual(self.client.post(f"/api/tasks/{task_id}/complete/").status_code, 403)

    def test_task_policy_blocks_cash_unpaid_and_high_value_items(self):
        self.client.force_authenticate(self.requester)
        cash = {**self.payload, "title": "Collect cash for me", "description": "Collect some cash from a customer and bring it back."}
        self.assertEqual(self.client.post("/api/tasks/", cash, format="json").status_code, 400)
        item = {**self.payload, "involves_item": True, "item_type": "food", "item_value": "15000", "item_already_paid": False}
        self.assertEqual(self.client.post("/api/tasks/", item, format="json").status_code, 400)
        item["item_already_paid"] = True; item["item_value"] = "50001"
        self.assertEqual(self.client.post("/api/tasks/", item, format="json").status_code, 400)

    def test_allowed_item_is_classified_and_suspicious_task_is_held(self):
        self.client.force_authenticate(self.requester)
        item = {**self.payload, "involves_item": True, "item_type": "food", "item_value": "15000", "item_already_paid": True}
        allowed = self.client.post("/api/tasks/", item, format="json")
        self.assertEqual(allowed.status_code, 201)
        self.assertEqual(allowed.data["risk_level"], "medium")
        self.assertEqual(allowed.data["moderation_status"], "approved")
        held = self.client.post("/api/tasks/", {**self.payload, "title": "Carry a sealed package", "description": "Please carry this sealed package across town."}, format="json")
        self.assertEqual(held.status_code, 201)
        self.assertEqual(held.data["moderation_status"], "held")
        self.client.force_authenticate(self.helper)
        self.assertNotIn(held.data["id"], [task["id"] for task in self.client.get("/api/tasks/").data["results"]])
        self.assertEqual(self.client.get(f"/api/tasks/{held.data['id']}/").status_code, 404)


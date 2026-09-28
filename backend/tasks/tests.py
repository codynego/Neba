from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

class TaskFlowTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.requester = User.objects.create_user(username="requester", password="strong-password-123", display_name="Requester")
        self.helper = User.objects.create_user(username="helper", password="strong-password-123", display_name="Helper")
        self.payload = {
            "title": "Move a table", "description": "Carry one table upstairs",
            "category": "moving", "city": "Abuja", "state": "FCT",
            "reward_amount": "5000.00"
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
        self.assertEqual(completed.status_code, 200)
        self.assertEqual(completed.data["status"], "completed")

        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get("/api/tasks/?city=Abuja").data["count"], 0)

    def test_non_owner_cannot_complete(self):
        self.client.force_authenticate(self.requester)
        task_id = self.client.post("/api/tasks/", self.payload, format="json").data["id"]
        self.client.force_authenticate(self.helper)
        self.assertEqual(self.client.post(f"/api/tasks/{task_id}/complete/").status_code, 403)


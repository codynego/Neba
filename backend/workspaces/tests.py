from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase


class WorkspaceApiTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.owner = User.objects.create_user(username="owner", password="strong-password-123", display_name="Bright Air")
        self.other = User.objects.create_user(username="other", password="strong-password-123", display_name="Other")
        self.client.force_authenticate(self.owner)

    def test_owner_can_run_a_job_from_customer_to_paid_completion(self):
        created = self.client.post("/api/businesses/", {"name": "Bright Air", "service_type": "AC repair", "city": "Lagos"}, format="json")
        self.assertEqual(created.status_code, 201)
        self.assertEqual(self.client.get("/api/businesses/mine/").data["business"]["name"], "Bright Air")

        customer = self.client.post("/api/customers/", {"name": "Emeka N.", "phone": "08010000000", "address": "Lekki Phase 1"}, format="json")
        self.assertEqual(customer.status_code, 201)
        job = self.client.post("/api/jobs/", {"customer": customer.data["id"], "title": "AC isn’t cooling", "quote_amount": "40000.00", "deposit_amount": "15000.00", "amount_paid": "15000.00", "assignee_name": "Ibrahim A."}, format="json")
        self.assertEqual(job.status_code, 201)
        self.assertEqual(job.data["payment_status"], "partial")
        self.assertEqual(str(job.data["balance_due"]), "25000.00")

        advanced = self.client.post(f"/api/jobs/{job.data['id']}/advance/", {"status": "in_progress"}, format="json")
        self.assertEqual(advanced.status_code, 200)
        self.assertEqual(advanced.data["status"], "in_progress")
        paid = self.client.patch(f"/api/jobs/{job.data['id']}/", {"amount_paid": "40000.00", "status": "completed"}, format="json")
        self.assertEqual(paid.status_code, 200)
        self.assertEqual(paid.data["payment_status"], "paid")

    def test_other_owner_cannot_see_workspace_records(self):
        self.client.post("/api/businesses/", {"name": "Bright Air"}, format="json")
        customer = self.client.post("/api/customers/", {"name": "Emeka"}, format="json").data
        job = self.client.post("/api/jobs/", {"customer": customer["id"], "title": "Repair"}, format="json").data
        self.client.force_authenticate(self.other)
        self.client.post("/api/businesses/", {"name": "Other Works"}, format="json")
        self.assertEqual(self.client.get(f"/api/jobs/{job['id']}/").status_code, 404)
        self.assertEqual(self.client.get("/api/businesses/mine/").data["business"]["name"], "Other Works")

from rest_framework import status
from rest_framework.test import APITestCase

from .models import SchoolPilotInterest


class SchoolPilotInterestTests(APITestCase):
    url = "/api/auth/school-pilot-interest/"

    def test_school_leader_can_request_pilot_with_email(self):
        response = self.client.post(self.url, {
            "school_name": "Example Secondary School",
            "contact_name": "Ada Okafor",
            "role": "Principal",
            "email": "ada@example.edu",
            "phone": "",
            "student_count": "300_599",
            "can_provide_sample": True,
            "consent_to_contact": True,
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        interest = SchoolPilotInterest.objects.get()
        self.assertEqual(interest.school_name, "Example Secondary School")
        self.assertEqual(interest.email, "ada@example.edu")
        self.assertTrue(interest.can_provide_sample)

    def test_contact_method_is_required(self):
        response = self.client.post(self.url, {
            "school_name": "Example Secondary School",
            "contact_name": "Ada Okafor",
            "role": "Principal",
            "email": "",
            "phone": "",
            "student_count": "100_299",
            "can_provide_sample": False,
            "consent_to_contact": True,
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(SchoolPilotInterest.objects.count(), 0)

    def test_contact_consent_is_required(self):
        response = self.client.post(self.url, {
            "school_name": "Example Secondary School",
            "contact_name": "Ada Okafor",
            "role": "Principal",
            "email": "ada@example.edu",
            "phone": "",
            "student_count": "100_299",
            "can_provide_sample": False,
            "consent_to_contact": False,
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(SchoolPilotInterest.objects.count(), 0)

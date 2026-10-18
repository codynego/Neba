from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import Exam, ExamPaper, Question, Topic


class ExamBuddyApiTests(APITestCase):
    def setUp(self):
        self.learner = get_user_model().objects.create_user(username="exam-learner", password="password")
        self.other_learner = get_user_model().objects.create_user(username="other-learner", password="password")
        self.exam = Exam.objects.create(name="ICAN Professional Examination", slug="ican-professional", category=Exam.Category.PROFESSIONAL)
        self.paper = ExamPaper.objects.create(exam=self.exam, name="Financial Reporting", code="FR", question_formats=["multiple_choice", "calculation"])
        self.topic = Topic.objects.create(paper=self.paper, name="Consolidation", syllabus_priority=5)
        self.question = Question.objects.create(paper=self.paper, topic=self.topic, status=Question.Status.VERIFIED, prompt="Which entity controls a subsidiary?", options=[{"id": "a", "text": "The investor with power"}, {"id": "b", "text": "Any shareholder"}], correct_answer={"option_id": "a"}, explanation="Control combines power, returns, and the ability to use power.")
        self.client.force_authenticate(self.learner)

    def test_catalog_is_public_and_describes_mixed_exam_formats(self):
        self.client.force_authenticate(user=None)
        response = self.client.get("/api/exam-buddy/catalog/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["exams"][0]["papers"][0]["question_formats"], ["multiple_choice", "calculation"])

    def test_learner_can_set_goal_practice_and_receive_feedback(self):
        response = self.client.post("/api/exam-buddy/goals/", {"paper_id": str(self.paper.public_id), "weekly_study_minutes": 240}, format="json")
        self.assertEqual(response.status_code, 201)
        response = self.client.post("/api/exam-buddy/practice/", {"paper_id": str(self.paper.public_id), "question_count": 1}, format="json")
        self.assertEqual(response.status_code, 201)
        session_id = response.data["id"]
        question_id = response.data["questions"][0]["id"]
        response = self.client.post(f"/api/exam-buddy/practice/{session_id}/answer/", {"question_id": question_id, "answer": {"option_id": "a"}, "response_seconds": 11}, format="json")
        self.assertTrue(response.data["correct"])
        response = self.client.post(f"/api/exam-buddy/practice/{session_id}/complete/", format="json")
        self.assertEqual(response.data["summary"]["accuracy"], 100)
        self.assertEqual(response.data["summary"]["topic_focus"][0]["topic"], "Consolidation")

    def test_learner_cannot_read_another_learners_session(self):
        response = self.client.post("/api/exam-buddy/practice/", {"paper_id": str(self.paper.public_id), "question_count": 1}, format="json")
        self.client.force_authenticate(self.other_learner)
        response = self.client.get(f"/api/exam-buddy/practice/{response.data['id']}/")
        self.assertEqual(response.status_code, 404)

    def test_performance_uses_only_completed_attempts(self):
        response = self.client.post("/api/exam-buddy/practice/", {"paper_id": str(self.paper.public_id), "question_count": 1}, format="json")
        session_id = response.data["id"]
        self.client.post(f"/api/exam-buddy/practice/{session_id}/answer/", {"question_id": str(self.question.public_id), "answer": {"option_id": "a"}}, format="json")
        self.client.post(f"/api/exam-buddy/practice/{session_id}/complete/", format="json")
        response = self.client.get("/api/exam-buddy/performance/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["summary"]["accuracy"], 100)
        self.assertEqual(response.data["topic_performance"][0]["status"], "secure")

    def test_mock_session_hides_answer_key_until_completion(self):
        response = self.client.post("/api/exam-buddy/practice/", {"paper_id": str(self.paper.public_id), "mode": "mock", "question_count": 1}, format="json")
        session_id = response.data["id"]
        self.client.post(f"/api/exam-buddy/practice/{session_id}/answer/", {"question_id": str(self.question.public_id), "answer": {"option_id": "a"}}, format="json")
        response = self.client.get(f"/api/exam-buddy/practice/{session_id}/")
        self.assertNotIn("correct_answer", response.data["questions"][0])
        response = self.client.post(f"/api/exam-buddy/practice/{session_id}/complete/", format="json")
        self.assertEqual(response.data["questions"][0]["correct_answer"], {"option_id": "a"})

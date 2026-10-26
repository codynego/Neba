from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import Exam, ExamPaper, LearnerExamGoal, Question, Topic


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

    def test_goal_preferences_build_an_explainable_study_plan(self):
        response = self.client.post("/api/exam-buddy/goals/", {
            "paper_id": str(self.paper.public_id),
            "weekly_study_minutes": 200,
            "target_score": 80,
            "preferred_session_minutes": 25,
            "study_days": ["mon", "wed", "sat"],
        }, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["target_score"], 80)
        response = self.client.get("/api/exam-buddy/plan/")
        self.assertEqual(response.status_code, 200)
        plan = response.data["plans"][0]
        self.assertTrue(plan["needs_diagnostic"])
        self.assertEqual(plan["recommended_sessions"], 8)
        self.assertEqual(plan["next_action"]["topic"], "Consolidation")
        self.assertIn("Not checked yet", plan["next_action"]["reason"])

    def test_diagnostic_uses_verified_questions_and_updates_plan(self):
        LearnerExamGoal.objects.create(learner=self.learner, paper=self.paper)
        response = self.client.post("/api/exam-buddy/practice/", {"paper_id": str(self.paper.public_id), "mode": "diagnostic", "question_count": 1}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["mode"], "diagnostic")
        self.client.post(f"/api/exam-buddy/practice/{response.data['id']}/answer/", {"question_id": str(self.question.public_id), "answer": {"option_id": "b"}}, format="json")
        response = self.client.get("/api/exam-buddy/plan/")
        self.assertFalse(response.data["plans"][0]["needs_diagnostic"])
        self.assertEqual(response.data["plans"][0]["topics"][0]["mastery"], 0)

    def test_completed_mock_scores_unanswered_questions_as_zero(self):
        Question.objects.create(paper=self.paper, topic=self.topic, status=Question.Status.VERIFIED, prompt="Which statement is true?", options=[{"id": "a", "text": "One"}, {"id": "b", "text": "Two"}], correct_answer={"option_id": "a"})
        response = self.client.post("/api/exam-buddy/practice/", {"paper_id": str(self.paper.public_id), "mode": "mock", "question_count": 2}, format="json")
        session_id = response.data["id"]
        question_id = response.data["questions"][0]["id"]
        correct_answer = Question.objects.get(public_id=question_id).correct_answer
        self.client.post(f"/api/exam-buddy/practice/{session_id}/answer/", {"question_id": question_id, "answer": correct_answer}, format="json")
        response = self.client.post(f"/api/exam-buddy/practice/{session_id}/complete/", format="json")
        self.assertEqual(response.data["summary"]["accuracy"], 50)

    def test_free_access_reports_usage_and_limits_repeat_mocks(self):
        response = self.client.get("/api/exam-buddy/access/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["tier"], "free")
        self.assertEqual(response.data["usage"]["answers_today"], 0)
        self.client.post("/api/exam-buddy/practice/", {"paper_id": str(self.paper.public_id), "mode": "mock", "question_count": 1}, format="json")
        response = self.client.post("/api/exam-buddy/practice/", {"paper_id": str(self.paper.public_id), "mode": "mock", "question_count": 1}, format="json")
        self.assertEqual(response.status_code, 402)
        self.assertEqual(response.data["code"], "learn_upgrade_required")

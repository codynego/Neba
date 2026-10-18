from collections import defaultdict

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Exam, ExamBlueprint, ExamPaper, LearnerExamGoal, PracticeSession, Question, QuestionAttempt, TopicMastery


def paper_payload(paper):
    return {
        "id": str(paper.public_id),
        "name": paper.name,
        "code": paper.code,
        "duration_minutes": paper.duration_minutes,
        "maximum_score": paper.maximum_score,
        "question_formats": paper.question_formats,
        "topics": [{"id": str(topic.public_id), "name": topic.name, "syllabus_priority": topic.syllabus_priority} for topic in paper.topics.all()],
    }


class CatalogView(APIView):
    """Public catalog only exposes configured, active exam routes."""

    permission_classes = []

    def get(self, request):
        exams = Exam.objects.filter(is_active=True).prefetch_related("papers__topics")
        return Response({"exams": [{"id": str(exam.public_id), "name": exam.name, "slug": exam.slug, "category": exam.category, "description": exam.description, "papers": [paper_payload(paper) for paper in exam.papers.filter(is_active=True)]} for exam in exams]})


class GoalSerializer(serializers.Serializer):
    paper_id = serializers.UUIDField()
    exam_date = serializers.DateField(required=False, allow_null=True)
    weekly_study_minutes = serializers.IntegerField(min_value=30, max_value=10080, required=False)


class LearnerGoalsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        goals = LearnerExamGoal.objects.filter(learner=request.user, is_active=True).select_related("paper__exam").prefetch_related("paper__topics")
        return Response({"goals": [{"id": goal.id, "exam": goal.paper.exam.name, "paper": paper_payload(goal.paper), "exam_date": goal.exam_date, "weekly_study_minutes": goal.weekly_study_minutes} for goal in goals]})

    def post(self, request):
        data = GoalSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        paper = ExamPaper.objects.filter(public_id=data.validated_data["paper_id"], is_active=True, exam__is_active=True).first()
        if not paper:
            return Response({"paper_id": ["Choose an active exam paper."]}, status=400)
        goal, _ = LearnerExamGoal.objects.update_or_create(
            learner=request.user,
            paper=paper,
            defaults={"exam_date": data.validated_data.get("exam_date"), "weekly_study_minutes": data.validated_data.get("weekly_study_minutes", 180), "is_active": True},
        )
        return Response({"id": goal.id, "exam": paper.exam.name, "paper": paper_payload(paper), "exam_date": goal.exam_date, "weekly_study_minutes": goal.weekly_study_minutes}, status=201)


class StartSessionSerializer(serializers.Serializer):
    paper_id = serializers.UUIDField()
    mode = serializers.ChoiceField(choices=PracticeSession.Mode.choices, default=PracticeSession.Mode.PRACTICE)
    question_count = serializers.IntegerField(min_value=1, max_value=100, default=10)
    topic_ids = serializers.ListField(child=serializers.UUIDField(), required=False, allow_empty=False)


class PracticeSessionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = StartSessionSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        paper = ExamPaper.objects.filter(public_id=data.validated_data["paper_id"], is_active=True, exam__is_active=True).first()
        if not paper:
            return Response({"paper_id": ["Choose an active exam paper."]}, status=400)
        questions = Question.objects.filter(paper=paper, status=Question.Status.VERIFIED).select_related("topic")
        mode = data.validated_data["mode"]
        if mode == PracticeSession.Mode.PAST_QUESTIONS:
            questions = questions.exclude(source=Question.Source.ORIGINAL)
        if mode == PracticeSession.Mode.AI_PRACTICE:
            questions = questions.filter(source=Question.Source.ORIGINAL)
        topic_ids = data.validated_data.get("topic_ids")
        if topic_ids:
            questions = questions.filter(topic__public_id__in=topic_ids)
        selected = list(questions.order_by("?")[:data.validated_data["question_count"]])
        if not selected:
            return Response({"detail": "No verified questions are available for this selection yet."}, status=409)
        blueprint = ExamBlueprint.objects.filter(paper=paper, is_active=True, exam_version__is_current=True).first()
        session = PracticeSession.objects.create(learner=request.user, paper=paper, mode=mode, timer_seconds=(blueprint.duration_minutes * 60 if mode == PracticeSession.Mode.MOCK and blueprint and blueprint.duration_minutes else None), immediate_feedback=mode != PracticeSession.Mode.MOCK)
        QuestionAttempt.objects.bulk_create([QuestionAttempt(session=session, question=question, position=index) for index, question in enumerate(selected, start=1)])
        return Response(session_payload(session, reveal_answers=False), status=201)

    def get(self, request, session_id):
        session = PracticeSession.objects.filter(public_id=session_id, learner=request.user).select_related("paper__exam").prefetch_related("attempts__question__topic").first()
        if not session:
            return Response({"detail": "Practice session not found."}, status=404)
        return Response(session_payload(session, reveal_answers=session.status == PracticeSession.Status.COMPLETE))


class AnswerSerializer(serializers.Serializer):
    question_id = serializers.UUIDField()
    answer = serializers.JSONField()
    response_seconds = serializers.IntegerField(min_value=0, max_value=21600, required=False)


class PracticeAnswerView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        data = AnswerSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        attempt = QuestionAttempt.objects.select_related("question", "session").filter(session__public_id=session_id, session__learner=request.user, question__public_id=data.validated_data["question_id"]).first()
        if not attempt:
            return Response({"detail": "Question not found in this session."}, status=404)
        if attempt.session.status != PracticeSession.Status.ACTIVE:
            return Response({"detail": "This practice session is already complete."}, status=409)
        question = attempt.question
        correct = data.validated_data["answer"] == question.correct_answer
        attempt.answer = data.validated_data["answer"]
        attempt.is_correct = correct
        attempt.score = question.marks if correct else 0
        attempt.response_seconds = data.validated_data.get("response_seconds")
        attempt.answered_at = timezone.now()
        attempt.save(update_fields=("answer", "is_correct", "score", "response_seconds", "answered_at"))
        if question.topic_id:
            mastery, _ = TopicMastery.objects.get_or_create(learner=request.user, topic=question.topic)
            mastery.attempts += 1
            mastery.correct_attempts += int(correct)
            mastery.mastery_score = round(100 * mastery.correct_attempts / mastery.attempts, 2)
            mastery.last_practised_at = attempt.answered_at
            mastery.save(update_fields=("attempts", "correct_attempts", "mastery_score", "last_practised_at", "updated_at"))
        if attempt.session.immediate_feedback:
            return Response({"correct": correct, "score": attempt.score, "explanation": question.explanation, "correct_answer": question.correct_answer, "topic": question.topic.name if question.topic else None})
        return Response({"saved": True, "answered": True})


class CompleteSessionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        session = PracticeSession.objects.filter(public_id=session_id, learner=request.user).first()
        if not session:
            return Response({"detail": "Practice session not found."}, status=404)
        if session.status == PracticeSession.Status.ACTIVE:
            session.status = PracticeSession.Status.COMPLETE
            session.completed_at = timezone.now()
            session.save(update_fields=("status", "completed_at"))
        session = PracticeSession.objects.select_related("paper__exam").prefetch_related("attempts__question__topic").get(pk=session.pk)
        return Response(session_payload(session, reveal_answers=True))


class LearnerPerformanceView(APIView):
    """Personal performance evidence, derived only from completed practice attempts."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        sessions = PracticeSession.objects.filter(learner=request.user, status=PracticeSession.Status.COMPLETE).select_related("paper__exam").prefetch_related("attempts__question__topic").order_by("-completed_at")
        total_answered = total_correct = 0
        topic_totals = defaultdict(lambda: [0, 0])
        recent = []
        for session in sessions:
            attempts = [attempt for attempt in session.attempts.all() if attempt.is_correct is not None]
            correct = sum(bool(attempt.is_correct) for attempt in attempts)
            total_answered += len(attempts)
            total_correct += correct
            for attempt in attempts:
                label = attempt.question.topic.name if attempt.question.topic else "Unmapped"
                topic_totals[label][0] += int(bool(attempt.is_correct))
                topic_totals[label][1] += 1
            recent.append({"id": str(session.public_id), "exam": session.paper.exam.name, "paper": session.paper.name, "mode": session.mode, "completed_at": session.completed_at, "answered": len(attempts), "accuracy": round(100 * correct / len(attempts)) if attempts else None})
        topics = sorted(({"topic": topic, "accuracy": round(100 * hits / total), "attempts": total, "status": "needs_attention" if hits / total < .6 else "developing" if hits / total < .8 else "secure"} for topic, (hits, total) in topic_totals.items()), key=lambda item: (item["accuracy"], -item["attempts"]))
        return Response({"summary": {"sessions_completed": len(recent), "questions_answered": total_answered, "accuracy": round(100 * total_correct / total_answered) if total_answered else None}, "topic_performance": topics, "recent_sessions": recent[:8]})


def session_payload(session, reveal_answers):
    attempts = list(session.attempts.all())
    answered = [attempt for attempt in attempts if attempt.is_correct is not None]
    correct = sum(bool(attempt.is_correct) for attempt in answered)
    question_payload = []
    for attempt in attempts:
        question = attempt.question
        item = {"id": str(question.public_id), "position": attempt.position, "topic": question.topic.name if question.topic else None, "format": question.question_format, "difficulty": question.difficulty, "prompt": question.prompt, "options": question.options, "marks": question.marks, "answered": attempt.is_correct is not None, "flagged": attempt.is_flagged}
        if reveal_answers or (session.immediate_feedback and attempt.is_correct is not None):
            item.update({"answer": attempt.answer, "correct": attempt.is_correct, "correct_answer": question.correct_answer, "explanation": question.explanation})
        question_payload.append(item)
    topic_totals = defaultdict(lambda: [0, 0])
    for attempt in answered:
        label = attempt.question.topic.name if attempt.question.topic else "Unmapped"
        topic_totals[label][0] += int(bool(attempt.is_correct))
        topic_totals[label][1] += 1
    focus = sorted(({"topic": topic, "accuracy": round(100 * hits / total), "attempts": total} for topic, (hits, total) in topic_totals.items()), key=lambda item: (item["accuracy"], -item["attempts"]))
    return {"id": str(session.public_id), "exam": session.paper.exam.name, "paper": session.paper.name, "mode": session.mode, "status": session.status, "timer_seconds": session.timer_seconds, "immediate_feedback": session.immediate_feedback, "questions": question_payload, "summary": {"total": len(attempts), "answered": len(answered), "correct": correct, "accuracy": round(100 * correct / len(answered)) if answered else None, "topic_focus": focus}}

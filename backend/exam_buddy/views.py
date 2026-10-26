import json
from collections import defaultdict
from datetime import timedelta

import requests

from django.conf import settings
from django.utils import timezone
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Exam, ExamBlueprint, ExamPaper, LearnerDailyUsage, LearnerExamGoal, PracticeSession, Question, QuestionAttempt, Topic, TopicMastery


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


def select_questions(learner, queryset, mode, count):
    """Choose useful questions without pretending that randomness is personalisation."""
    questions = list(queryset)
    if not questions:
        return []
    mastery = {item.topic_id: float(item.mastery_score) for item in TopicMastery.objects.filter(learner=learner)}
    attempted = set(QuestionAttempt.objects.filter(session__learner=learner, is_correct__isnull=False).values_list("question_id", flat=True))

    if mode == PracticeSession.Mode.DIAGNOSTIC:
        by_topic = defaultdict(list)
        for question in questions:
            by_topic[question.topic_id].append(question)
        selected = []
        topic_groups = sorted(by_topic.values(), key=lambda group: (-(group[0].topic.syllabus_priority if group[0].topic else 0), group[0].id))
        while len(selected) < count and any(topic_groups):
            next_groups = []
            for group in topic_groups:
                if group and len(selected) < count:
                    selected.append(group.pop(0))
                if group:
                    next_groups.append(group)
            topic_groups = next_groups
        return selected

    def rank(question):
        topic_mastery = mastery.get(question.topic_id, 50 if question.topic_id else 60)
        syllabus_priority = question.topic.syllabus_priority if question.topic else 1
        unseen_bonus = 30 if question.id not in attempted else 0
        weak_area_bonus = max(0, 100 - topic_mastery)
        return -(unseen_bonus + weak_area_bonus + syllabus_priority * 8), question.difficulty, question.id

    if mode == PracticeSession.Mode.MOCK:
        # Keep mocks broad: syllabus importance first, then rotate unseen material.
        questions.sort(key=lambda question: (-(question.topic.syllabus_priority if question.topic else 1), question.id in attempted, question.id))
    else:
        questions.sort(key=rank)
    return questions[:count]


def expire_mock_if_needed(session):
    if session.status != PracticeSession.Status.ACTIVE or session.mode != PracticeSession.Mode.MOCK or not session.timer_seconds:
        return False
    if timezone.now() < session.started_at + timedelta(seconds=session.timer_seconds):
        return False
    session.status = PracticeSession.Status.COMPLETE
    session.completed_at = timezone.now()
    session.save(update_fields=("status", "completed_at"))
    return True


def has_paid_learn_access(user):
    try:
        return user.subscription.entitled
    except AttributeError:
        return False


def upgrade_response(feature):
    return Response({"detail": f"You have used your free {feature}. Upgrade to continue.", "code": "learn_upgrade_required", "upgrade_url": "/pricing"}, status=402)


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
    target_score = serializers.IntegerField(min_value=40, max_value=100, required=False)
    preferred_session_minutes = serializers.IntegerField(min_value=10, max_value=180, required=False)
    study_days = serializers.ListField(child=serializers.ChoiceField(choices=("mon", "tue", "wed", "thu", "fri", "sat", "sun")), required=False, max_length=7)


def goal_payload(goal):
    return {
        "id": goal.id,
        "exam": goal.paper.exam.name,
        "paper": paper_payload(goal.paper),
        "exam_date": goal.exam_date,
        "weekly_study_minutes": goal.weekly_study_minutes,
        "target_score": goal.target_score,
        "preferred_session_minutes": goal.preferred_session_minutes,
        "study_days": goal.study_days,
    }


class LearnerGoalsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        goals = LearnerExamGoal.objects.filter(learner=request.user, is_active=True).select_related("paper__exam").prefetch_related("paper__topics")
        return Response({"goals": [goal_payload(goal) for goal in goals]})

    def post(self, request):
        data = GoalSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        paper = ExamPaper.objects.filter(public_id=data.validated_data["paper_id"], is_active=True, exam__is_active=True).first()
        if not paper:
            return Response({"paper_id": ["Choose an active exam paper."]}, status=400)
        goal, _ = LearnerExamGoal.objects.update_or_create(
            learner=request.user,
            paper=paper,
            defaults={
                "exam_date": data.validated_data.get("exam_date"),
                "weekly_study_minutes": data.validated_data.get("weekly_study_minutes", 180),
                "target_score": data.validated_data.get("target_score", 75),
                "preferred_session_minutes": data.validated_data.get("preferred_session_minutes", 25),
                "study_days": list(dict.fromkeys(data.validated_data.get("study_days", []))),
                "is_active": True,
            },
        )
        return Response(goal_payload(goal), status=201)


class StartSessionSerializer(serializers.Serializer):
    paper_id = serializers.UUIDField()
    mode = serializers.ChoiceField(choices=PracticeSession.Mode.choices, default=PracticeSession.Mode.PRACTICE)
    question_count = serializers.IntegerField(min_value=1, max_value=100, required=False)
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
        if mode == PracticeSession.Mode.MOCK and not has_paid_learn_access(request.user):
            week_start = timezone.now() - timedelta(days=7)
            used_mocks = PracticeSession.objects.filter(learner=request.user, mode=PracticeSession.Mode.MOCK, started_at__gte=week_start).count()
            if used_mocks >= settings.EXAM_BUDDY_FREE_WEEKLY_MOCKS:
                return upgrade_response("mock exam")
        if mode == PracticeSession.Mode.PAST_QUESTIONS:
            questions = questions.exclude(source=Question.Source.ORIGINAL)
        if mode == PracticeSession.Mode.AI_PRACTICE:
            questions = questions.filter(source=Question.Source.ORIGINAL)
        topic_ids = data.validated_data.get("topic_ids")
        if topic_ids:
            questions = questions.filter(topic__public_id__in=topic_ids)
        blueprint = ExamBlueprint.objects.filter(paper=paper, is_active=True, exam_version__is_current=True).first()
        requested_count = data.validated_data.get("question_count")
        question_count = requested_count or (blueprint.question_count if mode == PracticeSession.Mode.MOCK and blueprint and blueprint.question_count else 10)
        selected = select_questions(request.user, questions, mode, question_count)
        if not selected:
            return Response({"detail": "No verified questions are available for this selection yet."}, status=409)
        mock_minutes = (blueprint.duration_minutes if blueprint else None) or paper.duration_minutes
        session = PracticeSession.objects.create(learner=request.user, paper=paper, mode=mode, timer_seconds=(mock_minutes * 60 if mode == PracticeSession.Mode.MOCK and mock_minutes else None), immediate_feedback=mode != PracticeSession.Mode.MOCK)
        QuestionAttempt.objects.bulk_create([QuestionAttempt(session=session, question=question, position=index) for index, question in enumerate(selected, start=1)])
        return Response(session_payload(session, reveal_answers=False), status=201)

    def get(self, request, session_id):
        session = PracticeSession.objects.filter(public_id=session_id, learner=request.user).select_related("paper__exam").prefetch_related("attempts__question__topic").first()
        if not session:
            return Response({"detail": "Practice session not found."}, status=404)
        expire_mock_if_needed(session)
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
        if attempt.session.mode != PracticeSession.Mode.MOCK and not has_paid_learn_access(request.user):
            answered_today = QuestionAttempt.objects.filter(session__learner=request.user, answered_at__date=timezone.localdate(), is_correct__isnull=False).exclude(session__mode=PracticeSession.Mode.MOCK).count()
            if answered_today >= settings.EXAM_BUDDY_FREE_DAILY_ANSWERS:
                return upgrade_response("daily practice allowance")
        if attempt.session.status != PracticeSession.Status.ACTIVE:
            return Response({"detail": "This practice session is already complete."}, status=409)
        if expire_mock_if_needed(attempt.session):
            return Response({"detail": "Time is up. Your mock has been submitted."}, status=409)
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


class StudyPlanView(APIView):
    """An explainable weekly plan derived from goals, coverage and learner evidence."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        goals = LearnerExamGoal.objects.filter(learner=request.user, is_active=True).select_related("paper__exam").prefetch_related("paper__topics")
        mastery = {item.topic_id: item for item in TopicMastery.objects.filter(learner=request.user).select_related("topic")}
        week_start = timezone.now() - timedelta(days=7)
        recent_attempts = QuestionAttempt.objects.filter(session__learner=request.user, answered_at__gte=week_start, is_correct__isnull=False)
        plans = []
        for goal in goals:
            seconds = sum(value or 120 for value in recent_attempts.filter(session__paper=goal.paper).values_list("response_seconds", flat=True))
            topics = []
            for topic in goal.paper.topics.all():
                evidence = mastery.get(topic.id)
                score = float(evidence.mastery_score) if evidence and evidence.attempts else None
                evidence_count = evidence.attempts if evidence else 0
                priority = round((100 - (score if score is not None else 45)) * .65 + topic.syllabus_priority * 7 + (12 if evidence_count == 0 else 0))
                if evidence_count == 0:
                    reason = "Not checked yet · important syllabus area" if topic.syllabus_priority >= 4 else "Not checked yet"
                elif score < 60:
                    reason = f"{round(score)}% from {evidence_count} attempt{'s' if evidence_count != 1 else ''} · needs review"
                elif score < goal.target_score:
                    reason = f"{round(score)}% mastery · below your {goal.target_score}% target"
                else:
                    reason = f"{round(score)}% mastery · keep it fresh"
                topics.append({"id": str(topic.public_id), "name": topic.name, "mastery": round(score) if score is not None else None, "attempts": evidence_count, "priority_score": priority, "reason": reason})
            topics.sort(key=lambda item: (-item["priority_score"], item["name"]))
            days_left = (goal.exam_date - timezone.localdate()).days if goal.exam_date else None
            session_count = max(1, round(goal.weekly_study_minutes / goal.preferred_session_minutes))
            plans.append({
                **goal_payload(goal),
                "days_to_exam": max(0, days_left) if days_left is not None else None,
                "weekly_progress_minutes": round(seconds / 60),
                "recommended_sessions": session_count,
                "topics": topics,
                "next_action": ({"topic_id": topics[0]["id"], "topic": topics[0]["name"], "reason": topics[0]["reason"], "minutes": goal.preferred_session_minutes, "question_count": max(5, min(20, goal.preferred_session_minutes // 2))} if topics else None),
                "needs_diagnostic": not any(item["attempts"] for item in topics),
            })
        return Response({"plans": plans, "generated_at": timezone.now()})


class LearnAccessView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        paid = has_paid_learn_access(request.user)
        answered_today = QuestionAttempt.objects.filter(session__learner=request.user, answered_at__date=timezone.localdate(), is_correct__isnull=False).exclude(session__mode=PracticeSession.Mode.MOCK).count()
        week_start = timezone.now() - timedelta(days=7)
        mocks_this_week = PracticeSession.objects.filter(learner=request.user, mode=PracticeSession.Mode.MOCK, started_at__gte=week_start).count()
        usage, _ = LearnerDailyUsage.objects.get_or_create(learner=request.user, date=timezone.localdate())
        return Response({
            "tier": "plus" if paid else "free",
            "limits": None if paid else {"daily_answers": settings.EXAM_BUDDY_FREE_DAILY_ANSWERS, "weekly_mocks": settings.EXAM_BUDDY_FREE_WEEKLY_MOCKS, "daily_tutor_messages": settings.EXAM_BUDDY_FREE_DAILY_TUTOR_MESSAGES},
            "usage": {"answers_today": answered_today, "mocks_this_week": mocks_this_week, "tutor_messages_today": usage.tutor_messages},
        })


class TutorSerializer(serializers.Serializer):
    paper_id = serializers.UUIDField()
    topic_id = serializers.UUIDField(required=False, allow_null=True)
    question = serializers.CharField(min_length=3, max_length=3000)
    history = serializers.ListField(child=serializers.DictField(), required=False, max_length=8)


class TutorView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = TutorSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        usage, _ = LearnerDailyUsage.objects.get_or_create(learner=request.user, date=timezone.localdate())
        if not has_paid_learn_access(request.user) and usage.tutor_messages >= settings.EXAM_BUDDY_FREE_DAILY_TUTOR_MESSAGES:
            return upgrade_response("AI Tutor allowance")
        if not settings.OPENAI_API_KEY:
            return Response({"detail": "AI Tutor is not configured yet."}, status=503)
        paper = ExamPaper.objects.filter(public_id=data.validated_data["paper_id"], is_active=True).select_related("exam").first()
        if not paper:
            return Response({"paper_id": ["Choose an active exam paper."]}, status=400)
        topic = None
        topic_id = data.validated_data.get("topic_id")
        if topic_id:
            topic = Topic.objects.filter(public_id=topic_id, paper=paper).first()
            if not topic:
                return Response({"topic_id": ["Choose a topic from this paper."]}, status=400)
        objectives = list(Question.objects.filter(paper=paper, topic=topic, status=Question.Status.VERIFIED).exclude(learning_objective="").values_list("learning_objective", flat=True).distinct()[:6])
        instructions = (
            "You are Neba Learn's patient exam tutor. Teach the method; do not merely give an answer. "
            "Use clear Nigerian English suitable for a secondary-school learner. Start with a direct explanation, then a short worked step or example, and end with exactly one check-your-understanding question. "
            "Never claim to predict an exam. If the learner asks for leaked questions, refuse and redirect to legitimate preparation. "
            f"Exam: {paper.exam.name}. Paper: {paper.name}. Topic: {topic.name if topic else 'Learner-selected context'}. "
            f"Verified learning objectives: {json.dumps(objectives)}"
        )
        prompt = f"Conversation so far: {json.dumps(data.validated_data.get('history', []), ensure_ascii=False)}\n\nLearner: {data.validated_data['question']}"
        try:
            result = requests.post(
                "https://api.openai.com/v1/responses",
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}", "Content-Type": "application/json"},
                json={"model": settings.OPENAI_TEXT_MODEL, "instructions": instructions, "input": prompt},
                timeout=30,
            )
            if not result.ok:
                return Response({"detail": "AI Tutor could not respond right now."}, status=502)
            payload = result.json()
            output = str(payload.get("output_text", "")).strip() or " ".join(content.get("text", "") for item in payload.get("output", []) for content in item.get("content", []) if content.get("type") == "output_text").strip()
            if not output:
                return Response({"detail": "AI Tutor returned an empty response."}, status=502)
            usage.tutor_messages += 1
            usage.save(update_fields=("tutor_messages",))
            return Response({"answer": output, "exam": paper.exam.name, "paper": paper.name, "topic": topic.name if topic else None})
        except requests.RequestException:
            return Response({"detail": "AI Tutor could not connect. Try again shortly."}, status=502)


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
    elapsed = max(0, round((timezone.now() - session.started_at).total_seconds()))
    remaining = max(0, session.timer_seconds - elapsed) if session.timer_seconds else None
    accuracy_denominator = len(attempts) if session.mode == PracticeSession.Mode.MOCK and session.status == PracticeSession.Status.COMPLETE else len(answered)
    return {"id": str(session.public_id), "exam": session.paper.exam.name, "paper": session.paper.name, "mode": session.mode, "status": session.status, "timer_seconds": session.timer_seconds, "time_remaining_seconds": remaining, "immediate_feedback": session.immediate_feedback, "questions": question_payload, "summary": {"total": len(attempts), "answered": len(answered), "correct": correct, "accuracy": round(100 * correct / accuracy_denominator) if accuracy_denominator else None, "topic_focus": focus}}

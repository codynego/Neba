import json
import re

import requests

from django.conf import settings
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView


class InterviewText(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not settings.OPENAI_API_KEY:
            return Response({"detail": "AI interview is not configured yet."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        opportunity = request.data.get("opportunity_context") or {}
        context = "\n".join(f"- {key}: {value}" for key, value in opportunity.items() if value)
        focus = request.data.get("focus", "role-specific")
        difficulty = request.data.get("difficulty", "realistic")
        action = request.data.get("action", "start")
        answer = str(request.data.get("answer", "")).strip()
        history = request.data.get("history") or []
        if action == "answer" and not answer:
            return Response({"detail": "An interview answer is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(history, list):
            return Response({"detail": "Interview history must be a list."}, status=status.HTTP_400_BAD_REQUEST)

        instructions = (
            "You are GetNeba's AI interviewer. Conduct a realistic, warm but rigorous text interview. "
            "Ask one question at a time and keep every question concise. "
            f"Interview focus: {focus}. Difficulty: {difficulty}. "
            f"Opportunity context:\n{context or 'No specific opportunity was selected.'}\n\n"
            "When evaluating an answer, be specific and encouraging. Do not invent facts about the candidate. "
            "For challenging or very-challenging interviews, apply respectful pressure: ask for evidence, metrics, trade-offs, ownership, and what the candidate would do differently. "
            "If a company is provided, make questions feel like that company's hiring conversation without pretending to know internal interview questions."
        )
        if action == "start":
            prompt = "Start the interview. Return only the first interview question, with no preamble."
        else:
            prompt = (
                "Review the candidate's latest answer and produce exactly two lines:\n"
                "FEEDBACK: one concise, useful sentence\n"
                "QUESTION: the next interview question\n\n"
                f"Latest answer:\n{answer}\n\n"
                f"Previous interview turns:\n{json.dumps(history[-8:])}"
            )
        try:
            response = requests.post(
                "https://api.openai.com/v1/responses",
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}", "Content-Type": "application/json"},
                json={"model": settings.OPENAI_TEXT_MODEL, "instructions": instructions, "input": prompt},
                timeout=20,
            )
            if not response.ok:
                return Response({"detail": f"Text interview could not start: {response.text[:500]}"}, status=status.HTTP_502_BAD_GATEWAY)
            data = response.json()
            output = str(data.get("output_text", "")).strip()
            if not output:
                output = " ".join(
                    item.get("text", "")
                    for item in data.get("output", [])
                    for item in item.get("content", [])
                    if item.get("type") == "output_text"
                ).strip()
            if not output:
                return Response({"detail": "The interview model returned an empty response."}, status=status.HTTP_502_BAD_GATEWAY)
            if action == "start":
                return Response({"question": output})
            feedback_match = re.search(r"FEEDBACK:\s*(.+?)(?=\nQUESTION:|$)", output, re.IGNORECASE | re.DOTALL)
            question_match = re.search(r"QUESTION:\s*(.+)", output, re.IGNORECASE | re.DOTALL)
            return Response({
                "feedback": (feedback_match.group(1).strip() if feedback_match else "Good answer. Let's go one level deeper.")[:500],
                "question": (question_match.group(1).strip() if question_match else output)[:500],
            })
        except requests.RequestException as error:
            return Response({"detail": f"Interview model could not respond: {error}"}, status=status.HTTP_502_BAD_GATEWAY)

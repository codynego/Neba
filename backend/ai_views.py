import json
import re

import requests

from django.conf import settings
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from opportunities.models import OpportunityCheck


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


class InterviewTranscription(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not settings.OPENAI_API_KEY:
            return Response({"detail": "Voice transcription is not configured yet."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        audio = request.FILES.get("file")
        if not audio:
            return Response({"detail": "An audio recording is required."}, status=status.HTTP_400_BAD_REQUEST)
        if audio.size > 12 * 1024 * 1024:
            return Response({"detail": "That recording is too large. Keep answers under 10 minutes."}, status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)

        try:
            response = requests.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                files={"file": (audio.name or "answer.webm", audio.read(), audio.content_type or "audio/webm")},
                data={
                    "model": "gpt-4o-mini-transcribe",
                    "language": "en",
                    "response_format": "json",
                    "temperature": "0",
                    "prompt": prompt or "Interview answer in English. Preserve names, company names, technical terms, and Nigerian names accurately.",
                },
                timeout=30,
            )
            if not response.ok:
                return Response({"detail": f"Voice transcription failed: {response.text[:500]}"}, status=status.HTTP_502_BAD_GATEWAY)
            text = str(response.json().get("text", "")).strip()
            if not text:
                return Response({"detail": "No speech was detected."}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
            return Response({"text": text})
        except requests.RequestException as error:
            return Response({"detail": f"Voice transcription failed: {error}"}, status=status.HTTP_502_BAD_GATEWAY)


class InterviewReport(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not settings.OPENAI_API_KEY:
            return Response({"detail": "Interview reports are not configured yet."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        answers = request.data.get("answers") or []
        if not isinstance(answers, list) or not answers:
            return Response({"detail": "At least one interview answer is required."}, status=status.HTTP_400_BAD_REQUEST)
        focus = request.data.get("focus", "role")
        difficulty = request.data.get("difficulty", "realistic")
        opportunity = request.data.get("opportunity_context") or {}
        context = "\n".join(f"- {key}: {value}" for key, value in opportunity.items() if value)
        strictness = {
            "realistic": "Use a normal professional hiring bar.",
            "challenging": "Use a high hiring bar and penalize vague, unsupported, or overly rehearsed answers.",
            "very-challenging": "Use a strict hiring bar. Probe for ownership, evidence, trade-offs, measurable outcomes, and leadership under pressure.",
        }.get(difficulty, "Use a normal professional hiring bar.")
        instructions = (
            "You are a rigorous but fair interview debrief coach. Analyze only the candidate's actual answers; never invent achievements or missing evidence. "
            "Score the candidate relative to the role and interview bar, not against an imaginary perfect candidate. "
            f"Interview focus: {focus}. Difficulty: {difficulty}. {strictness}\n"
            f"Target context:\n{context or 'No specific role or company was supplied.'}\n\n"
            "Return valid JSON only with this shape: "
            '{"overall_score": number, "summary": string, "dimensions": [{"name": string, "score": number, "note": string}], '
            '"strengths": [{"name": string, "score": number, "note": string}], '
            '"improvements": [{"name": string, "score": number, "note": string, "practice_question": string}], '
            '"readiness": {"score": number, "before_score": number, "ready_signals": [string], "gaps": [string], "note": string}, '
            '"moments": [{"label": string, "question": string, "answer_excerpt": string, "assessment": string}], '
            '"question_reviews": [{"question": string, "score": number, "label": string, "analysis": string, "better_approach": string}], '
            '"next_steps": [{"title": string, "description": string}]}. '
            "Use 4 to 6 dimensions, 2 or 3 strengths, 1 to 3 improvements, and 3 next steps. Keep notes concise and concrete."
        )
        prompt = f"Interview answers:\n{json.dumps(answers[-12:], ensure_ascii=False)}"
        try:
            response = requests.post(
                "https://api.openai.com/v1/responses",
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}", "Content-Type": "application/json"},
                json={"model": settings.OPENAI_TEXT_MODEL, "instructions": instructions, "input": prompt},
                timeout=30,
            )
            if not response.ok:
                return Response({"detail": f"Interview report could not be generated: {response.text[:500]}"}, status=status.HTTP_502_BAD_GATEWAY)
            data = response.json()
            output = str(data.get("output_text", "")).strip()
            if not output:
                output = " ".join(content.get("text", "") for item in data.get("output", []) for content in item.get("content", []) if content.get("type") == "output_text").strip()
            output = re.sub(r"^```(?:json)?\s*|\s*```$", "", output.strip(), flags=re.IGNORECASE)
            report = json.loads(output)
            return Response(report)
        except (requests.RequestException, json.JSONDecodeError, TypeError, ValueError) as error:
            return Response({"detail": f"Interview report could not be generated: {error}"}, status=status.HTTP_502_BAD_GATEWAY)


class CVTailor(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not settings.OPENAI_API_KEY:
            return Response({"detail": "CV tailoring is not configured yet."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        opportunity = request.data.get("opportunity_context") or {}
        profile = request.data.get("profile") or {}
        if not isinstance(opportunity, dict) or not isinstance(profile, dict):
            return Response({"detail": "Opportunity and profile context must be objects."}, status=status.HTTP_400_BAD_REQUEST)

        context = "\n".join(f"- {key}: {value}" for key, value in opportunity.items() if value)
        profile_context = "\n".join(f"- {key}: {value}" for key, value in profile.items() if value)
        instructions = (
            "You are Neba's truthful CV editor. Create an ATS-compatible CV draft tailored to the opportunity. "
            "Use only facts present in the candidate profile. Never invent employers, dates, qualifications, metrics, tools, responsibilities, or achievements. "
            "You may improve wording, reorder skills, and turn clearly stated responsibilities into concise achievement-oriented bullets, but mark unsupported areas for the candidate to complete. "
            "Keep the writing clear and suitable for Nigeria and international employers. Avoid tables, columns, graphics, icons, emojis, and decorative formatting. "
            "Return valid JSON only with this exact shape: "
            '{"headline": string, "summary": string, "experience": [{"role": string, "organization": string, "dates": string, "bullets": [string]}], '
            '"education": [{"qualification": string, "institution": string, "dates": string}], "skills": [string], '
            '"keywords": [string], "missing_information": [string], "tailoring_notes": [string]}. '
            "If the profile does not contain work experience, return an empty experience array and explain what is missing. "
            "Keep the summary under 75 words, use 8 to 14 skills, and keep bullets concise."
        )
        prompt = f"Opportunity:\n{context or 'No specific opportunity selected.'}\n\nCandidate profile:\n{profile_context or 'The candidate profile is empty.'}"
        try:
            response = requests.post(
                "https://api.openai.com/v1/responses",
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}", "Content-Type": "application/json"},
                json={"model": settings.OPENAI_TEXT_MODEL, "instructions": instructions, "input": prompt},
                timeout=30,
            )
            if not response.ok:
                return Response({"detail": f"CV could not be prepared: {response.text[:500]}"}, status=status.HTTP_502_BAD_GATEWAY)
            data = response.json()
            output = str(data.get("output_text", "")).strip()
            if not output:
                output = " ".join(content.get("text", "") for item in data.get("output", []) for content in item.get("content", []) if content.get("type") == "output_text").strip()
            output = re.sub(r"^```(?:json)?\s*|\s*```$", "", output.strip(), flags=re.IGNORECASE)
            draft = json.loads(output)
            return Response(draft)
        except (requests.RequestException, json.JSONDecodeError, TypeError, ValueError) as error:
            return Response({"detail": f"CV could not be prepared: {error}"}, status=status.HTTP_502_BAD_GATEWAY)


class OpportunityFit(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not settings.OPENAI_API_KEY:
            return Response({"detail": "Opportunity fit checks are not configured yet."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        public_id = str(request.data.get("check_id", "")).strip()
        try:
            check = OpportunityCheck.objects.get(public_id=public_id, user=request.user, status=OpportunityCheck.Status.COMPLETED)
        except (OpportunityCheck.DoesNotExist, ValueError):
            return Response({"detail": "Complete an opportunity check before checking your fit."}, status=status.HTTP_404_NOT_FOUND)

        profile = {
            "name": request.user.display_name,
            "country": request.user.country,
            "education_level": request.user.education_level,
            "field_of_study": request.user.field_of_study,
            "institution": request.user.institution,
            "employment_status": request.user.employment_status,
            "years_experience": request.user.years_experience,
            "industry": request.user.industry,
            "skills": request.user.skills,
            "interests": request.user.opportunity_interests,
            "goals": request.user.goals,
            "cv_profile": request.user.cv_profile,
        }
        opportunity = {
            "title": check.title,
            "organization": check.organization,
            "type": check.opportunity_type,
            "summary": check.report_summary,
            "submitted_text": check.submitted_text,
            "claims": check.claims,
            "warnings": check.warnings,
            "recommended_action": check.recommended_action,
        }
        instructions = (
            "You are Neba's opportunity-fit advisor. Decide whether this opportunity appears suitable for this specific user, based only on the opportunity evidence and profile supplied. "
            "Do not promise acceptance, invent requirements, or treat missing information as a rejection. Separate a personal-fit assessment from source credibility: the opportunity may be a good fit even when verification is incomplete, but tell the user to resolve safety concerns before applying. "
            "Use a conservative score: 80-100 strong fit, 55-79 possible fit, 1-54 unlikely fit, and 0 only when there is not enough information. "
            "Return valid JSON only with this exact shape: "
            '{"fit_score": number, "fit_verdict": "strong_fit"|"possible_fit"|"unlikely_fit"|"not_enough_information", "fit_summary": string, "fit_reasons": [string], "fit_gaps": [string], "fit_next_steps": [string], "fit_missing_profile": [string]}. '
            "Use no more than 4 items in each list. Keep the summary under 60 words. Mention when the available opportunity details are too incomplete to judge confidently."
        )
        prompt = f"Opportunity evidence:\n{json.dumps(opportunity, ensure_ascii=False)}\n\nUser profile:\n{json.dumps(profile, ensure_ascii=False)}"
        try:
            response = requests.post(
                "https://api.openai.com/v1/responses",
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}", "Content-Type": "application/json"},
                json={"model": settings.OPENAI_TEXT_MODEL, "instructions": instructions, "input": prompt},
                timeout=30,
            )
            if not response.ok:
                return Response({"detail": f"Opportunity fit could not be assessed: {response.text[:500]}"}, status=status.HTTP_502_BAD_GATEWAY)
            data = response.json()
            output = str(data.get("output_text", "")).strip()
            if not output:
                output = " ".join(content.get("text", "") for item in data.get("output", []) for content in item.get("content", []) if content.get("type") == "output_text").strip()
            output = re.sub(r"^```(?:json)?\s*|\s*```$", "", output.strip(), flags=re.IGNORECASE)
            fit = json.loads(output)
            required = ("fit_score", "fit_verdict", "fit_summary", "fit_reasons", "fit_gaps", "fit_next_steps", "fit_missing_profile")
            if any(key not in fit for key in required):
                raise ValueError("The fit response was incomplete.")
            check.fit_score = max(0, min(100, int(fit["fit_score"])))
            check.fit_verdict = str(fit["fit_verdict"])[:32]
            check.fit_summary = str(fit["fit_summary"])[:1200]
            for field in ("fit_reasons", "fit_gaps", "fit_next_steps", "fit_missing_profile"):
                value = fit[field] if isinstance(fit[field], list) else []
                setattr(check, field, [str(item)[:300] for item in value[:4]])
            check.save(update_fields=("fit_score", "fit_verdict", "fit_summary", "fit_reasons", "fit_gaps", "fit_next_steps", "fit_missing_profile", "updated_at"))
            return Response({"fit_score": check.fit_score, "fit_verdict": check.fit_verdict, "fit_summary": check.fit_summary, "fit_reasons": check.fit_reasons, "fit_gaps": check.fit_gaps, "fit_next_steps": check.fit_next_steps, "fit_missing_profile": check.fit_missing_profile})
        except (requests.RequestException, json.JSONDecodeError, TypeError, ValueError) as error:
            return Response({"detail": f"Opportunity fit could not be assessed: {error}"}, status=status.HTTP_502_BAD_GATEWAY)

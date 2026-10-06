import json
import uuid
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView


class InterviewRealtimeCall(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not settings.OPENAI_API_KEY:
            return Response({"detail": "AI interview is not configured yet."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        offer_sdp = str(request.data.get("sdp", "")).strip()
        if not offer_sdp or not offer_sdp.startswith("v="):
            return Response({"detail": "A WebRTC offer is required."}, status=status.HTTP_400_BAD_REQUEST)

        opportunity = request.data.get("opportunity_context") or {}
        context = "\n".join(f"- {key}: {value}" for key, value in opportunity.items() if value)
        focus = request.data.get("focus", "role-specific")
        difficulty = request.data.get("difficulty", "realistic")
        instructions = (
            "You are GetNeba's AI interviewer. Conduct a realistic, warm but rigorous interview. "
            "Ask one question at a time, listen fully, and ask a concise follow-up when an answer is vague. "
            "Do not give coaching during the interview unless the candidate asks to pause. Keep spoken responses brief. "
            f"Interview focus: {focus}. Difficulty: {difficulty}. "
            f"Opportunity context:\n{context or 'No specific opportunity was selected.'}"
        )
        boundary = f"GetNeba{uuid.uuid4().hex}"
        session = json.dumps({"type": "realtime", "model": settings.OPENAI_REALTIME_MODEL})
        body = (
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"sdp\"; filename=\"offer.sdp\"\r\n"
            "Content-Type: application/sdp\r\n\r\n"
            f"{offer_sdp}\r\n"
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"session\"\r\n"
            "Content-Type: application/json\r\n\r\n"
            f"{session}\r\n"
            f"--{boundary}--\r\n"
        ).encode()
        try:
            response = urlopen(Request(
                "https://api.openai.com/v1/realtime/calls",
                data=body,
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}", "Content-Type": f"multipart/form-data; boundary={boundary}"},
                method="POST",
            ), timeout=20)
            return Response({"sdp": response.read().decode("utf-8")})
        except HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            return Response({"detail": f"Realtime session could not start: {detail[:500]}"}, status=status.HTTP_502_BAD_GATEWAY)
        except (URLError, TimeoutError) as error:
            return Response({"detail": f"Realtime session could not start: {error}"}, status=status.HTTP_502_BAD_GATEWAY)

import json

import requests

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
        session = json.dumps({"type": "realtime", "model": settings.OPENAI_REALTIME_MODEL})
        try:
            response = requests.post(
                "https://api.openai.com/v1/realtime/calls",
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                # The Realtime Calls endpoint expects both values as multipart
                # form fields.  Sending SDP with a filename makes requests
                # encode it as an uploaded file, which the endpoint does not
                # recognize as the required `sdp` string field.
                files={
                    "sdp": (None, offer_sdp, "application/sdp"),
                    "session": (None, session, "application/json"),
                },
                timeout=20,
            )
            if not response.ok:
                return Response({"detail": f"Realtime session could not start: {response.text[:500]}"}, status=status.HTTP_502_BAD_GATEWAY)
            return Response({"sdp": response.text})
        except requests.RequestException as error:
            return Response({"detail": f"Realtime session could not start: {error}"}, status=status.HTTP_502_BAD_GATEWAY)

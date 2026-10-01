from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from accounts.emailing import safely, send_application_accepted_email
from accounts.notifications import notify
from accounts.trust import are_blocked, require_helper, require_profile
from tasks.models import Task

from .models import Application, ApplicationMessage
from .message_attachments import attachment_response, upload_ticket, validate_attachments
from .views import ApplicationViewSet as BaseApplicationViewSet


class ApplicationMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source="sender.display_name", read_only=True)

    class Meta:
        model = ApplicationMessage
        fields = ("id", "sender", "sender_name", "text", "attachments", "client_id", "created_at")


class MessageInput(serializers.Serializer):
    text = serializers.CharField(max_length=2000, required=False, allow_blank=True, default="")
    attachments = serializers.ListField(child=serializers.DictField(), required=False, default=list)
    client_id = serializers.UUIDField()

    def validate(self, attrs):
        attrs["text"] = attrs["text"].strip()
        attrs["attachments"] = validate_attachments(self.context["request"].user, attrs["attachments"])
        if not attrs["text"] and not attrs["attachments"]:
            raise serializers.ValidationError("Write a message or attach a file.")
        return attrs


class BookingOfferInput(serializers.Serializer):
    booking_note = serializers.CharField(max_length=1000, min_length=10)


class ApplicationViewSet(BaseApplicationViewSet):
    throttle_scope = None

    def get_throttles(self):
        self.throttle_scope = "application_messages" if self.action in ("messages", "message_upload") and self.request.method == "POST" else None
        return super().get_throttles()

    def _participants(self, application):
        if self.request.user.pk not in (application.task.requester_id, application.applicant_id):
            raise PermissionDenied("Only the requester and applicant can access this application.")
        return application.applicant if self.request.user.pk == application.task.requester_id else application.task.requester

    @transaction.atomic
    def perform_create(self, serializer):
        task = Task.objects.select_for_update().get(pk=serializer.validated_data["task"].pk)
        require_helper(self.request.user)
        if task.status != Task.Status.OPEN or task.is_private or not task.requester.is_active or are_blocked(self.request.user, task.requester):
            raise ValidationError("This task is not accepting applications.")
        if self.request.user.availability == "unavailable":
            raise ValidationError("Update your availability before applying.")
        if task.applications.filter(applicant=self.request.user).exists():
            raise ValidationError("You already applied to this task.")
        application = serializer.save(applicant=self.request.user, contact_phone=self.request.user.phone)
        notify(task.requester, "New task application", f"/applications/{application.pk}", self.request.user.display_name or self.request.user.username)

    @action(detail=True, methods=["post"])
    def shortlist(self, request, pk=None):
        candidate = get_object_or_404(Application, pk=pk, task__requester=request.user)
        with transaction.atomic():
            task = Task.objects.select_for_update().get(pk=candidate.task_id)
            application = Application.objects.select_for_update().get(pk=candidate.pk)
            if task.status != Task.Status.OPEN or application.status != Application.Status.PENDING:
                raise ValidationError("Only a pending application on an open task can be shortlisted.")
            if are_blocked(request.user, application.applicant):
                raise PermissionDenied("You cannot shortlist a blocked member.")
            application.status = Application.Status.SHORTLISTED
            application.save(update_fields=("status",))
            notify(application.applicant, "You were shortlisted", f"/applications/{application.pk}", task.title)
        return Response(self.get_serializer(application).data)

    @action(detail=True, methods=["post"], url_path="offer")
    def send_offer(self, request, pk=None):
        data = BookingOfferInput(data=request.data)
        data.is_valid(raise_exception=True)
        candidate = get_object_or_404(Application, pk=pk, task__requester=request.user)
        with transaction.atomic():
            task = Task.objects.select_for_update().get(pk=candidate.task_id)
            application = Application.objects.select_related("applicant").select_for_update().get(pk=candidate.pk)
            require_profile(request.user)
            require_helper(application.applicant)
            if task.status != Task.Status.OPEN or application.status != Application.Status.SHORTLISTED:
                raise ValidationError("Shortlist this applicant before sending a booking offer.")
            accepted_count = task.applications.filter(status=Application.Status.ACCEPTED).count()
            offered_count = task.applications.filter(status=Application.Status.OFFERED).exclude(pk=application.pk).count()
            if not task.is_recurring and accepted_count + offered_count >= task.helpers_needed:
                raise ValidationError("All helper spots are already booked or awaiting confirmation.")
            if application.applicant.availability == "unavailable":
                raise ValidationError("This helper is not currently taking work.")
            if are_blocked(request.user, application.applicant):
                raise PermissionDenied("You cannot send a booking offer to a blocked member.")
            application.booking_note = data.validated_data["booking_note"]
            application.status = Application.Status.OFFERED
            application.save(update_fields=("booking_note", "status"))
            notify(application.applicant, "Booking offer ready to review", f"/applications/{application.pk}", task.title)
        return Response(self.get_serializer(application).data)

    @action(detail=True, methods=["post"], url_path="retract-offer")
    def retract_offer(self, request, pk=None):
        candidate = get_object_or_404(Application, pk=pk, task__requester=request.user)
        with transaction.atomic():
            task = Task.objects.select_for_update().get(pk=candidate.task_id)
            application = Application.objects.select_for_update().get(pk=candidate.pk)
            if task.status != Task.Status.OPEN or application.status != Application.Status.OFFERED:
                raise ValidationError("There is no booking offer to retract.")
            application.status = Application.Status.SHORTLISTED
            application.booking_note = ""
            application.save(update_fields=("status", "booking_note"))
            notify(application.applicant, "Booking offer withdrawn", f"/applications/{application.pk}", "The requester wants to keep discussing the task.")
        return Response(self.get_serializer(application).data)

    @action(detail=True, methods=["post"], url_path="respond-offer")
    def respond_offer(self, request, pk=None):
        decision = serializers.ChoiceField(choices=("accept", "decline")).run_validation(request.data.get("decision"))
        candidate = get_object_or_404(Application, pk=pk, applicant=request.user)
        with transaction.atomic():
            task = Task.objects.select_for_update().get(pk=candidate.task_id)
            application = Application.objects.select_related("applicant", "task__requester").select_for_update().get(pk=candidate.pk)
            if task.status != Task.Status.OPEN or application.status != Application.Status.OFFERED:
                raise ValidationError("This booking offer is no longer awaiting a response.")
            if decision == "decline":
                application.status = Application.Status.SHORTLISTED
                application.booking_note = ""
                application.save(update_fields=("status", "booking_note"))
                notify(task.requester, "Booking offer declined", f"/applications/{application.pk}", "You can keep talking or consider another applicant.")
                return Response(self.get_serializer(application).data)
            require_helper(application.applicant)
            require_profile(task.requester)
            if application.applicant.availability == "unavailable":
                raise ValidationError("Update your availability before accepting this booking.")
            if are_blocked(application.applicant, task.requester):
                raise PermissionDenied("You cannot accept a booking from a blocked member.")
            accepted_count = task.applications.filter(status=Application.Status.ACCEPTED).exclude(pk=application.pk).count()
            if not task.is_recurring and accepted_count >= task.helpers_needed:
                raise ValidationError("This task has already filled all helper spots.")
            application.status = Application.Status.ACCEPTED
            application.save(update_fields=("status",))
            filled = not task.is_recurring and accepted_count + 1 >= task.helpers_needed
            task.status = Task.Status.ASSIGNED if filled else Task.Status.OPEN
            task.save(update_fields=("status", "updated_at"))
            others = list(task.applications.filter(status__in=(Application.Status.PENDING, Application.Status.SHORTLISTED, Application.Status.OFFERED)).exclude(pk=application.pk).select_related("applicant")) if filled else []
            if others: task.applications.filter(pk__in=[item.pk for item in others]).update(status=Application.Status.DECLINED, booking_note="")
            notify(task.requester, "Booking confirmed", f"/tasks/{task.public_id}", application.applicant.display_name or application.applicant.username)
            notify(application.applicant, "Booking confirmed", f"/tasks/{task.public_id}", task.title)
            for other in others:
                notify(other.applicant, "Another helper was booked", "/activity", task.title)
            transaction.on_commit(lambda: safely(send_application_accepted_email, application))
        return Response(self.get_serializer(application).data)

    @action(detail=True, methods=["get", "post"])
    def messages(self, request, pk=None):
        application = self.get_object()
        other = self._participants(application)
        if request.method == "GET":
            after = serializers.IntegerField(min_value=0).run_validation(request.query_params.get("after", 0))
            items = list(application.messages.select_related("sender").filter(id__gt=after)[:51])
            return Response({"results": ApplicationMessageSerializer(items[:50], many=True).data, "has_more": len(items) > 50})
        if application.status not in (Application.Status.SHORTLISTED, Application.Status.OFFERED):
            raise ValidationError("Shortlist this applicant before starting a private chat.")
        if not request.user.is_active or not other.is_active or are_blocked(request.user, other):
            raise PermissionDenied("This conversation is unavailable.")
        data = MessageInput(data=request.data, context={"request": request})
        data.is_valid(raise_exception=True)
        with transaction.atomic():
            application = Application.objects.select_for_update().get(pk=application.pk)
            if application.status not in (Application.Status.SHORTLISTED, Application.Status.OFFERED):
                raise ValidationError("This candidate conversation is now archived.")
            defaults = {"text": data.validated_data["text"], "attachments": data.validated_data["attachments"]}
            message, created = ApplicationMessage.objects.get_or_create(application=application, sender=request.user, client_id=data.validated_data["client_id"], defaults=defaults)
            if not created and (message.text != defaults["text"] or message.attachments != defaults["attachments"]):
                raise ValidationError("This message identifier has already been used.")
            if created:
                notify(other, "New candidate message", f"/applications/{application.pk}#message-{message.pk}", application.task.title)
        return Response(ApplicationMessageSerializer(message).data, status=201 if created else 200)

    @action(detail=True, methods=["post"], url_path="message-upload")
    def message_upload(self, request, pk=None):
        application = self.get_object()
        other = self._participants(application)
        if application.status not in (Application.Status.SHORTLISTED, Application.Status.OFFERED) or are_blocked(request.user, other):
            raise PermissionDenied("This conversation is unavailable.")
        return Response(upload_ticket(request.user, request.data))

    @action(detail=True, methods=["get"], url_path=r"messages/(?P<message_id>[0-9]+)/attachments/(?P<attachment_index>[0-9]+)")
    def message_attachment(self, request, pk=None, message_id=None, attachment_index=None):
        application = self.get_object()
        self._participants(application)
        message = get_object_or_404(application.messages, pk=message_id)
        data = attachment_response(message, attachment_index)
        return Response(data, status=200 if data else 404)

    @action(detail=True, methods=["post"])
    def withdraw(self, request, pk=None):
        candidate = get_object_or_404(Application, pk=pk, applicant=request.user)
        with transaction.atomic():
            task = Task.objects.select_for_update().get(pk=candidate.task_id)
            application = Application.objects.select_for_update().get(pk=candidate.pk)
            if application.status not in (Application.Status.PENDING, Application.Status.SHORTLISTED, Application.Status.OFFERED) or task.status != Task.Status.OPEN:
                raise ValidationError("A confirmed booking needs a cancellation request, not withdrawal.")
            application.status = Application.Status.WITHDRAWN
            application.booking_note = ""
            application.save(update_fields=("status", "booking_note"))
            notify(task.requester, "Application withdrawn", "/activity", request.user.display_name)
        return Response(self.get_serializer(application).data)

    @action(detail=True, methods=["post"])
    def decline(self, request, pk=None):
        candidate = get_object_or_404(Application, pk=pk, task__requester=request.user)
        with transaction.atomic():
            task = Task.objects.select_for_update().get(pk=candidate.task_id)
            application = Application.objects.select_for_update().get(pk=candidate.pk)
            if application.status not in (Application.Status.PENDING, Application.Status.SHORTLISTED, Application.Status.OFFERED) or task.status != Task.Status.OPEN:
                raise ValidationError("Only an active application can be declined.")
            application.status = Application.Status.DECLINED
            application.booking_note = ""
            application.save(update_fields=("status", "booking_note"))
            notify(application.applicant, "Application closed", "/activity", task.title)
        return Response(self.get_serializer(application).data)

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        raise ValidationError("This application is not booked yet. Open the applicant, choose ‘Shortlist and start chat’, talk through the task, then choose ‘Prepare booking offer’. The helper must confirm before the task is assigned.")

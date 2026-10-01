from datetime import timedelta
from django.db import transaction
from django.db.models import Q, Count, OuterRef, Subquery, Prefetch
from django.db.models.functions import Coalesce
from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from accounts.trust import blocked_user_ids, require_helper, require_profile, are_blocked
from accounts.notifications import notify
from accounts.emailing import safely, send_direct_request_decision_email
from accounts.safety_views import trust_summary
from accounts import r2
from accounts.listing_photos import upload_ticket, PhotoUploadsUnavailable
from bookings.models import Application, TaskMessage, TaskChange, TaskIssue
from bookings.workflow import participants, require_available, propose_change, decide_change
from .models import Task
from .views import TaskViewSet as BaseTaskViewSet, TaskSerializer as BaseTaskSerializer

class TaskSerializer(BaseTaskSerializer):
    has_booking = serializers.SerializerMethodField()
    my_booking = serializers.SerializerMethodField()
    def get_has_booking(self, task):
        return task.applications.filter(status="accepted").exists()
    def get_my_booking(self, task):
        user = self.context.get("request").user if self.context.get("request") else None
        return bool(user and user.is_authenticated and task.applications.filter(status="accepted", applicant=user).exists())
    target_helper_name = serializers.CharField(source="target_helper.display_name", read_only=True, default="")
    class Meta(BaseTaskSerializer.Meta):
        fields = BaseTaskSerializer.Meta.fields + ("is_private", "target_helper", "target_helper_name", "requested_offer", "has_booking", "my_booking")
        read_only_fields = BaseTaskSerializer.Meta.read_only_fields + ("is_private", "target_helper", "target_helper_name", "requested_offer")
    def validate_scheduled_for(self, value):
        if value and value <= timezone.now():
            raise serializers.ValidationError("Choose a time in the future.")
        return value

class ChangeSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskChange
        fields = ("id", "proposer", "kind", "reason", "scheduled_for", "status", "created_at", "decided_at")

class IssueSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskIssue
        fields = ("id", "reporter", "kind", "details", "status", "outcome", "resolution", "created_at", "resolved_at")

class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source="sender.display_name", read_only=True)
    class Meta:
        model = TaskMessage
        fields = ("id", "sender", "sender_name", "text", "client_id", "created_at")

class ChangeInput(serializers.Serializer):
    kind = serializers.ChoiceField(choices=("complete", "cancel", "reschedule"))
    reason = serializers.CharField(max_length=1000, required=False, allow_blank=True, default="")
    scheduled_for = serializers.DateTimeField(required=False, allow_null=True, default=None)

class MessageInput(serializers.Serializer):
    text = serializers.CharField(max_length=2000, min_length=1)
    client_id = serializers.UUIDField()

class IssueInput(serializers.Serializer):
    kind = serializers.ChoiceField(choices=("no_show", "dispute"))
    details = serializers.CharField(max_length=2000, min_length=10)

class TaskViewSet(BaseTaskViewSet):
    serializer_class = TaskSerializer
    throttle_scope = None
    def get_throttles(self):
        self.throttle_scope = "task_messages" if self.action == "messages" and self.request.method == "POST" else None
        return super().get_throttles()
    def get_queryset(self):
        user = self.request.user
        queryset = Task.objects.select_related("requester", "target_helper").annotate(application_count=Count("applications", distinct=True), accepted_count=Count("applications", filter=Q(applications__status="accepted"), distinct=True))
        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(Q(title__icontains=search) | Q(description__icontains=search))
        owner = Q(requester=user)
        helper = Q(applications__applicant=user, applications__status="accepted")
        active_only = self.request.query_params.get("active") == "true"
        if self.request.query_params.get("mine") == "true":
            queryset = queryset.filter(owner)
            if active_only: queryset = queryset.exclude(status__in=(Task.Status.COMPLETED, Task.Status.CANCELLED))
            return queryset.distinct().order_by("-created_at")
        if self.request.query_params.get("bookings") == "true":
            queryset = queryset.filter(owner | helper, applications__status="accepted")
            if active_only: queryset = queryset.exclude(status__in=(Task.Status.COMPLETED, Task.Status.CANCELLED))
            return queryset.distinct().order_by("-updated_at")
        if self.request.query_params.get("invitations") == "true": return queryset.filter(target_helper=user, status="open", is_private=True, moderation_status=Task.ModerationStatus.APPROVED).order_by("-created_at")
        discover = Q(is_private=False, status="open", moderation_status=Task.ModerationStatus.APPROVED, requester__is_active=True) & ~Q(requester_id__in=blocked_user_ids(user))
        target = Q(target_helper=user, moderation_status=Task.ModerationStatus.APPROVED)
        if self.action != "list": return queryset.filter(owner | helper | target | discover).distinct()
        queryset = queryset.filter(discover)
        for key, lookup in (("city", "city__iexact"), ("neighborhood", "neighborhood__icontains"), ("category", "category")):
            value = self.request.query_params.get(key, "").strip()
            if value: queryset = queryset.filter(**{lookup: value})
        timing = self.request.query_params.get("timing", "")
        today = timezone.localdate()
        if timing == "flexible": queryset = queryset.filter(scheduled_for__isnull=True)
        elif timing == "today": queryset = queryset.filter(scheduled_for__date=today, scheduled_for__gte=timezone.now())
        elif timing == "week": queryset = queryset.filter(scheduled_for__gte=timezone.now(), scheduled_for__date__lte=today+timedelta(days=7))
        elif timing: raise ValidationError("Choose flexible, today, or week for timing.")
        for key, lookup in (("min_reward", "reward_amount__gte"), ("max_reward", "reward_amount__lte")):
            value = self.request.query_params.get(key)
            if value: queryset = queryset.filter(**{lookup: serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0).run_validation(value)})
        sort = self.request.query_params.get("sort", "newest")
        orders = {"newest": ("-created_at", "-id"), "soonest": ("scheduled_for", "-id")}
        if sort not in (*orders, "reward_high", "reward_low"): raise ValidationError("Unknown task sorting option.")
        if sort == "soonest":
            from django.db.models import F
            return queryset.order_by(F("scheduled_for").asc(nulls_last=True), "-id")
        if sort in ("reward_high", "reward_low"):
            from django.db.models import F
            direction = F("reward_amount").desc if sort == "reward_high" else F("reward_amount").asc
            return queryset.order_by(direction(nulls_last=True), "-id")
        return queryset.order_by(*orders[sort])

    @action(detail=False, methods=["post"], url_path="photo-upload")
    def photo_upload(self, request):
        return Response(upload_ticket(request.user, "task-photos", request.data))

    @action(detail=True, methods=["get"], url_path=r"photos/(?P<photo_index>[0-9]+)")
    def photo(self, request, pk=None, photo_index=None):
        task = self.get_object()
        try:
            key = (task.photo_keys or [])[int(photo_index)]
        except (IndexError, TypeError, ValueError):
            return Response(status=404)
        if not r2.configured():
            raise PhotoUploadsUnavailable()
        return Response({"url": r2.download_url(key)})

    @action(detail=False, methods=["get"])
    def conversations(self, request):
        accepted = Application.objects.filter(status="accepted")
        latest = TaskMessage.objects.filter(task_id=OuterRef("pk")).order_by("-id")
        queryset = Task.objects.filter(
            Q(requester=request.user) | Q(applications__applicant=request.user, applications__status="accepted"),
            applications__status="accepted",
        ).select_related("requester").prefetch_related(
            Prefetch("applications", queryset=accepted.select_related("applicant"), to_attr="accepted_helpers")
        ).annotate(last_text=Subquery(latest.values("text")[:1]), last_sent=Subquery(latest.values("created_at")[:1])).distinct().order_by(Coalesce("last_sent", "updated_at").desc(), "-id")
        page = self.paginate_queryset(queryset)
        rows = []
        for task in page if page is not None else queryset:
            other = task.accepted_helpers[0].applicant if task.requester_id == request.user.pk else task.requester
            rows.append({"task_id": task.pk, "task_public_id": str(task.public_id), "title": task.title, "status": task.status,
                "member": {"id": other.pk, "public_id": str(other.public_id), "display_name": other.display_name, **trust_summary(other)},
                "last_message": task.last_text or "", "last_message_at": task.last_sent,
                "updated_at": task.updated_at})
        return self.get_paginated_response(rows) if page is not None else Response(rows)

    @action(detail=True, methods=["get"])
    def workspace(self, request, pk=None):
        task = self.get_object()
        other = participants(task, request.user)
        accepted_helpers = [application.applicant for application in task.applications.filter(status="accepted").select_related("applicant")]
        members = accepted_helpers if request.user.pk == task.requester_id else [task.requester]
        active_issue = task.issues.filter(status__in=("open", "reviewing")).first()
        pending = task.changes.filter(status="pending").first()
        return Response({"task": self.get_serializer(task).data, "my_role": "requester" if request.user.pk == task.requester_id else "helper",
            "member": {"id": other.pk, "public_id": str(other.public_id), "display_name": other.display_name, **trust_summary(other)},
            "members": [{"id": member.pk, "public_id": str(member.public_id), "display_name": member.display_name, **trust_summary(member)} for member in members],
            "can_message": bool(other.is_active and not are_blocked(request.user, other) and task.status not in ("completed", "cancelled")),
            "contact_phone": other.phone if other.is_active and not are_blocked(request.user, other) else "",
            "pending_change": ChangeSerializer(pending).data if pending else None,
            "active_issue": IssueSerializer(active_issue).data if active_issue else None,
            "changes": ChangeSerializer(task.changes.all()[:20], many=True).data,
            "issues": IssueSerializer(task.issues.all()[:20], many=True).data})

    @action(detail=True, methods=["get", "post"])
    def messages(self, request, pk=None):
        task = self.get_object(); other = participants(task, request.user)
        if request.method == "GET":
            after = serializers.IntegerField(min_value=0).run_validation(request.query_params.get("after", 0))
            items = list(task.messages.select_related("sender").filter(id__gt=after)[:51])
            return Response({"results": MessageSerializer(items[:50], many=True).data, "has_more": len(items)>50})
        serializer = MessageInput(data=request.data); serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            task = Task.objects.select_for_update().get(pk=task.pk); other = participants(task, request.user)
            require_available(task, request.user, other, communication=True)
            if task.status in ("completed", "cancelled"): raise ValidationError("This conversation is archived because the task has ended.")
            message, created = TaskMessage.objects.get_or_create(task=task, sender=request.user, client_id=serializer.validated_data["client_id"], defaults={"text": serializer.validated_data["text"]})
            if not created and message.text != serializer.validated_data["text"]: raise ValidationError("This message identifier has already been used.")
            if created:
                recipients = [application.applicant for application in task.applications.filter(status="accepted").select_related("applicant")] if request.user.pk == task.requester_id else [task.requester]
                for recipient in recipients:
                    if recipient.pk != request.user.pk: notify(recipient, "New task message", f"/messages/{task.public_id}", task.title)
        return Response(MessageSerializer(message).data, status=201 if created else 200)

    @action(detail=True, methods=["post"])
    def changes(self, request, pk=None):
        target = self.get_object()
        serializer = ChangeInput(data=request.data); serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            task = Task.objects.select_for_update().get(pk=target.pk)
            change = propose_change(task, request.user, **serializer.validated_data)
        return Response(ChangeSerializer(change).data, status=201)

    @action(detail=True, methods=["post"], url_path="changes/(?P<change_id>[0-9]+)/respond")
    def respond_change(self, request, pk=None, change_id=None):
        target = self.get_object()
        with transaction.atomic():
            task = Task.objects.select_for_update().get(pk=target.pk)
            change = get_object_or_404(TaskChange.objects.select_for_update(), pk=change_id, task=task)
            change = decide_change(change, request.user, request.data.get("decision"))
        return Response(ChangeSerializer(change).data)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        target = self.get_object()
        with transaction.atomic():
            task = Task.objects.select_for_update().get(pk=target.pk)
            propose_change(task, request.user, "complete")
        return Response({"detail": "Completion requested. The other participant must confirm."}, status=201)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        target = self.get_object()
        with transaction.atomic():
            task = Task.objects.select_for_update().get(pk=target.pk)
            if task.requester_id != request.user.pk or task.status != "open": raise PermissionDenied("Use a cancellation request for an accepted task.")
            if task.applications.filter(status="accepted").exists(): raise PermissionDenied("Use a cancellation request because this task already has confirmed helpers.")
            task.status = "cancelled"; task.save(update_fields=("status", "updated_at"))
            task.applications.filter(status="pending").update(status="declined")
            users = {app.applicant for app in task.applications.select_related("applicant")}
            if task.target_helper: users.add(task.target_helper)
            for user in users: notify(user, "Task cancelled", "/activity", task.title)
        return Response(self.get_serializer(task).data)

    @action(detail=True, methods=["post"])
    def issues(self, request, pk=None):
        target = self.get_object()
        serializer = IssueInput(data=request.data); serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            task = Task.objects.select_for_update().get(pk=target.pk); other = participants(task, request.user)
            if task.status != "assigned": raise ValidationError("Only assigned tasks can have a task issue.")
            if task.issues.filter(status__in=("open", "reviewing")).exists(): raise ValidationError("This task already has an open issue.")
            data = serializer.validated_data
            if data["kind"] == "no_show" and (not task.scheduled_for or task.scheduled_for>timezone.now()): raise ValidationError("A no-show can be reported after the agreed scheduled time. Use a dispute for other problems.")
            issue = TaskIssue.objects.create(task=task, reporter=request.user, **data)
            task.changes.filter(status="pending").update(status="withdrawn", decided_by=request.user, decided_at=timezone.now())
            notify(other, "A task issue needs review", f"/tasks/{task.public_id}", task.title)
        return Response(IssueSerializer(issue).data, status=201)

    @action(detail=True, methods=["post"], url_path="respond-invitation")
    def respond_invitation(self, request, pk=None):
        target = self.get_object()
        decision = serializers.ChoiceField(choices=("accept", "decline")).run_validation(request.data.get("decision"))
        with transaction.atomic():
            task = Task.objects.select_for_update().get(pk=target.pk)
            if not task.is_private or task.target_helper_id != request.user.pk: raise PermissionDenied("This request is for another helper.")
            if task.status != "open": raise ValidationError("This request has already been decided.")
            if decision == "accept":
                require_helper(request.user); require_profile(task.requester)
                if are_blocked(request.user, task.requester): raise PermissionDenied("You cannot accept requests from a blocked member.")
                if request.user.availability == "unavailable": raise ValidationError("Update your availability before accepting work.")
                Application.objects.create(task=task, applicant=request.user, message="Accepted direct helper request.", contact_phone=request.user.phone, status="accepted")
                task.status = "assigned"
            else: task.status = "cancelled"
            task.save(update_fields=("status", "updated_at"))
            notify(task.requester, f"Helper request {'accepted' if decision=='accept' else 'declined'}", f"/tasks/{task.public_id}", task.title)
            transaction.on_commit(lambda: safely(send_direct_request_decision_email, task, decision == "accept"))
        return Response(self.get_serializer(task).data)

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from accounts.notifications import notify
from accounts.trust import are_blocked
from accounts.models import TrustAudit
from tasks.models import Task
from .models import TaskChange, TaskIssue

def participants(task, user):
    accepted = task.applications.select_related("applicant").filter(status="accepted")
    if user.pk == task.requester_id:
        first = accepted.first()
        if not first: raise PermissionDenied("Only the requester and accepted helpers can access this booking.")
        return first.applicant
    if not accepted.filter(applicant=user).exists():
        raise PermissionDenied("Only the requester and accepted helpers can access this booking.")
    return task.requester

def require_available(task, user, other, communication=False):
    if not user.is_active or not other.is_active:
        raise PermissionDenied("This member is currently unavailable. Report a task issue if you need help.")
    if communication and are_blocked(user, other):
        raise PermissionDenied("New messages are disabled between blocked members.")

def propose_change(task, user, kind, reason="", scheduled_for=None):
    other = participants(task, user)
    if task.status != "assigned":
        raise ValidationError("Changes can only be requested for an assigned task.")
    if task.issues.filter(status__in=("open", "reviewing")).exists():
        raise ValidationError("Resolve the open task issue before changing this booking.")
    if task.changes.filter(status="pending").exists():
        raise ValidationError("Respond to or withdraw the pending request first.")
    require_available(task, user, other)
    if kind not in ("complete", "cancel", "reschedule"):
        raise ValidationError("Choose completion, cancellation, or rescheduling.")
    if kind != "complete" and not reason.strip():
        raise ValidationError("Give the other participant a reason.")
    if kind == "reschedule" and (not scheduled_for or scheduled_for <= timezone.now()):
        raise ValidationError("Choose a new time in the future.")
    change = TaskChange.objects.create(task=task, proposer=user, kind=kind, reason=reason, scheduled_for=scheduled_for if kind == "reschedule" else None)
    label = {"complete": "completion", "cancel": "cancellation", "reschedule": "a new schedule"}[kind]
    notify(other, f"{user.display_name or user.username} requested {label}", f"/tasks/{task.public_id}", task.title)
    return change

def decide_change(change, user, decision):
    task = change.task
    other = participants(task, user)
    if task.status != "assigned" or change.status != "pending":
        raise ValidationError("This request is no longer pending.")
    if task.issues.filter(status__in=("open", "reviewing")).exists():
        raise ValidationError("The booking is paused while a task issue is reviewed.")
    if decision == "withdraw":
        if change.proposer_id != user.pk:
            raise PermissionDenied("Only the person who proposed this change can withdraw it.")
        change.status = "withdrawn"
    else:
        if change.proposer_id == user.pk:
            raise PermissionDenied("The other participant must confirm this change.")
        require_available(task, user, other)
        if decision not in ("accept", "decline"):
            raise ValidationError("Accept or decline this request.")
        change.status = "accepted" if decision == "accept" else "declined"
        if decision == "accept":
            if change.kind == "complete": task.status = "completed"
            elif change.kind == "cancel": task.status = "cancelled"
            else:
                if change.scheduled_for <= timezone.now():
                    raise ValidationError("That proposed time has passed. Request a new time.")
                task.scheduled_for = change.scheduled_for
            task.save(update_fields=("status", "scheduled_for", "updated_at"))
    change.decided_by = user; change.decided_at = timezone.now(); change.save()
    notify(other, f"Task request {change.status}", f"/tasks/{task.public_id}", task.title)
    TrustAudit.objects.create(actor=user, subject=other, action=f"task_{change.kind}_{change.status}", note=f"task {task.pk}")
    return change

@transaction.atomic
def resolve_issue(issue, actor, outcome, resolution):
    if not actor.is_active or not actor.has_perm("bookings.change_taskissue"):
        raise PermissionDenied("Only authorized moderators can resolve task issues.")
    task = Task.objects.select_for_update().get(pk=issue.task_id)
    issue = TaskIssue.objects.select_for_update().get(pk=issue.pk)
    if issue.status == "resolved" or task.status != "assigned":
        raise ValidationError("This issue is no longer awaiting resolution.")
    if outcome not in ("resume", "cancel", "complete") or not resolution.strip():
        raise ValidationError("Choose an outcome and provide a member-facing explanation.")
    task.status = {"resume": "assigned", "cancel": "cancelled", "complete": "completed"}[outcome]
    task.save(update_fields=("status", "updated_at"))
    task.changes.filter(status="pending").update(status="withdrawn", decided_by=actor, decided_at=timezone.now())
    issue.status = "resolved"; issue.outcome = outcome; issue.resolution = resolution; issue.reviewed_by = actor; issue.resolved_at = timezone.now(); issue.save()
    users = [task.requester] + [application.applicant for application in task.applications.filter(status="accepted").select_related("applicant")]
    for user in users:
        notify(user, "Task issue resolved", f"/tasks/{task.public_id}", resolution)
    TrustAudit.objects.create(actor=actor, subject=task.requester, action="task_issue_resolved", note=f"issue {issue.pk}: {outcome}")
    return issue

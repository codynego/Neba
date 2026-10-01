import uuid
from datetime import timedelta
from django.test import override_settings
from django.utils import timezone
from django.core.cache import cache
from rest_framework.test import APITestCase
from rest_framework.exceptions import PermissionDenied
from accounts.models import User, Block, Notification
from tasks.models import Task
from offers.models import Offer
from .models import Application, ApplicationMessage, TaskMessage, TaskChange, TaskIssue
from .workflow import resolve_issue
from unittest.mock import patch

@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class ProductFlowTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner = User.objects.create_user(username="owner", display_name="Owner", phone="+2348012345610", phone_verified_at=timezone.now())
        self.helper = User.objects.create_user(username="helper", display_name="Helper", phone="+2348012345611", phone_verified_at=timezone.now(), identity_verified_at=timezone.now())
        self.stranger = User.objects.create_user(username="stranger", display_name="Stranger", phone="+2348012345612", phone_verified_at=timezone.now(), identity_verified_at=timezone.now())
        for user in (self.owner, self.helper, self.stranger):
            user.profile_photo_key = f"profile-photos/{user.pk}/test.jpg"
            user.photo_visible = True
            user.address = "12 Test Street"
            user.neighborhood = "Garki"
            user.city = "Abuja"
            user.state = "FCT"
            user.save()
        self.admin = User.objects.create_superuser(username="admin", password="test-only-password", email="admin@example.test")
        self.task = Task.objects.create(requester=self.owner, title="Carry a table", description="Carry one table upstairs", city="Abuja", state="FCT", neighborhood="Garki", reward_amount=5000)
        self.offer = Offer.objects.create(provider=self.helper, title="Moving help", description="Carry and assemble", category="moving", city="Abuja", state="FCT", starting_price=4000)
        self.client.force_authenticate(self.helper)
    def assign(self):
        self.task.status="assigned"; self.task.save()
        return Application.objects.create(task=self.task, applicant=self.helper, message="Happy to help", contact_phone=self.helper.phone, status="accepted")
    def path(self, action): return f"/api/tasks/{self.task.pk}/{action}/"
    def propose(self, kind, **extra): return self.client.post(self.path("changes"), {"kind": kind, **extra}, format="json")
    def respond(self, change, decision): return self.client.post(f"/api/tasks/{self.task.pk}/changes/{change}/respond/", {"decision": decision})

    @patch("bookings.product_api.send_application_accepted_email")
    def test_booking_offer_requires_helper_confirmation_before_assignment(self, send_accepted_email):
        applied = self.client.post("/api/applications/", {"task": self.task.pk, "message": "I can help"})
        self.assertEqual(applied.status_code,201)
        self.assertEqual(Notification.objects.filter(recipient=self.owner).count(),1)
        self.assertEqual(self.client.get(self.path("messages")).status_code,403)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.post(f"/api/applications/{applied.data['id']}/accept/").status_code, 400)
        self.task.refresh_from_db(); self.assertEqual(self.task.status, "open")
        self.assertEqual(self.client.post(f"/api/applications/{applied.data['id']}/shortlist/").status_code,200)
        offered = self.client.post(f"/api/applications/{applied.data['id']}/offer/", {"booking_note": "Carry the table Saturday at 2pm for N5,000."}, format="json")
        self.assertEqual(offered.status_code, 200)
        self.task.refresh_from_db(); self.assertEqual(self.task.status, "open")
        self.assertEqual(self.client.get(f"/api/applications/{applied.data['id']}/").data["contact_phone"], "")
        self.client.force_authenticate(self.helper)
        with self.captureOnCommitCallbacks(execute=True):
            confirmed = self.client.post(f"/api/applications/{applied.data['id']}/respond-offer/", {"decision": "accept"}, format="json")
        self.assertEqual(confirmed.status_code, 200)
        self.assertEqual(confirmed.data["status"], "accepted")
        self.task.refresh_from_db(); self.assertEqual(self.task.status, "assigned")
        send_accepted_email.assert_called_once()
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get(self.path("workspace")).data["contact_phone"],self.helper.phone)

    def test_multiple_shortlists_are_allowed_but_only_one_offer_can_wait(self):
        first = self.client.post("/api/applications/", {"task": self.task.pk, "message": "I can help first"})
        self.client.force_authenticate(self.stranger)
        second = self.client.post("/api/applications/", {"task": self.task.pk, "message": "I can help too"})
        self.client.force_authenticate(self.owner)
        for application_id in (first.data["id"], second.data["id"]):
            self.assertEqual(self.client.post(f"/api/applications/{application_id}/shortlist/").status_code, 200)
        self.assertEqual(self.client.post(f"/api/applications/{first.data['id']}/offer/", {"booking_note": "Agreed first booking details."}, format="json").status_code, 200)
        self.assertEqual(self.client.post(f"/api/applications/{second.data['id']}/offer/", {"booking_note": "Agreed second booking details."}, format="json").status_code, 400)
        self.task.refresh_from_db(); self.assertEqual(self.task.status, "open")
        self.client.force_authenticate(self.helper)
        declined = self.client.post(f"/api/applications/{first.data['id']}/respond-offer/", {"decision": "decline"}, format="json")
        self.assertEqual(declined.data["status"], "shortlisted")
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.post(f"/api/applications/{second.data['id']}/offer/", {"booking_note": "Agreed second booking details."}, format="json").status_code, 200)
        self.client.force_authenticate(self.stranger)
        self.assertEqual(self.client.post(f"/api/applications/{second.data['id']}/respond-offer/", {"decision": "accept"}, format="json").status_code, 200)
        self.assertEqual(Application.objects.get(pk=first.data["id"]).status, "declined")
        self.assertEqual(Application.objects.get(pk=second.data["id"]).status, "accepted")

    def test_multi_helper_task_stays_open_until_all_spots_are_filled(self):
        self.task.helpers_needed = 2
        self.task.save(update_fields=("helpers_needed",))
        first = self.client.post("/api/applications/", {"task": self.task.pk, "message": "First helper"})
        self.client.force_authenticate(self.stranger)
        second = self.client.post("/api/applications/", {"task": self.task.pk, "message": "Second helper"})
        self.client.force_authenticate(self.owner)
        for application_id in (first.data["id"], second.data["id"]):
            self.client.post(f"/api/applications/{application_id}/shortlist/")
            self.assertEqual(self.client.post(f"/api/applications/{application_id}/offer/", {"booking_note": "Agreed work, timing, and reward."}).status_code, 200)
        self.client.force_authenticate(self.helper)
        self.assertEqual(self.client.post(f"/api/applications/{first.data['id']}/respond-offer/", {"decision": "accept"}).status_code, 200)
        self.task.refresh_from_db(); self.assertEqual(self.task.status, "open")
        self.client.force_authenticate(self.stranger)
        self.assertEqual(self.client.post(f"/api/applications/{second.data['id']}/respond-offer/", {"decision": "accept"}).status_code, 200)
        self.task.refresh_from_db(); self.assertEqual(self.task.status, "assigned")
        self.assertEqual(self.task.applications.filter(status="accepted").count(), 2)
        self.assertEqual(self.client.get(self.path("workspace")).status_code, 200)

    def test_recurring_task_keeps_accepting_applications_after_booking(self):
        self.task.is_recurring = True
        self.task.save(update_fields=("is_recurring",))
        first = self.client.post("/api/applications/", {"task": self.task.pk, "message": "Recurring helper"})
        self.client.force_authenticate(self.owner)
        self.client.post(f"/api/applications/{first.data['id']}/shortlist/")
        self.client.post(f"/api/applications/{first.data['id']}/offer/", {"booking_note": "Recurring help every Saturday morning."})
        self.client.force_authenticate(self.helper)
        self.assertEqual(self.client.post(f"/api/applications/{first.data['id']}/respond-offer/", {"decision": "accept"}).status_code, 200)
        self.task.refresh_from_db(); self.assertEqual(self.task.status, "open")
        self.client.force_authenticate(self.stranger)
        self.assertEqual(self.client.post("/api/applications/", {"task": self.task.pk, "message": "Available next week"}).status_code, 201)

    def test_confirmed_helper_can_request_completion_on_an_open_recurring_task(self):
        self.task.is_recurring = True
        self.task.save(update_fields=("is_recurring",))
        first = self.client.post("/api/applications/", {"task": self.task.pk, "message": "Recurring helper"})
        self.client.force_authenticate(self.owner)
        self.client.post(f"/api/applications/{first.data['id']}/shortlist/")
        self.client.post(f"/api/applications/{first.data['id']}/offer/", {"booking_note": "Recurring help every Saturday morning."})
        self.client.force_authenticate(self.helper)
        self.assertEqual(self.client.post(f"/api/applications/{first.data['id']}/respond-offer/", {"decision": "accept"}).status_code, 200)
        requested = self.client.post(self.path("changes"), {"kind": "complete"})
        self.assertEqual(requested.status_code, 201)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.post(self.path(f"changes/{requested.data['id']}/respond"), {"decision": "accept"}).status_code, 200)
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, "open")

    def test_shortlisted_candidate_chat_is_private_and_retry_safe(self):
        applied = self.client.post("/api/applications/", {"task": self.task.pk, "message": "I can help"})
        self.client.force_authenticate(self.owner)
        self.client.post(f"/api/applications/{applied.data['id']}/shortlist/")
        payload = {"text": "Have you moved a table like this before?", "client_id": str(uuid.uuid4())}
        sent = self.client.post(f"/api/applications/{applied.data['id']}/messages/", payload, format="json")
        self.assertEqual(sent.status_code, 201)
        self.assertEqual(Notification.objects.filter(recipient=self.helper, title="New candidate message").get().path, f"/applications/{applied.data['public_id']}#message-{sent.data['id']}")
        self.assertEqual(self.client.post(f"/api/applications/{applied.data['id']}/messages/", payload, format="json").status_code, 200)
        self.assertEqual(ApplicationMessage.objects.count(), 1)
        self.client.force_authenticate(self.stranger)
        self.assertEqual(self.client.get(f"/api/applications/{applied.data['id']}/messages/").status_code, 404)

    def test_application_detail_uses_a_public_uuid(self):
        applied = self.client.post("/api/applications/", {"task": self.task.pk, "message": "I can help"})
        self.assertEqual(applied.status_code, 201)
        self.assertIn("public_id", applied.data)
        self.assertEqual(Notification.objects.get(recipient=self.owner, title="New task application").path, f"/applications/{applied.data['public_id']}")
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get(f"/api/applications/{applied.data['public_id']}/").status_code, 200)

    def test_messages_are_participant_only_and_retries_do_not_duplicate(self):
        self.assign(); client_id=str(uuid.uuid4())
        payload={"text":"I will arrive at 3pm.","client_id":client_id}
        first=self.client.post(self.path("messages"),payload); self.assertEqual(first.status_code,201)
        self.assertEqual(self.client.post(self.path("messages"),payload).status_code,200)
        self.assertEqual(TaskMessage.objects.count(),1)
        self.assertEqual(Notification.objects.filter(recipient=self.owner).count(),1)
        self.assertEqual(Notification.objects.get(recipient=self.owner).path, f"/messages/{self.task.public_id}#message-{first.data['id']}")
        self.assertEqual(self.client.post(self.path("messages"),{**payload,"text":"Changed text"}).status_code,400)
        self.client.force_authenticate(self.stranger)
        self.assertEqual(self.client.get(self.path("messages")).status_code,404)
        self.assertEqual(self.client.get(self.path("workspace")).status_code,404)

    @patch("bookings.message_attachments.r2.object_bytes", return_value=b"%PDF-1.7\nproof")
    @patch("bookings.message_attachments.r2.object_metadata", return_value={"ContentLength": 14, "ContentType": "application/pdf"})
    def test_message_can_contain_private_proof_attachment_without_text(self, metadata, content):
        self.assign()
        key = f"message-attachments/{self.helper.pk}/proof.pdf"
        payload = {"text": "", "client_id": str(uuid.uuid4()), "attachments": [{
            "key": key, "name": "Completion proof.pdf", "content_type": "application/pdf", "size": 14,
        }]}
        sent = self.client.post(self.path("messages"), payload, format="json")
        self.assertEqual(sent.status_code, 201, sent.data)
        self.assertEqual(sent.data["attachments"][0]["name"], "Completion proof.pdf")
        message_id = sent.data["id"]
        with patch("bookings.message_attachments.r2.configured", return_value=True), patch(
            "bookings.message_attachments.r2.download_url", side_effect=("https://files.example.test/preview", "https://files.example.test/download")
        ):
            opened = self.client.get(self.path(f"messages/{message_id}/attachments/0"))
            self.assertEqual(opened.status_code, 200)
            self.assertEqual(opened.data["url"], "https://files.example.test/preview")
            self.assertEqual(opened.data["download_url"], "https://files.example.test/download")
            self.client.force_authenticate(self.stranger)
            self.assertEqual(self.client.get(self.path(f"messages/{message_id}/attachments/0")).status_code, 404)

    @patch("bookings.message_attachments.r2.upload_url", return_value="https://upload.example.test/signed")
    @patch("bookings.message_attachments.r2.configured", return_value=True)
    def test_message_upload_ticket_requires_conversation_access(self, configured, upload_url):
        self.assign()
        ticket = self.client.post(self.path("message-upload"), {
            "name": "before.jpg", "content_type": "image/jpeg", "size": 2048,
        }, format="json")
        self.assertEqual(ticket.status_code, 200)
        self.assertTrue(ticket.data["key"].startswith(f"message-attachments/{self.helper.pk}/"))
        self.client.force_authenticate(self.stranger)
        self.assertEqual(self.client.post(self.path("message-upload"), {
            "name": "private.jpg", "content_type": "image/jpeg", "size": 2048,
        }, format="json").status_code, 404)

    def test_conversation_inbox_is_private_and_keeps_ended_history(self):
        self.assertEqual(self.client.get("/api/tasks/conversations/").data["count"], 0)
        self.assign()
        TaskMessage.objects.create(task=self.task, sender=self.helper, text="I am on my way.", client_id=uuid.uuid4())
        for member, counterpart in ((self.owner, self.helper), (self.helper, self.owner)):
            self.client.force_authenticate(member)
            inbox = self.client.get("/api/tasks/conversations/?mine=true")
            self.assertEqual(inbox.status_code, 200)
            self.assertEqual(inbox.data["count"], 1)
            row = inbox.data["results"][0]
            self.assertEqual(row["member"]["id"], counterpart.pk)
            self.assertEqual(row["last_message"], "I am on my way.")
            self.assertNotIn("phone", row["member"])
        self.task.status = "completed"; self.task.save()
        Block.objects.create(blocker=self.owner, blocked=self.helper)
        self.assertEqual(self.client.get("/api/tasks/conversations/").data["results"][0]["status"], "completed")
        self.client.force_authenticate(self.stranger)
        self.assertEqual(self.client.get("/api/tasks/conversations/").data["count"], 0)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get("/api/tasks/conversations/").status_code, 401)

    def test_blocks_stop_new_messages_but_preserve_history_and_issue_access(self):
        self.assign(); Block.objects.create(blocker=self.owner,blocked=self.helper)
        self.assertEqual(self.client.post(self.path("messages"),{"text":"Hello","client_id":str(uuid.uuid4())}).status_code,403)
        self.assertEqual(self.client.get(self.path("messages")).status_code,200)
        self.assertFalse(self.client.get(self.path("workspace")).data["can_message"])
        self.assertEqual(self.client.post(self.path("issues"),{"kind":"dispute","details":"We cannot agree on the task scope."}).status_code,201)

    def test_completion_needs_other_participant_and_review_stays_locked_until_then(self):
        self.assign()
        change=self.propose("complete"); self.assertEqual(change.status_code,201)
        self.task.refresh_from_db(); self.assertEqual(self.task.status,"assigned")
        self.assertEqual(self.respond(change.data["id"],"accept").status_code,403)
        self.assertEqual(self.client.post("/api/auth/reviews/",{"task":self.task.pk,"rating":5}).status_code,404)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.respond(change.data["id"],"accept").status_code,200)
        self.assertEqual(self.respond(change.data["id"],"accept").status_code,400)
        self.task.refresh_from_db(); self.assertEqual(self.task.status,"completed")
        self.assertEqual(self.client.post("/api/auth/reviews/",{"task":self.task.pk,"rating":5}).status_code,201)
        self.assertEqual(self.client.post(self.path("messages"),{"text":"Hello","client_id":str(uuid.uuid4())}).status_code,400)

    def test_rescheduling_requires_confirmation_and_declines_preserve_original_time(self):
        self.assign(); original=timezone.now()+timedelta(days=1)
        self.task.scheduled_for=original; self.task.save()
        proposed=original+timedelta(days=1)
        change=self.propose("reschedule",reason="Need a later time",scheduled_for=proposed.isoformat())
        self.assertEqual(change.status_code,201)
        self.task.refresh_from_db(); self.assertEqual(self.task.scheduled_for,original)
        self.assertEqual(self.propose("complete").status_code,400)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.respond(change.data["id"],"decline").status_code,200)
        change=self.propose("reschedule",reason="Agreed later time",scheduled_for=proposed.isoformat())
        self.client.force_authenticate(self.helper)
        self.assertEqual(self.respond(change.data["id"],"accept").status_code,200)
        self.task.refresh_from_db(); self.assertEqual(self.task.scheduled_for,proposed)

    def test_cancellation_after_acceptance_is_mutual_and_pending_application_can_withdraw(self):
        applied=self.client.post("/api/applications/",{"task":self.task.pk,"message":"Hi"})
        self.assertEqual(self.client.post(f"/api/applications/{applied.data['id']}/withdraw/").status_code,200)
        Application.objects.all().delete(); self.assign()
        self.assertEqual(self.client.post(self.path("cancel")).status_code,403)
        change=self.propose("cancel",reason="Cannot make the agreed date")
        self.assertEqual(change.status_code,201)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.respond(change.data["id"],"accept").status_code,200)
        self.task.refresh_from_db(); self.assertEqual(self.task.status,"cancelled")

    def test_dispute_pauses_changes_and_admin_resolution_is_audited_and_not_repeatable(self):
        self.assign(); self.assertEqual(self.propose("complete").status_code,201)
        result=self.client.post(self.path("issues"),{"kind":"dispute","details":"The agreed scope has changed significantly."})
        self.assertEqual(result.status_code,201)
        self.assertFalse(TaskChange.objects.filter(status="pending").exists())
        self.assertEqual(self.propose("complete").status_code,400)
        issue=TaskIssue.objects.get()
        with self.assertRaises(PermissionDenied): resolve_issue(issue,self.helper,"cancel","Cannot proceed")
        resolve_issue(issue,self.admin,"cancel","Booking cancelled after reviewing both accounts.")
        self.task.refresh_from_db(); self.assertEqual(self.task.status,"cancelled")
        self.assertEqual(Notification.objects.filter(title="Task issue resolved").count(),2)

    def test_no_show_is_only_reportable_after_scheduled_time(self):
        self.assign()
        data={"kind":"no_show","details":"The other participant did not arrive."}
        self.assertEqual(self.client.post(self.path("issues"),data).status_code,400)
        self.task.scheduled_for=timezone.now()-timedelta(hours=1); self.task.save()
        self.assertEqual(self.client.post(self.path("issues"),data).status_code,201)

    def test_direct_requests_are_private_and_only_target_can_accept(self):
        self.client.force_authenticate(self.owner)
        data={"title":"Please move a sofa","description":"One sofa upstairs","city":"Abuja","state":"FCT","reward_amount":"6000","policy_confirmed":True}
        result=self.client.post(f"/api/offers/{self.offer.pk}/request/",data)
        self.assertEqual(result.status_code,201,result.data)
        task_id=result.data["id"]
        self.assertEqual(self.client.post(f"/api/offers/{self.offer.pk}/request/",data).status_code,400)
        self.client.force_authenticate(self.stranger)
        self.assertEqual(self.client.get(f"/api/tasks/{task_id}/").status_code,404)
        self.assertNotIn(task_id,[task["id"] for task in self.client.get("/api/tasks/").data["results"]])
        self.client.force_authenticate(self.helper)
        self.assertEqual(self.client.get("/api/tasks/?invitations=true").data["count"],1)
        task_public_id=result.data["public_id"]
        self.assertEqual(self.client.post(f"/api/tasks/{task_public_id}/respond-invitation/",{"decision":"accept"}).status_code,200)
        self.assertEqual(Task.objects.get(pk=task_id).status,"assigned")

    def test_unavailable_helper_cannot_receive_request_and_notification_access_is_private(self):
        self.helper.availability="unavailable"; self.helper.save()
        self.client.force_authenticate(self.owner)
        data={"title":"Move sofa","description":"One sofa upstairs","city":"Abuja","state":"FCT","reward_amount":"6000","policy_confirmed":True}
        self.assertEqual(self.client.post(f"/api/offers/{self.offer.pk}/request/",data).status_code,400)
        notification=Notification.objects.create(recipient=self.helper,title="Private alert",path="/activity")
        self.assertEqual(self.client.get("/api/notifications/unread/").data["count"],0)
        self.assertEqual(self.client.post(f"/api/notifications/{notification.pk}/read/").status_code,404)
        self.client.force_authenticate(self.helper)
        self.assertEqual(self.client.post(f"/api/notifications/{notification.pk}/read/").status_code,200)
        self.assertEqual(self.client.get("/api/notifications/unread/").data["count"],0)

    def test_activity_sections_have_independent_server_side_search(self):
        self.assign()
        invitation = Task.objects.create(requester=self.owner, target_helper=self.helper, is_private=True,
            title="Assemble a bookshelf", description="Put the shelf together", city="Abuja", state="FCT", reward_amount=6500)
        self.assertEqual(self.client.get("/api/tasks/?bookings=true&search=table").data["count"], 1)
        self.assertEqual(self.client.get("/api/tasks/?bookings=true&search=bookshelf").data["count"], 0)
        self.assertEqual(self.client.get("/api/tasks/?invitations=true&search=bookshelf").data["results"][0]["id"], invitation.pk)
        self.assertEqual(self.client.get("/api/offers/?mine=true&search=moving").data["results"][0]["id"], self.offer.pk)
        self.assertEqual(self.client.get("/api/applications/?search=table").data["count"], 1)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get("/api/tasks/?mine=true&search=table").data["count"], 1)
        self.assertEqual(self.client.get("/api/applications/?received=true&search=helper").data["count"], 1)

    def test_discovery_filters_and_sorting_and_profile_edits_are_real(self):
        Task.objects.create(requester=self.owner,title="A higher reward",description="Test",city="Abuja",state="FCT",neighborhood="Maitama",reward_amount=9000,scheduled_for=timezone.now()+timedelta(days=2))
        self.assertEqual(self.client.get("/api/tasks/?neighborhood=Garki&timing=flexible").data["count"],1)
        self.assertEqual(self.client.get("/api/tasks/?sort=reward_high").data["results"][0]["reward_amount"],"9000.00")
        self.assertEqual(self.client.get("/api/tasks/?min_reward=bad").status_code,400)
        edited=self.client.patch("/api/auth/me/",{"bio":"I help with moving.","skills":["moving"],"availability":"weekends","neighborhood":"Garki"},format="json")
        self.assertEqual(edited.status_code,200)
        self.client.force_authenticate(self.owner)
        profile=self.client.get(f"/api/auth/members/{self.helper.pk}/").data
        self.assertEqual(profile["skills"],["moving"])
        self.assertEqual(profile["availability"],"weekends")
        self.assertEqual(profile["offers"][0]["id"],self.offer.pk)

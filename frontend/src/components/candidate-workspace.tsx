"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CircleCheck, MessageCircle, Send, ShieldCheck, UserRoundCheck } from "lucide-react";
import { api } from "@/lib/api";
import { Application, ApplicationMessage, User } from "@/lib/types";
import { MemberPhoto, TrustBadges } from "./trust";
import { AttachmentPicker, MessageAttachments, uploadMessageFiles } from "./message-attachments";

const stages = ["Applied", "Shortlisted", "Offer sent", "Booked"];
const stageByStatus: Partial<Record<Application["status"], number>> = { pending: 0, shortlisted: 1, offered: 2, accepted: 3 };
const statusLabels: Record<Application["status"], string> = {
  pending: "Application received",
  shortlisted: "Shortlisted · chat open",
  offered: "Booking offer awaiting reply",
  accepted: "Booking confirmed",
  declined: "Application closed",
  withdrawn: "Application withdrawn",
};

export function CandidateWorkspace({ applicationId }: { applicationId: string }) {
  const [application, setApplication] = useState<Application | null>(null);
  const [me, setMe] = useState<User | null>(null);
  const [messages, setMessages] = useState<ApplicationMessage[]>([]);
  const [text, setText] = useState("");
  const [offerNote, setOfferNote] = useState("");
  const [showOffer, setShowOffer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState("");
  const lastMessage = useRef(0);
  const messageRequest = useRef(false);
  const openedLinkedMessage = useRef(false);
  const base = `/applications/${applicationId}`;

  const load = useCallback(async (signal?: AbortSignal) => {
    const [item, user] = await Promise.all([api<Application>(`${base}/`, { signal }), api<User>("/auth/me/", { signal })]);
    if (!signal?.aborted) { setApplication(item); setMe(user); }
  }, [base]);

  const loadMessages = useCallback(async (signal?: AbortSignal) => {
    if (messageRequest.current) return;
    messageRequest.current = true;
    try {
      let more = true;
      while (more) {
        const data = await api<{ results: ApplicationMessage[]; has_more: boolean }>(`${base}/messages/?after=${lastMessage.current}`, { signal });
        if (signal?.aborted) return;
        if (data.results.length) {
          lastMessage.current = data.results.at(-1)!.id;
          setMessages((current) => {
            const ids = new Set(current.map((message) => message.id));
            return [...current, ...data.results.filter((message) => !ids.has(message.id))];
          });
        }
        more = data.has_more;
      }
    } finally { messageRequest.current = false; }
  }, [base]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([load(controller.signal), loadMessages(controller.signal)]).catch((err) => { if (!controller.signal.aborted) setError(err.message); });
    const refresh = () => { if (!document.hidden) { load(controller.signal).catch(() => {}); loadMessages(controller.signal).catch(() => {}); } };
    const timer = setInterval(refresh, 10000);
    document.addEventListener("visibilitychange", refresh);
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [load, loadMessages]);
  useEffect(() => {
    if (openedLinkedMessage.current || !window.location.hash.startsWith("#message-")) return;
    const message = document.getElementById(window.location.hash.slice(1));
    if (message) { openedLinkedMessage.current = true; message.scrollIntoView({ behavior: "smooth", block: "center" }); message.focus({ preventScroll: true }); }
  }, [messages]);

  async function act(path: string, body: unknown = {}, success = "Application updated.") {
    if (busy) return false;
    setBusy(true); setError(""); setFeedback("");
    try {
      await api(`${base}/${path}/`, { method: "POST", body: JSON.stringify(body) });
      await Promise.all([load(), loadMessages()]);
      setFeedback(success);
      setShowOffer(false);
      window.dispatchEvent(new Event("neba_notifications"));
      return true;
    } catch (err) { setError((err as Error).message); return false; }
    finally { setBusy(false); }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = text.trim();
    if (!value && !files.length) return;
    setBusy(true); setError(""); setFeedback("");
    try {
      const attachments = files.length ? await uploadMessageFiles(base, files, setUploadProgress) : [];
      setUploadProgress("Sending…");
      await api(`${base}/messages/`, { method: "POST", body: JSON.stringify({ text: value, attachments, client_id: crypto.randomUUID() }) });
      setText(""); setFiles([]); setFeedback("Message sent."); await loadMessages(); window.dispatchEvent(new Event("neba_notifications"));
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); setUploadProgress(""); }
  }

  async function sendOffer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const note = offerNote.trim();
    if (!window.confirm("Send this booking offer? The task stays open until the helper confirms.")) return;
    if (await act("offer", { booking_note: note }, "Booking offer sent. The helper must confirm before the task is assigned.")) setOfferNote("");
  }

  if (!application || !me) return <main className="container candidate-page"><p role={error ? "alert" : "status"} className={error ? "error-box" : ""}>{error || "Loading application…"}</p></main>;
  const requester = application.applicant !== me.id;
  const stage = stageByStatus[application.status];
  const chatOpen = application.status === "shortlisted" || application.status === "offered";
  const profilePath = `/u/${application.applicant_username || application.applicant_public_id || application.applicant}`;
  const taskPath = `/tasks/${application.task_public_id || application.task}`;

  return <main className="container candidate-page">
    <Link className="back-link" href="/activity"><ArrowLeft size={16} />Back to activity</Link>
    <section className={`candidate-shell${stage === undefined ? " is-closed" : ""}`}>
      <header className="candidate-header">
        <span className="eyebrow">CANDIDATE WORKSPACE</span>
        <div className="candidate-title-row"><div><h1>{requester ? `Talk with ${application.applicant_name || "this applicant"}` : application.task_title}</h1><p><Link href={taskPath}>{application.task_title}</Link></p></div><span className={`candidate-status status-${application.status}`}>{statusLabels[application.status]}</span></div>
        <div className="candidate-steps" aria-label={`Application status: ${statusLabels[application.status]}`}>
          {stages.map((label, index) => <div className={stage !== undefined && index <= stage ? "reached" : ""} key={label}><span>{stage !== undefined && index < stage ? <Check size={13} /> : index + 1}</span><small>{label}</small></div>)}
        </div>
        <p className="candidate-clarifier"><ShieldCheck size={16} /><strong>Shortlisting opens a private chat.</strong> The task is booked only after a booking offer is sent and the helper confirms it.</p>
      </header>

      <div className="candidate-grid">
        <div className="candidate-main">
          <section className="candidate-application">
            <div className="candidate-person"><MemberPhoto id={application.applicant_public_id || application.applicant} name={application.applicant_name || "N"} available={application.applicant_trust?.photo_available} /><div><Link href={profilePath}><strong>{application.applicant_name || "Applicant"}</strong></Link><span>Applicant</span></div></div>
            <TrustBadges trust={application.applicant_trust} />
            <div className="candidate-introduction"><span>APPLICATION NOTE</span><p>{application.message}</p></div>
          </section>

          {(chatOpen || messages.length > 0) && <section className="candidate-chat">
            <div className="candidate-section-heading"><span><MessageCircle size={18} /></span><div><h2>Before-you-book chat</h2><p>Ask about experience, availability, approach, timing, and the reward. Contact details stay private.</p></div></div>
            <div className="message-list" role="log" aria-label="Candidate messages" aria-live="polite">{messages.length ? messages.map((message) => <article id={`message-${message.id}`} tabIndex={-1} className={`message-bubble ${message.sender === me.id ? "mine" : ""}`} key={message.id}><strong>{message.sender === me.id ? "You" : message.sender_name || "Task partner"}</strong>{message.text && <p>{message.text}</p>}<MessageAttachments base={base} messageId={message.id} attachments={message.attachments} /><small>{new Date(message.created_at).toLocaleString("en-NG")}</small></article>) : <p className="panel-empty">No messages yet. Start with the detail that matters most for this task.</p>}</div>
            {chatOpen ? <form className="message-compose" onSubmit={sendMessage}><AttachmentPicker files={files} disabled={busy} progress={uploadProgress} onChange={setFiles} onError={setError} /><div className="message-compose-row"><label className="sr-only" htmlFor="candidate-message">Message about this application</label><textarea id="candidate-message" rows={3} maxLength={2000} value={text} onChange={(event) => setText(event.target.value)} placeholder="Write a message or attach a photo…" /><button className="button button-dark compact" disabled={busy || (!text.trim() && !files.length)}><Send size={16} />Send</button></div></form> : <p className="form-note">This candidate chat is archived. Use the booking conversation for confirmed work.</p>}
          </section>}
        </div>

        <aside className="candidate-actions">
          {application.status === "pending" && requester && <><span className="candidate-action-icon"><UserRoundCheck size={21} /></span><h2>Review this applicant first</h2><p>Shortlisting opens a private chat. It does not book the helper or close your other applications.</p><ol className="candidate-next-steps"><li>Shortlist and start chat</li><li>Talk through the work, timing, and reward</li><li>Prepare and send a booking offer</li><li>Wait for the helper to confirm</li></ol><button className="button button-dark full-width" disabled={busy} onClick={() => act("shortlist", {}, "Applicant shortlisted. You can now talk before deciding.")}>Shortlist and start chat<ArrowRight size={16} /></button><button className="text-button" disabled={busy} onClick={() => act("decline", {}, "Application closed.")}>Close this application</button></>}
          {application.status === "pending" && !requester && <><h2>Application sent</h2><p>The tasker can review your profile and shortlist you for a private chat. No booking has been made yet.</p><button className="text-button" disabled={busy} onClick={() => act("withdraw", {}, "Application withdrawn.")}>Withdraw application</button></>}
          {application.status === "shortlisted" && requester && <><h2>Still deciding</h2><p>Use the chat to confirm fit. When the details are clear, send this helper a booking offer.</p>{showOffer ? <form className="stack-form candidate-offer-form" onSubmit={sendOffer}><label>What you agreed<textarea rows={4} minLength={10} maxLength={1000} value={offerNote} onChange={(event) => setOfferNote(event.target.value)} placeholder="Example: Carry one table upstairs on Saturday at 2pm for ₦5,000." required /></label><small>This summary becomes the helper’s confirmation screen.</small><button className="button button-dark full-width" disabled={busy || offerNote.trim().length < 10}>Send booking offer</button><button type="button" className="text-button" onClick={() => setShowOffer(false)}>Not yet</button></form> : <button className="button button-dark full-width" disabled={busy} onClick={() => setShowOffer(true)}>Prepare booking offer<ArrowRight size={16} /></button>}<button className="text-button" disabled={busy} onClick={() => act("decline", {}, "Application closed.")}>Close this application</button></>}
          {application.status === "shortlisted" && !requester && <><h2>You’re shortlisted</h2><p>Use the chat to make sure the task, timing, and reward work for you. You are not booked yet.</p><button className="text-button" disabled={busy} onClick={() => act("withdraw", {}, "Application withdrawn.")}>Withdraw application</button></>}
          {application.status === "offered" && <><span className="candidate-action-icon success"><CircleCheck size={21} /></span><h2>{requester ? "Waiting for confirmation" : "Review the booking offer"}</h2><p className="candidate-offer-note">{application.booking_note}</p>{requester ? <><p>The task remains open until the helper confirms.</p><button className="text-button" disabled={busy} onClick={() => act("retract-offer", {}, "Offer withdrawn. The private chat remains open.")}>Withdraw offer and keep talking</button></> : <><p>Accept only if the work, timing, and reward match what you discussed.</p><button className="button button-dark full-width" disabled={busy} onClick={() => { if (window.confirm("Confirm this booking? The tasker will be notified and the task will be assigned to you.")) act("respond-offer", { decision: "accept" }, "Booking confirmed."); }}>Confirm booking<Check size={16} /></button><button className="text-button" disabled={busy} onClick={() => act("respond-offer", { decision: "decline" }, "Offer declined. The private chat remains open.")}>Decline offer and keep talking</button></>}</>}
          {application.status === "accepted" && <><span className="candidate-action-icon success"><CircleCheck size={21} /></span><h2>Booking confirmed</h2><p>Both sides have agreed. Continue in the booking workspace to coordinate and share contact details.</p><Link className="button button-dark full-width" href={taskPath}>Open booking<ArrowRight size={16} /></Link></>}
          {application.status === "declined" && <><h2>Application closed</h2><p>{requester ? "You decided not to continue with this applicant." : "The tasker continued with another option. No booking was created."}</p></>}
          {application.status === "withdrawn" && <><h2>Application withdrawn</h2><p>No booking was created. The candidate conversation is archived.</p></>}
          {error && <p className="error-box" role="alert">{error}</p>}
          {feedback && <p className="form-feedback" role="status">{feedback}</p>}
        </aside>
      </div>
    </section>
  </main>;
}

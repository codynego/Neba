"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MessageCircle, CalendarDays, CircleCheck, Flag } from "lucide-react";
import { api } from "@/lib/api";
import { Workspace } from "@/lib/types";
import { MemberPhoto, TrustBadges } from "./trust";
import { CompletedReview, SafetyActions } from "./safety-actions";

export function BookingWorkspace({ taskId, me, onChanged }: { taskId: number; me: number; onChanged: () => void }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<"reschedule" | "cancel" | "issue" | null>(null);
  const base = `/tasks/${taskId}`;
  const load = useCallback(async () => { setWorkspace(await api<Workspace>(`${base}/workspace/`)); }, [base]);
  useEffect(() => {
    let active = true;
    load().catch((err) => { if (active) setError(err.message); });
    const refresh = () => { if (!document.hidden) { load().catch(() => {}); } };
    const timer = setInterval(refresh, 10000); document.addEventListener("visibilitychange", refresh);
    return () => { active = false; clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [load]);
  async function act(path: string, data: unknown = {}) {
    if (busy) return; setBusy(true); setError(""); setFeedback("");
    try { await api(`${base}/${path}/`, { method: "POST", body: JSON.stringify(data) }); await load(); onChanged(); setForm(null); setFeedback("Task updated. The other participant has been notified."); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  if (!workspace) return <section className="booking-workspace"><p role="status">{error || "Loading your booking..."}</p></section>;
  const ended = workspace.task.status === "completed" || workspace.task.status === "cancelled";
  const pending = workspace.pending_change;
  return <section className="booking-workspace"><div className="booking-heading"><div><span className="eyebrow">YOUR BOOKING</span><h2>{workspace.task.status === "completed" ? "Completed together." : workspace.task.status === "cancelled" ? "Booking cancelled." : workspace.active_issue ? "Task paused for review." : "Make it happen together."}</h2><p>{workspace.task.scheduled_for ? new Date(workspace.task.scheduled_for).toLocaleString("en-NG") : "Flexible timing"}</p></div><span className="status-pill">{workspace.task.status}</span></div>
    <div className="booking-member"><MemberPhoto id={workspace.member.id} name={workspace.member.display_name || "N"} available={workspace.member.photo_available} /><div><Link href={`/members/${workspace.member.username || workspace.member.public_id || workspace.member.id}`}><strong>{workspace.member.display_name || "Community member"}</strong></Link><TrustBadges trust={workspace.member} />{workspace.contact_phone && <a href={`tel:${workspace.contact_phone}`}>{workspace.contact_phone}</a>}</div></div>
    {error && <p className="error-box" role="alert">{error}</p>}{feedback && <p className="form-feedback" role="status">{feedback}</p>}
    {workspace.active_issue && <div className="verification-notice"><Flag size={20} /><div><strong>{workspace.active_issue.kind === "no_show" ? "No-show report" : "Dispute"} #{workspace.active_issue.id}: {workspace.active_issue.status}</strong><p>{workspace.active_issue.details}</p><small>Changes are paused while an admin reviews the issue. You can keep the conversation factual or use the safety controls below.</small></div></div>}
    {pending && <div className="pending-change"><strong>{pending.proposer === me ? "You requested" : "Your task partner requested"} {pending.kind === "complete" ? "completion" : pending.kind === "cancel" ? "cancellation" : "a new time"}</strong>{pending.reason && <p>{pending.reason}</p>}{pending.scheduled_for && <p><CalendarDays size={15} />{new Date(pending.scheduled_for).toLocaleString("en-NG")}</p>}<div className="form-actions">{pending.proposer === me ? <button className="small-button" disabled={busy} onClick={() => act(`changes/${pending.id}/respond`, { decision: "withdraw" })}>Withdraw request</button> : <><button className="button button-dark compact" disabled={busy} onClick={() => act(`changes/${pending.id}/respond`, { decision: "accept" })}>{pending.kind === "complete" ? "Confirm work is complete" : pending.kind === "cancel" ? "Agree to cancel" : "Accept new time"}</button><button className="small-button" disabled={busy} onClick={() => act(`changes/${pending.id}/respond`, { decision: "decline" })}>Decline</button></>}</div></div>}
    {!ended && !workspace.active_issue && <><div className="booking-actions"><button className="button button-dark compact" disabled={busy || !!pending} onClick={() => act("changes", { kind: "complete" })}><CircleCheck size={16} />Request completion</button><button className="small-button" disabled={busy || !!pending} onClick={() => setForm(form === "reschedule" ? null : "reschedule")}>Reschedule</button><button className="small-button" disabled={busy || !!pending} onClick={() => setForm(form === "cancel" ? null : "cancel")}>Request cancellation</button><button className="text-button" disabled={busy} onClick={() => setForm(form === "issue" ? null : "issue")}>Report a task issue</button></div>
      {form && <form className="stack-form booking-change-form" onSubmit={(event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); if (form === "issue") act("issues", data); else act("changes", { kind: form, reason: data.reason, scheduled_for: form === "reschedule" ? new Date(String(data.scheduled_for)).toISOString() : undefined }); }}><h3>{form === "issue" ? "No-show or dispute" : form === "reschedule" ? "Propose a new time" : "Ask to cancel this booking"}</h3>{form === "issue" ? <><label>Issue type<select name="kind"><option value="dispute">Dispute or disagreement</option><option value="no_show">No-show after the agreed time</option></select></label><label>What happened?<textarea name="details" required minLength={10} maxLength={2000} rows={3} /></label><small>A no-show needs an agreed scheduled time that has passed. Other problems can be reported as a dispute.</small></> : <><label>Reason<textarea name="reason" required maxLength={1000} rows={3} /></label>{form === "reschedule" && <label>Proposed date and time<input name="scheduled_for" type="datetime-local" required /></label>}<small>The booking only changes after the other person confirms.</small></>}<button className="button button-dark compact" disabled={busy}>{form === "issue" ? "Send to admin review" : "Send request"}</button></form>}</>}
    <div className="booking-message-link"><div><MessageCircle size={22} /><div><strong>{ended ? "Your conversation is saved" : "Coordinate with your task partner"}</strong><p>{ended ? "Revisit the messages in your private inbox." : "Agree on the work and timing in Messages."}</p></div></div><Link className="button button-outline compact" href={`/messages/${taskId}`}>{ended ? "View conversation" : `Message ${workspace.my_role === "requester" ? "helper" : "requester"}`}</Link></div>
    {workspace.task.status === "completed" && <CompletedReview task={taskId} />}<SafetyActions member={workspace.member.id} name={workspace.member.display_name} task={taskId} />
    {(workspace.changes.length > 0 || workspace.issues.length > 0) && <details className="booking-history"><summary>Task history</summary>{workspace.changes.map((change) => <p key={`change-${change.id}`}><strong>{change.kind}: {change.status}</strong>{change.reason && ` — ${change.reason}`}</p>)}{workspace.issues.map((issue) => <p key={`issue-${issue.id}`}><strong>{issue.kind}: {issue.status}</strong>{issue.resolution && ` — ${issue.resolution}`}</p>)}</details>}
  </section>;
}

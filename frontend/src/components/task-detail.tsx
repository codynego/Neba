"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, MapPin, PackageCheck, ShieldAlert, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Task, User, categories, itemTypeLabels, naira, rewardLabel, rewardTypeLabels } from "@/lib/types";
import { TrustBadges, VerificationGate } from "./trust";
import { SafetyActions } from "./safety-actions";
import { BookingWorkspace } from "./booking-workspace";

export function TaskDetail({ id }: { id: string }) {
  const [task, setTask] = useState<Task | null>(null);
  const [me, setMe] = useState<User | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [posted, setPosted] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const [item, user] = await Promise.all([api<Task>(`/tasks/${id}/`), api<User>("/auth/me/")]); setTask(item); setMe(user); }, [id]);

  useEffect(() => {
    setTask(null); setError(""); setFeedback("");
    setPosted(new URLSearchParams(window.location.search).get("posted") === "1");
    load().catch((err) => setError(err.message));
  }, [load]);

  async function action(path: string, body: unknown = {}) {
    if (busy) return;
    setBusy(true); setError("");
    try { await api(path, { method: "POST", body: JSON.stringify(body) }); await load(); setFeedback("Updated. You can track this in Activity."); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  if (!task || !me) return <main className="detail-page container"><p role={error ? "alert" : "status"} className={error ? "error-box" : ""}>{error || "Loading task…"}</p></main>;
  const owner = task.requester === me.id;
  const held = task.moderation_status === "held";
  const rejected = task.moderation_status === "rejected";

  return <main className="detail-page"><div className="container">
    <Link className="back-link" href={task.is_private ? "/activity" : "/tasks"}><ArrowLeft size={17} />{task.is_private ? "Back to activity" : "Back to tasks"}</Link>
    {posted && <div className={`posted-notice${held ? " moderation-held" : ""}`} role="status"><strong>{held ? "Your task is being reviewed." : task.is_private ? "Request sent." : "Your task is posted."}</strong><span>{held ? "It is not visible to other members yet. You’ll get a notification after review." : task.is_private ? "Only you and the requested helper can see it." : "Neighbors can now apply."}</span><Link href="/activity">View activity</Link></div>}
    <div className="detail-grid">
      <article className="detail-main">
        <span className="category-pill">{categories.find((category) => category.value === task.category)?.label}{task.is_private && " · Private request"}</span>
        <h1>{task.title}</h1>
        <div className="detail-meta"><span><MapPin size={18} />{[task.neighborhood, task.city, task.state].filter(Boolean).join(", ")}</span><span><CalendarDays size={18} />{task.scheduled_for ? new Date(task.scheduled_for).toLocaleString("en-NG") : "Flexible timing"}</span>{!task.is_private && <span><Users size={18} />{task.application_count} applicants</span>}</div>
        <div className="detail-body"><h2>What needs doing</h2><p>{task.description}</p></div>
        {task.involves_item && <section className="task-item-summary"><PackageCheck size={20} /><div><span>ITEM INVOLVED</span><strong>{task.item_type ? itemTypeLabels[task.item_type] : "Item"} · {task.item_value ? naira(task.item_value) : "Value not supplied"}</strong><p>Requester confirmed that the item is already paid for.</p></div></section>}
        <div className="posted-by">Posted by <Link href={`/u/${task.requester_username || task.requester_public_id || task.requester}`}><strong>{task.requester_name || "Community member"}</strong></Link></div>
        <TrustBadges trust={task.requester_trust} />
        <SafetyActions member={task.requester} name={task.requester_name} task={task.id} />
      </article>
      <aside className="detail-aside">
        <span className="eyebrow">{rewardTypeLabels[task.reward_type].toUpperCase()} REWARD</span><div className="detail-price">{rewardLabel(task)}</div>{task.reward_type === "money" && task.reward_note && <p>{task.reward_note}</p>}<div className="aside-rule" />
        {held ? <div className="moderation-message"><ShieldAlert size={22} /><h3>Awaiting review</h3><p>{task.moderation_reason || "This task needs a quick policy review before it can be shared."}</p>{owner && <button className="text-button" disabled={busy} onClick={() => action(`/tasks/${id}/cancel/`)}>Cancel this task</button>}</div>
          : rejected ? <div className="moderation-message rejected"><ShieldAlert size={22} /><h3>Task not approved</h3><p>{task.moderation_reason || "This task does not meet the current MVP policy."}</p></div>
          : task.status === "open" ? owner ? <><p>{task.is_private ? `Waiting for ${task.target_helper_name || "your requested helper"} to respond.` : "Applications appear in Activity. Review a helper’s profile before choosing."}</p><Link className="button button-dark full-width" href="/activity">Manage applications</Link><button className="text-button" disabled={busy} onClick={() => action(`/tasks/${id}/cancel/`)}>Cancel this unassigned task</button></>
            : task.is_private ? <><h3>A request for your skills</h3><p>Check the work, reward, and timing. Accepting opens a private conversation with the requester.</p><VerificationGate helper /><button className="button button-dark full-width" disabled={busy} onClick={() => action(`/tasks/${id}/respond-invitation/`, { decision: "accept" })}>Accept request</button><button className="button button-outline full-width" disabled={busy} onClick={() => action(`/tasks/${id}/respond-invitation/`, { decision: "decline" })}>Decline request</button></>
              : <form className="stack-form" onSubmit={async (event) => { event.preventDefault(); await action("/applications/", { task: task.id, message }); }}><label>Introduce yourself<textarea rows={5} value={message} onChange={(event) => setMessage(event.target.value)} maxLength={800} required placeholder="Tell them why you can help…" /></label><VerificationGate helper /><p className="form-note">Your phone number is shared privately after acceptance. You can coordinate in the task conversation.</p><button className="button button-dark full-width" disabled={busy || !message.trim()}>Apply for this task</button></form>
            : <p>This task is {task.status}. {task.has_booking && "Booking actions are below. Open Messages to coordinate."}</p>}
        <small>Agree on the exact work, timing, and reward before starting. Money, goods, and services are exchanged directly.</small>
      </aside>
    </div>
    {error && <p className="error-box" role="alert">{error}</p>}{feedback && <p className="form-feedback" role="status">{feedback}</p>}{task.has_booking && <BookingWorkspace key={task.id} taskId={task.id} me={me.id} onChanged={() => { load().catch((err) => setError(err.message)); }} />}
  </div></main>;
}

"use client";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Flag } from "lucide-react";
import { api, getToken } from "@/lib/api";
import { User } from "@/lib/types";
export function SafetyActions({ member, name, task }: { member: number; name: string; task?: number }) {
  const [me, setMe] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  useEffect(() => { if (getToken()) api<User>("/auth/me/").then((user) => setMe(user.id)).catch(() => {}); }, []);
  if (me === member) return null;
  async function report(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setFeedback("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try { await api("/auth/reports/", { method: "POST", body: JSON.stringify({ ...data, reported_user: member, task }) }); setFeedback("Your report is in the private moderation queue."); }
    catch (err) { setFeedback((err as Error).message); } finally { setBusy(false); }
  }
  return <div className="safety-actions"><button className="text-button" onClick={() => setOpen(!open)} aria-expanded={open}><Flag size={14} />Report or block</button>{open && <div className="safety-action-panel"><h3>Safety options for {name || "this member"}</h3>{!me ? <Link href="/login">Sign in to report or block</Link> : <><form className="stack-form" onSubmit={report}><label>Reason<select name="reason"><option value="unsafe">Unsafe behavior</option><option value="harassment">Harassment</option><option value="fraud">Fraud or impersonation</option><option value="conduct">Inappropriate conduct</option><option value="other">Other</option></select></label><label>What happened?<textarea name="details" required minLength={10} maxLength={2000} rows={3} placeholder="Help the moderation team understand the situation." /></label><button className="button button-outline" disabled={busy}>Send private report</button></form><p>Blocking hides your listings from each other and prevents new work together. Reporting and blocking are separate actions.</p><button className="small-button" disabled={busy} onClick={async () => { setBusy(true); try { await api("/auth/blocks/", { method: "POST", body: JSON.stringify({ user: member }) }); setFeedback("Member blocked. Manage blocks in the safety center."); } catch (err) { setFeedback((err as Error).message); } finally { setBusy(false); } }}>Block this member</button></>}{feedback && <p role="status">{feedback}</p>}<Link href="/safety">Safety center</Link></div>}</div>;
}

export function CompletedReview({ task }: { task: number }) {
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  return <details className="completed-review"><summary>Review this completed task</summary><form className="stack-form" onSubmit={async (event) => { event.preventDefault(); setBusy(true); const data = Object.fromEntries(new FormData(event.currentTarget)); try { await api("/auth/reviews/", { method: "POST", body: JSON.stringify({ ...data, task }) }); setFeedback("Thanks. Your review is published."); } catch (err) { setFeedback((err as Error).message); } finally { setBusy(false); } }}><label>Rating<select name="rating"><option value="5">5 — Excellent</option><option value="4">4 — Good</option><option value="3">3 — Okay</option><option value="2">2 — Poor</option><option value="1">1 — Very poor</option></select></label><label>Your experience<textarea name="comment" maxLength={800} rows={3} placeholder="Keep it factual. Do not include phone numbers or addresses." /></label><button className="small-button" disabled={busy}>Publish review</button>{feedback && <p role="status">{feedback}</p>}</form></details>;
}

"use client";

import Link from "next/link";
import { Check, Flag, HeartHandshake, ShieldCheck, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { api } from "@/lib/api";
import type { Opportunity } from "@/lib/types";

const correctionReasons = [
  ["closed", "This opportunity is closed"],
  ["deadline", "The deadline is incorrect"],
  ["eligibility", "The eligibility is incorrect"],
  ["link", "The application link is broken"],
  ["details", "Other details are incorrect"],
] as const;

export function OpportunityCommunityActions({ opportunity, authenticated, loginHref }: { opportunity: Opportunity; authenticated: boolean; loginHref: string }) {
  const [thanked, setThanked] = useState(opportunity.thanked_by_me);
  const [thanksCount, setThanksCount] = useState(opportunity.thanks_count || 0);
  const [busy, setBusy] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionSent, setCorrectionSent] = useState(false);
  const [error, setError] = useState("");

  async function toggleThanks() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ thanked: boolean; thanks_count: number }>(`/opportunities/${opportunity.public_id}/thank/`, { method: thanked ? "DELETE" : "POST" });
      setThanked(result.thanked);
      setThanksCount(result.thanks_count);
    } catch (exception) {
      setError((exception as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await api(`/opportunities/${opportunity.public_id}/correction/`, { method: "POST", body: JSON.stringify({ reason: form.get("reason"), details: form.get("details") }) });
      setCorrectionSent(true);
    } catch (exception) {
      setError((exception as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return <section className="opportunity-community-card" aria-label="Community contribution">
    <span className="eyebrow">PEOPLE HELPING PEOPLE</span>
    {opportunity.contributor ? <>
      <div className="opportunity-contributor"><span>{opportunity.contributor.name.slice(0, 1).toUpperCase()}</span><div><small>Shared by</small><strong>{opportunity.contributor.name}</strong>{opportunity.contributor.identity_checked && <em><ShieldCheck size={12} /> Identity checked</em>}</div></div>
      {opportunity.share_note && <blockquote>“{opportunity.share_note}”</blockquote>}
      {authenticated ? <button type="button" className={`community-thanks${thanked ? " active" : ""}`} onClick={toggleThanks} disabled={busy}><HeartHandshake size={16} />{thanked ? "Thanked" : "Say thanks"}<span>{thanksCount}</span></button> : <Link className="community-thanks" href={loginHref}><HeartHandshake size={16} />Sign in to say thanks<span>{thanksCount}</span></Link>}
    </> : <p className="community-source-copy">This listing came from an official source or a verified provider.</p>}
    {authenticated ? <button type="button" className="community-correction-trigger" onClick={() => setCorrectionOpen(true)}><Flag size={14} /> Suggest a correction</button> : <Link className="community-correction-trigger" href={loginHref}><Flag size={14} /> Sign in to suggest a correction</Link>}
    {error && <p className="error-box" role="alert">{error}</p>}
    {correctionOpen && <div className="community-dialog-backdrop"><div className="community-dialog" role="dialog" aria-modal="true" aria-labelledby="correction-title"><button type="button" className="community-dialog-close" aria-label="Close correction form" onClick={() => setCorrectionOpen(false)}><X size={18} /></button>{correctionSent ? <div className="community-correction-success"><span><Check size={20} /></span><h2 id="correction-title">Thanks for looking out.</h2><p>Your correction is now in the review queue. The listing will not change until it is checked.</p><button type="button" className="button button-dark" onClick={() => setCorrectionOpen(false)}>Done</button></div> : <form onSubmit={submitCorrection}><span className="eyebrow">HELP KEEP THIS CURRENT</span><h2 id="correction-title">What should we check?</h2><p>Your report goes to the review queue with this opportunity attached.</p><label><span>Issue</span><select name="reason" defaultValue="closed">{correctionReasons.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>What did you notice? <small>Optional</small></span><textarea name="details" rows={4} maxLength={1000} placeholder="Add a source or the correct information if you have it." /></label>{error && <p className="error-box" role="alert">{error}</p>}<button className="button button-dark full-width" disabled={busy}>{busy ? "Sending…" : "Send for review"}</button></form>}</div></div>}
  </section>;
}

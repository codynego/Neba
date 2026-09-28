"use client";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api } from "@/lib/api";
import { Offer, Task, availabilityLabels } from "@/lib/types";
import { VerificationGate } from "./trust";
export function HelperRequestForm({ offer }: { offer: Offer }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; setBusy(true); setError(""); const data = Object.fromEntries(new FormData(event.currentTarget));
    try { const task = await api<Task>(`/offers/${offer.id}/request/`, { method: "POST", body: JSON.stringify({ ...data, category: offer.category, scheduled_for: data.scheduled_for ? new Date(String(data.scheduled_for)).toISOString() : null }) }); router.push(`/tasks/${task.id}?posted=1`); } catch (err) { setError((err as Error).message); setBusy(false); }
  }
  return <div className="helper-request"><p>Availability: {availabilityLabels[offer.provider_availability || "flexible"]}</p>{offer.provider_availability === "unavailable" ? <p className="form-note">This helper is not taking new requests right now.</p> : <><button className="button button-dark full-width" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "Close request form" : "Request this helper"}</button>{open && <form className="stack-form" onSubmit={submit}><p className="form-note">A private request goes to this helper. They can accept or decline. The reward and timing are agreed when they accept.</p><VerificationGate /><label>Task title<input name="title" required maxLength={140} placeholder="e.g. Move a sofa upstairs" /></label><label>What do you need?<textarea name="description" required minLength={10} maxLength={5000} rows={4} /></label><label>City<input name="city" defaultValue={offer.city} required maxLength={120} /></label><label>State<input name="state" defaultValue={offer.state} required maxLength={120} /></label><label>Neighborhood<input name="neighborhood" maxLength={120} /></label><label>Preferred date and time<input name="scheduled_for" type="datetime-local" /></label><label>Offered reward (₦)<input name="reward_amount" type="number" min={1} step="0.01" defaultValue={offer.starting_price} required /></label>{error && <p className="error-box" role="alert">{error}</p>}<button className="button button-dark full-width" disabled={busy}>{busy ? "Sending..." : "Send private request"}</button></form>}</>}</div>;
}

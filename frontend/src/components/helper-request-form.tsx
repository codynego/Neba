"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { PackageCheck, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { ItemType, Offer, Task, availabilityLabels, itemTypeLabels } from "@/lib/types";
import { VerificationGate } from "./trust";

export function HelperRequestForm({ offer }: { offer: Offer }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [involvesItem, setInvolvesItem] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    const data = new FormData(event.currentTarget);
    try {
      const task = await api<Task>(`/offers/${offer.id}/request/`, {
        method: "POST",
        body: JSON.stringify({
          ...Object.fromEntries(data),
          category: offer.category,
          scheduled_for: data.get("scheduled_for") ? new Date(String(data.get("scheduled_for"))).toISOString() : null,
          involves_item: involvesItem,
          item_type: involvesItem ? data.get("item_type") : "",
          item_value: involvesItem ? data.get("item_value") : null,
          item_already_paid: involvesItem && data.get("item_already_paid") === "on",
          policy_confirmed: data.get("policy_confirmed") === "on",
        }),
      });
      router.push(`/tasks/${task.id}?posted=1`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return <div className="helper-request">
    <p>Availability: {availabilityLabels[offer.provider_availability || "flexible"]}</p>
    {offer.provider_availability === "unavailable" ? <p className="form-note">This helper is not taking new requests right now.</p> : <>
      <button className="button button-dark full-width" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "Close request form" : "Request this helper"}</button>
      {open && <form className="stack-form" onSubmit={submit}>
        <p className="form-note">A private request goes to this helper. They can accept or decline. The reward and timing are agreed when they accept.</p>
        <VerificationGate />
        <label>Task title<input name="title" required maxLength={140} placeholder="e.g. Move a sofa upstairs" /></label>
        <label>What do you need?<textarea name="description" required minLength={10} maxLength={5000} rows={4} /></label>
        <fieldset className="item-policy-card"><legend>Will the helper collect, carry, or deliver an item?</legend>
          <label className="choice-row"><input type="radio" checked={!involvesItem} onChange={() => setInvolvesItem(false)} /><span><strong>No</strong><small>This is a service-only request.</small></span></label>
          <label className="choice-row"><input type="radio" checked={involvesItem} onChange={() => setInvolvesItem(true)} /><span><strong>Yes</strong><small>The helper will temporarily handle an item.</small></span></label>
        </fieldset>
        {involvesItem && <div className="item-details-panel"><div className="item-details-heading"><PackageCheck size={18} /><div><strong>Item details</strong><p>Only already-paid items worth up to ₦50,000.</p></div></div><label>Item type<select name="item_type" required><option value="">Choose an item type</option>{Object.entries(itemTypeLabels).map(([value, label]) => <option key={value} value={value as ItemType}>{label}</option>)}</select></label><label>Estimated value (₦)<input name="item_value" type="number" required min="1" max="50000" step="0.01" /></label><label className="check-label"><input name="item_already_paid" type="checkbox" required />The item is already paid for.</label></div>}
        <label>City<input name="city" defaultValue={offer.city} required maxLength={120} /></label>
        <label>State<input name="state" defaultValue={offer.state} required maxLength={120} /></label>
        <label>Neighborhood<input name="neighborhood" maxLength={120} /></label>
        <label>Preferred date and time<input name="scheduled_for" type="datetime-local" /></label>
        <label>Offered reward (₦)<input name="reward_amount" type="number" min={1} step="0.01" defaultValue={offer.starting_price} required /></label>
        <label className="policy-confirmation"><input name="policy_confirmed" type="checkbox" required /><ShieldCheck size={18} /><span><strong>This request follows NEBA’s task policy.</strong><small>No cash collection, account access, prohibited goods, or high-value property.</small></span></label>
        {error && <p className="error-box" role="alert">{error}</p>}
        <button className="button button-dark full-width" disabled={busy}>{busy ? "Checking request…" : "Send private request"}</button>
      </form>}
    </>}
  </div>;
}

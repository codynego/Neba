"use client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getToken } from "@/lib/api";
import { categories, Offer } from "@/lib/types";
import { VerificationGate } from "@/components/trust";
export default function NewOfferPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!getToken()) router.replace("/login?next=/offers/new"); }, [router]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try { const offer = await api<Offer>("/offers/", { method: "POST", body: JSON.stringify(data) }); router.push(`/offers/${offer.id}`); }
    catch (error) { setError((error as Error).message); setBusy(false); }
  }
  return <main className="form-page"><div className="form-shell wide"><span className="eyebrow">SHARE WHAT YOU DO</span><h1>Put your skills <em>on the map.</em></h1><p>Make it easy for people nearby to understand how you can help.</p><VerificationGate helper /><form className="stack-form" onSubmit={submit}><label>Offer title<input name="title" required maxLength={140} placeholder="e.g. I can assemble flat-pack furniture" /></label><label>Describe your service<textarea name="description" required rows={5} placeholder="What can you do? What is included?" /></label><div className="form-row"><label>Category<select name="category" required>{categories.filter((item) => item.value).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>Starting price (₦)<input name="starting_price" type="number" min="1" step="0.01" required placeholder="5000" /></label></div><div className="form-row"><label>City<input name="city" required placeholder="e.g. Port Harcourt" /></label><label>State<input name="state" required placeholder="e.g. Rivers" /></label></div>{error && <p className="error-box">{error}</p>}<button className="button button-dark full-width" disabled={busy}>{busy ? "Publishing..." : "Publish offer ↗"}</button></form></div></main>;
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Building2, CheckCircle2, Search, ShieldCheck } from "lucide-react";
import { api, getToken } from "@/lib/api";
import type { OpportunityProfile } from "@/lib/types";

type Page<T> = { results: T[]; count?: number };
const types = [["", "Everything"], ["company", "Companies"], ["training", "Training providers"], ["school", "Schools"], ["programme", "Programmes"], ["accelerator", "Accelerators"]];

export function InsightsBrowser() {
  const [items, setItems] = useState<OpportunityProfile[]>([]);
  const [search, setSearch] = useState("");
  const [profileType, setProfileType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    setLoading(true);
    const query = new URLSearchParams();
    if (search.trim()) query.set("search", search.trim());
    if (profileType) query.set("profile_type", profileType);
    api<Page<OpportunityProfile>>(`/insight-profiles/${query.toString() ? `?${query}` : ""}`).then((data) => setItems(data.results || [])).catch(() => setError("Insights could not be loaded right now.")).finally(() => setLoading(false));
  }, [search, profileType]);
  return <main className="insights-page">
    <section className="insights-hero"><div className="insights-shell"><span className="nb-kicker"><span /> NEBA INSIGHTS</span><h1>Know what you&apos;re<br /><em>walking into.</em></h1><p>Explore the organisations, schools, programmes, and training providers behind the opportunities you are considering.</p><div className="insights-hero-note"><ShieldCheck size={17} /><span>Community knowledge is reviewed before it is published.</span></div></div></section>
    <section className="insights-shell insights-directory"><header className="insights-directory-heading"><div><span className="eyebrow">COMMUNITY KNOWLEDGE</span><h2>Browse places and programmes.</h2><p>Read practical context from people who have applied, attended, worked, or learned there.</p></div><Link href="/opportunities" className="section-link">Explore opportunities <ArrowRight size={15} /></Link></header>
      <div className="insights-controls"><label className="insights-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search companies, bootcamps, schools…" aria-label="Search insights" /></label><div className="insights-filters" aria-label="Filter profiles">{types.map(([value, label]) => <button key={value} type="button" className={profileType === value ? "active" : ""} onClick={() => setProfileType(value)}>{label}</button>)}</div></div>
      {loading ? <p className="insights-empty">Loading insights…</p> : error ? <p className="insights-empty">{error}</p> : items.length ? <div className="insights-profile-grid">{items.map((item) => <Link className="insights-profile-card" href={`/insights/${item.public_id}`} key={item.public_id}><div className="insights-profile-card-top"><span className="insights-profile-mark"><Building2 size={20} /></span><span className="insights-profile-type">{item.profile_type}</span>{item.is_verified && <CheckCircle2 size={16} aria-label="Verified profile" />}</div><h3>{item.name}</h3><p>{item.summary || "See opportunities and community insights about this profile."}</p><footer><span>{item.opportunity_count} opportunit{item.opportunity_count === 1 ? "y" : "ies"}</span><span>{item.insight_count} insight{item.insight_count === 1 ? "" : "s"}</span><ArrowRight size={15} /></footer></Link>)}</div> : <div className="insights-empty"><Building2 size={25} /><div><strong>No profiles match that search yet.</strong><p>Try another name or browse all opportunities while the directory grows.</p></div><Link href="/opportunities" className="button button-outline compact">Explore opportunities</Link></div>}
    </section>
  </main>;
}

export function InsightSubmission({ profileId, onSubmitted }: { profileId: string; onSubmitted: () => void }) {
  const [kind, setKind] = useState("review"); const [body, setBody] = useState(""); const [recommendation, setRecommendation] = useState(""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (!getToken()) { window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`; return; } setBusy(true); setMessage(""); try { await api("/community-insights/", { method: "POST", body: JSON.stringify({ profile_public_id: profileId, kind, body, recommendation }) }); setBody(""); setMessage("Thanks. Your contribution is awaiting review."); onSubmitted(); } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); } }
  return <form className="insight-submit" onSubmit={submit}><div><span className="eyebrow">ADD WHAT YOU KNOW</span><h2>Help someone make a better decision.</h2><p>Keep it factual and useful. Do not include private contact details or claims you cannot support.</p></div><div className="insight-submit-fields"><label>Contribution type<select value={kind} onChange={(event) => setKind(event.target.value)}><option value="review">Review</option><option value="tip">Tip</option><option value="application">Application experience</option><option value="warning">Warning</option></select></label><label>Would you recommend it?<select value={recommendation} onChange={(event) => setRecommendation(event.target.value)}><option value="">Choose one</option><option value="yes">Yes</option><option value="maybe">Mixed / depends</option><option value="no">No</option></select></label></div><label>What should people know?<textarea required minLength={20} maxLength={2400} rows={5} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Share what you experienced, what surprised you, or what you wish you knew earlier." /></label><div className="insight-submit-footer"><button className="button button-dark" disabled={busy}>{busy ? "Sending…" : "Send for review"}</button>{message && <span role="status">{message}</span>}</div></form>;
}

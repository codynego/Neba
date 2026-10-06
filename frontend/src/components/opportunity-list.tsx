"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Bookmark, CalendarClock, Check, ChevronDown, Filter, Search, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { Opportunity, OpportunityCategory, Page } from "@/lib/types";
import { opportunityPath } from "@/lib/routes";

const labels: Record<string, string> = { scholarship: "Scholarship", grant: "Grant", job: "Job", internship: "Internship", fellowship: "Fellowship", competition: "Competition", training: "Training", startup: "Startup program", funding: "Funding", tender: "Tenders & Procurement", remote: "Remote" };
const tabs = ["all", "job", "internship", "scholarship", "grant", "fellowship", "training", "startup", "tender", "competition", "funding", "remote"];
const deadline = (value: string | null) => value ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value)) : "No deadline listed";
const location = (item: Opportunity) => item.is_remote ? "Remote" : item.location_label || item.country || "Open location";

function OpportunityCard({ item, onSave }: { item: Opportunity; onSave: (item: Opportunity) => void }) {
  return <article className="opportunity-card">
    <div className="opportunity-card-top"><span className="opportunity-type">{labels[item.category] || item.category}</span>{item.match && <strong className="opportunity-match">{item.match.score}% match</strong>}</div>
    <h3>{item.title}</h3>
    <p className="opportunity-provider">{item.provider}</p>
    <div className="opportunity-meta"><span>{item.benefit || labels[item.category]}</span><span>{location(item)}</span></div>
    <div className="opportunity-deadline"><CalendarClock size={15} /><span><small>Deadline</small>{deadline(item.deadline)}</span></div>
    {item.match?.reasons.length ? <div className="opportunity-card-reasons"><small>Why you match</small>{item.match.reasons.slice(0, 2).map((reason) => <span key={reason}><Check size={13} />{reason}</span>)}</div> : null}
    <footer><button className={`opportunity-save${item.saved_status ? " saved" : ""}`} onClick={() => onSave(item)} aria-label={item.saved_status ? "Remove saved opportunity" : "Save opportunity"}><Bookmark size={16} fill={item.saved_status ? "currentColor" : "none"} />{item.saved_status ? "Saved" : "Save"}</button><Link className="opportunity-view" href={opportunityPath(item.title, item.public_id)}>View opportunity <ArrowRight size={15} /></Link></footer>
  </article>;
}

export function OpportunityList({ matches = false }: { matches?: boolean }) {
  const [items, setItems] = useState<Opportunity[]>([]); const [loading, setLoading] = useState(true); const [query, setQuery] = useState(""); const [activeTab, setActiveTab] = useState(matches ? "all" : "all"); const [filtersOpen, setFiltersOpen] = useState(false); const [remoteOnly, setRemoteOnly] = useState(false); const [locationQuery, setLocationQuery] = useState(""); const [deadlineFilter, setDeadlineFilter] = useState("all");
  useEffect(() => { const endpoint = matches ? "/opportunities/matches/" : "/opportunities/"; api<Page<Opportunity>>(endpoint).then((page) => setItems(page.results)).catch(() => setItems([])).finally(() => setLoading(false)); }, [matches]);
  const visible = items.filter((item) => { const haystack = `${item.title} ${item.provider} ${item.category} ${item.summary} ${item.benefit} ${item.country} ${item.location_label}`.toLowerCase(); const matchesSearch = haystack.includes(query.toLowerCase()); const matchesTab = activeTab === "all" || activeTab === "remote" ? activeTab === "all" || item.is_remote : item.category === activeTab; const matchesLocation = !locationQuery.trim() || `${item.country} ${item.location_label} ${item.is_remote ? "remote" : ""}`.toLowerCase().includes(locationQuery.trim().toLowerCase()); const days = item.deadline ? Math.ceil((new Date(item.deadline).getTime() - Date.now()) / 86400000) : null; const matchesDeadline = deadlineFilter === "all" || (days !== null && days >= 0 && days <= Number(deadlineFilter)); return matchesSearch && matchesTab && matchesLocation && matchesDeadline && (!remoteOnly || item.is_remote); });
  const recommended = visible.filter((item) => item.match).sort((a, b) => (b.match?.score || 0) - (a.match?.score || 0)).slice(0, 3);
  const remaining = visible.filter((item) => !recommended.some((match) => match.public_id === item.public_id));
  function save(item: Opportunity) { const saved = Boolean(item.saved_status); api(`/opportunities/${item.public_id}/save/`, { method: saved ? "DELETE" : "POST", body: JSON.stringify({}) }).then(() => setItems((current) => current.map((row) => row.public_id === item.public_id ? { ...row, saved_status: saved ? null : "saved" } : row))).catch(() => {}); }
  return <main className="opportunity-list-page container">
    <header className="opportunity-page-header"><span className="eyebrow">YOUR OPPORTUNITY RADAR</span><h1>{matches ? "Your best-fit opportunities" : "Find your next opportunity"}</h1><p>{matches ? "Ranked against the profile and goals you shared with GetNeba." : "Discover opportunities matched to your profile."}</p></header>
    <div className="opportunity-search-row"><div className="opportunity-list-search"><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search opportunities, organizations, skills..." aria-label="Search opportunities" /></div><button className={`opportunity-filter-button${filtersOpen ? " active" : ""}`} onClick={() => setFiltersOpen((open) => !open)}><Filter size={16} /> Filters <ChevronDown size={15} /></button></div>
    {filtersOpen && <div className="opportunity-filter-panel"><label>Location<input value={locationQuery} onChange={(event) => setLocationQuery(event.target.value)} placeholder="Any location" /></label><label>Deadline<select value={deadlineFilter} onChange={(event) => setDeadlineFilter(event.target.value)}><option value="all">Any deadline</option><option value="7">Next 7 days</option><option value="30">Next 30 days</option><option value="90">Next 90 days</option></select></label><label>Opportunity type<select value={activeTab === "all" ? "" : activeTab} onChange={(event) => setActiveTab(event.target.value || "all")}><option value="">All types</option>{tabs.slice(1, 11).map((tab) => <option key={tab} value={tab}>{labels[tab]}</option>)}</select></label><label className="opportunity-toggle"><input type="checkbox" checked={remoteOnly} onChange={(event) => setRemoteOnly(event.target.checked)} /> Remote only</label></div>}
    <nav className="opportunity-tabs" aria-label="Opportunity categories">{tabs.map((tab) => <button key={tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>{tab === "all" ? "All" : labels[tab]}</button>)}</nav>
    {loading ? <div className="dashboard-loading">Loading opportunities...</div> : visible.length ? <>{recommended.length > 0 && <section className="opportunity-recommended"><div className="opportunity-section-heading"><div><span className="eyebrow">PERSONALIZED FOR YOU</span><h2>Recommended for you</h2><p>Based on your profile, interests and eligibility.</p></div><Sparkles size={24} /></div><div className="opportunity-card-grid">{recommended.map((item) => <OpportunityCard key={item.public_id} item={item} onSave={save} />)}</div></section>}<section className="opportunity-results"><div className="opportunity-section-heading compact"><div><span className="eyebrow">EXPLORE OPPORTUNITIES</span><h2>{activeTab === "all" ? "All opportunities" : labels[activeTab]}</h2></div><span className="opportunity-result-count">{visible.length} opportunities</span></div><div className="opportunity-card-grid">{remaining.map((item) => <OpportunityCard key={item.public_id} item={item} onSave={save} />)}</div></section></> : <div className="radar-empty"><Sparkles size={26} /><div><strong>{matches ? "No matches yet" : "No opportunities found"}</strong><p>{matches ? "Complete more of your profile or check back when new opportunities are added." : "Try a different search or filter."}</p></div></div>}
  </main>;
}

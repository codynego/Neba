"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Bookmark, CalendarClock, Check, Search, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { Opportunity, Page } from "@/lib/types";

const labels: Record<string, string> = { scholarship: "Scholarship", grant: "Grant", job: "Job", internship: "Internship", fellowship: "Fellowship", competition: "Competition", training: "Training", startup: "Startup program", funding: "Business funding" };
const deadline = (value: string | null) => value ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value)) : "No deadline listed";
export function OpportunityList({ matches = false }: { matches?: boolean }) {
  const [items, setItems] = useState<Opportunity[]>([]); const [loading, setLoading] = useState(true); const [query, setQuery] = useState("");
  useEffect(() => { const endpoint = matches ? "/opportunities/matches/" : "/opportunities/"; api<Page<Opportunity>>(endpoint).then((page) => setItems(page.results)).catch(() => setItems([])).finally(() => setLoading(false)); }, [matches]);
  const visible = items.filter((item) => `${item.title} ${item.provider} ${item.category}`.toLowerCase().includes(query.toLowerCase()));
  return <main className="opportunity-list-page container"><header><span className="eyebrow">{matches ? "PERSONALIZED FOR YOU" : "OPPORTUNITY DIRECTORY"}</span><h1>{matches ? "Your best-fit opportunities" : "Explore opportunities"}</h1><p>{matches ? "Ranked against the profile and goals you shared with GetNeba." : "Search opportunities, then let your profile explain the fit."}</p></header><div className="opportunity-list-search"><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search opportunities" /></div>{loading ? <div className="dashboard-loading">Loading opportunities…</div> : visible.length ? <div className="opportunity-list-grid">{visible.map((item) => <article key={item.public_id}><div><span className="opportunity-chip">{labels[item.category]}</span>{item.match && <b>{item.match.score}% match</b>}</div><h2>{item.title}</h2><p>{item.provider} · {item.is_remote ? "Remote" : item.location_label || item.country || "Open location"}</p><small><CalendarClock size={14} />Deadline: {deadline(item.deadline)}</small>{item.match?.reasons.length ? <div className="opportunity-reasons">{item.match.reasons.slice(0, 2).map((reason) => <span key={reason}><Check size={13} />{reason}</span>)}</div> : null}<footer><Link href={`/opportunities/${item.public_id}`}>View opportunity <ArrowRight size={14} /></Link><Bookmark size={17} /></footer></article>)}</div> : <div className="radar-empty"><Sparkles size={26} /><div><strong>{matches ? "No matches yet" : "No opportunities published yet"}</strong><p>{matches ? "Complete more of your profile or check back when new opportunities are added." : "The directory will populate as opportunities are added."}</p></div></div>}</main>;
}

"use client";

import Link from "next/link";
import { ArrowRight, CalendarClock, Eye, MapPin, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Opportunity, Page } from "@/lib/types";

const labels: Record<string, string> = { job: "jobs", scholarship: "scholarships", grant: "grants", internship: "internships", fellowship: "fellowships", startup: "startup opportunities" };
const locations = (item: Opportunity) => item.is_remote ? "Remote" : item.location_label || item.country || "Open location";

export function SeoOpportunityCategory({ category, heading, description }: { category: string; heading: string; description: string }) {
  const [items, setItems] = useState<Opportunity[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => { api<Page<Opportunity>>(`/opportunities/?category=${category}`).then((data) => setItems(data.results || [])).catch(() => setItems([])).finally(() => setLoading(false)); }, [category]);
  return <main className="seo-category-page container"><header className="seo-category-header"><span className="eyebrow">AFRICA OPPORTUNITIES</span><h1>{heading}</h1><p>{description}</p><span className="seo-category-note">Verified and published opportunities on GetNeba. Details and deadlines should always be confirmed with the provider.</span></header><section className="seo-category-results"><div className="seo-category-results-heading"><div><span className="eyebrow">CURRENTLY AVAILABLE</span><h2>{loading ? "Finding opportunities…" : `${items.length} ${labels[category] || "opportunities"}`}</h2></div><Link href="/opportunities">Explore all opportunities <ArrowRight size={15} /></Link></div>{items.length ? <div className="seo-opportunity-list">{items.map((item) => <article className="seo-opportunity-card" key={item.public_id}><div><span className="opportunity-type">{item.category}</span><h3>{item.title}</h3><p>{item.provider} · {locations(item)}</p><div className="seo-opportunity-meta">{item.deadline && <span><CalendarClock size={13} /> Closes {new Date(item.deadline).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" })}</span>}<span><Eye size={13} /> {item.view_count || 0} views</span><span><UsersRound size={13} /> {item.application_count || 0} applied</span></div></div><Link className="button button-outline compact" href={`/opportunities/${item.public_id}`}>View details <ArrowRight size={14} /></Link></article>)}</div> : !loading && <div className="seo-category-empty"><MapPin size={20} /><div><strong>No published opportunities in this category yet.</strong><p>New verified opportunities will appear here as they are approved.</p></div></div>}</section><section className="seo-category-cta"><div><span className="eyebrow">PERSONALIZED DISCOVERY</span><h2>Want to know which opportunities fit you?</h2><p>Create a free profile to see your match score, deadlines, preparation steps, and application tracker.</p></div><Link className="button button-dark" href="/register">Build my radar <ArrowRight size={16} /></Link></section></main>;
}

import Link from "next/link";
import { ArrowRight, CalendarClock, Eye, MapPin, UsersRound } from "lucide-react";
import { opportunityPath } from "@/lib/routes";
import { Opportunity } from "@/lib/types";
import { VerificationBadge } from "./verification-badge";

const labels: Record<string, string> = { job: "jobs", scholarship: "scholarships", grant: "grants", internship: "internships", fellowship: "fellowships", startup: "startup opportunities" };
const locations = (item: Opportunity) => item.is_remote ? "Remote" : item.location_label || item.country || "Open location";

async function getCategoryOpportunities(category: string): Promise<Opportunity[]> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
  try {
    const response = await fetch(`${apiBase}/opportunities/?category=${encodeURIComponent(category)}&page_size=100`, { next: { revalidate: 900 } });
    if (!response.ok) return [];
    const data = await response.json() as { results?: Opportunity[] };
    return data.results || [];
  } catch { return []; }
}

export async function SeoOpportunityCategory({ category, heading, description }: { category: string; heading: string; description: string }) {
  const items = await getCategoryOpportunities(category);
  return <main className="seo-category-page container"><header className="seo-category-header"><span className="eyebrow">AFRICA OPPORTUNITIES</span><h1>{heading}</h1><p>{description}</p><span className="seo-category-note">Verified and published opportunities on GetNeba. Details and deadlines should always be confirmed with the provider.</span></header><section className="seo-category-results"><div className="seo-category-results-heading"><div><span className="eyebrow">CURRENTLY AVAILABLE</span><h2>{items.length} {labels[category] || "opportunities"}</h2></div><Link href="/opportunities">Explore all opportunities <ArrowRight size={15} /></Link></div>{items.length ? <div className="seo-opportunity-list">{items.map((item) => <article className="seo-opportunity-card" key={item.public_id}><div><span className="opportunity-type">{item.category}</span><h2>{item.title}</h2><p>{item.provider} · {locations(item)} <VerificationBadge verification={item.verification} /></p><div className="seo-opportunity-meta">{item.deadline && <span><CalendarClock size={13} /> Closes {new Date(item.deadline).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" })}</span>}<span><Eye size={13} /> {item.view_count || 0} views</span><span><UsersRound size={13} /> {item.application_count || 0} applied</span></div></div><Link className="button button-outline compact" href={opportunityPath(item.title, item.public_id)}>View details <ArrowRight size={14} /></Link></article>)}</div> : <div className="seo-category-empty"><MapPin size={20} /><div><strong>No published opportunities in this category yet.</strong><p>New verified opportunities will appear here as they are approved.</p></div></div>}</section><section className="seo-category-cta"><div><span className="eyebrow">PERSONALIZED DISCOVERY</span><h2>Want to know which opportunities fit you?</h2><p>Create a free profile to see your match score, deadlines, preparation steps, and application tracker.</p></div><Link className="button button-dark" href="/register">Build my radar <ArrowRight size={16} /></Link></section></main>;
}

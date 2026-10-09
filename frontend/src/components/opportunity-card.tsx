import Link from "next/link";
import { ArrowUpRight, Bookmark, CalendarClock, MapPin } from "lucide-react";
import type { Opportunity } from "@/lib/types";
import { opportunityPath } from "@/lib/routes";
import { VerificationBadge } from "./verification-badge";

export const opportunityLabels: Record<string, string> = { scholarship: "Scholarship", grant: "Grant", job: "Job", internship: "Internship", fellowship: "Fellowship", competition: "Competition", training: "Training", startup: "Startup", funding: "Funding", tender: "Tender" };

export function OpportunityCard({ item, onSave, saving = false }: { item: Opportunity; onSave?: (item: Opportunity) => void; saving?: boolean }) {
  const href = opportunityPath(item.title, item.public_id);
  const initials = item.provider.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
  const location = item.is_remote ? "Remote" : item.location_label || item.country || "See location details";
  const date = item.deadline ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }).format(new Date(item.deadline)) : "No deadline listed";
  return <article className={`nb-op-card nb-op-${item.category}`}>
    <div className="nb-op-top"><span className="nb-provider-mark" aria-hidden="true">{initials || "N"}</span><div><span className="nb-op-provider">{item.provider}</span><VerificationBadge verification={item.verification} /></div><span className="nb-op-type">{opportunityLabels[item.category] || item.category}</span></div>
    <h3><Link href={href}>{item.title}</Link></h3><span className="nb-op-location"><MapPin size={14} />{location}</span><p className="nb-op-summary">{item.summary}</p>{item.benefit && <div className="nb-op-benefit">{item.benefit}</div>}<div className="nb-op-deadline"><CalendarClock size={14} /><span>{item.deadline ? `Deadline · ${date}` : date}</span></div>
    <footer><Link href={href} className="nb-op-open">View opportunity <ArrowUpRight size={17} /></Link>{onSave ? <button type="button" onClick={() => onSave(item)} disabled={saving} aria-label={item.saved_status ? `Unsave ${item.title}` : `Save ${item.title}`} aria-pressed={Boolean(item.saved_status)} className={`nb-save${item.saved_status ? " is-saved" : ""}`}><Bookmark size={18} fill={item.saved_status ? "currentColor" : "none"} /></button> : <Link href={`/login?next=${encodeURIComponent(href)}`} className="nb-save" aria-label={`Sign in to save ${item.title}`}><Bookmark size={18} /></Link>}</footer>
  </article>;
}

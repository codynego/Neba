"use client";

import Link from "next/link";
import { ArrowRight, FileCheck2, Lightbulb, Mic2, Sparkles, Target } from "lucide-react";

const practiceModes = [
  { icon: Mic2, title: "AI interview practice", copy: "Practice behavioral, HR, technical, and role-specific questions.", href: "/assistant/interview", active: true },
  { icon: Lightbulb, title: "AI pitch practice", copy: "Test your startup or idea against investor-style questions." },
  { icon: FileCheck2, title: "Application review", copy: "Review your CV, statement, or application against an opportunity." },
  { icon: Target, title: "Skill gap analysis", copy: "Find what is holding you back and get a practical improvement plan." },
];

export default function AssistantPage() {
  return <main className="practice-page container"><header className="practice-header"><div><span className="eyebrow"><Sparkles size={13} /> OPPORTUNITY PRACTICE</span><h1>Prepare for the opportunity,<br /><em>not just the application.</em></h1><p>Getneba practice tools help you prepare, get feedback, and show up with more confidence.</p></div><span className="practice-coming-badge">STARTING WITH INTERVIEWS</span></header><section className="practice-intro"><span className="practice-intro-icon"><Sparkles size={22} /></span><div><strong>Practice should feel like the real moment.</strong><p>Start with an interview room that follows the opportunity you are preparing for.</p></div><Link className="button button-dark compact" href="/assistant/interview">Start interview <ArrowRight size={15} /></Link></section><section className="practice-grid" aria-label="Practice tools">{practiceModes.map(({ icon: Icon, title, copy, href, active }) => active ? <Link className="practice-card practice-card-active" href={href || "/assistant"} key={title}><span className="practice-card-icon"><Icon size={21} /></span><span className="practice-card-status">AVAILABLE NOW</span><h2>{title}</h2><p>{copy}</p><span className="section-link">Start practicing <ArrowRight size={15} /></span></Link> : <article className="practice-card" key={title}><span className="practice-card-icon"><Icon size={21} /></span><span className="practice-card-status">COMING SOON</span><h2>{title}</h2><p>{copy}</p></article>)}</section><div className="practice-next-step"><span className="eyebrow">MAKE IT SPECIFIC</span><strong>Find an opportunity worth preparing for.</strong><Link className="section-link" href="/matches">Open my matches <ArrowRight size={16} /></Link></div></main>;
}

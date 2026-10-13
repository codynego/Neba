import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, CircleHelp, GraduationCap, School, Sparkles, UsersRound } from "lucide-react";
import { publicPageMetadata } from "@/lib/seo";

export const metadata = publicPageMetadata("Pricing for schools", "Start with a free school workspace, run a one-term pilot with real assessment results, then scale Neba across your academic team.", "/schools/pricing");

const plans = [
  {
    name: "Free forever", eyebrow: "EXPLORE", price: "₦0", detail: "For schools exploring Neba.", action: "Get started for free", href: "/schools/get-started", icon: GraduationCap,
    features: ["Create a school workspace", "One school administrator", "Sample student and assessment data", "Guided product walkthrough", "Preview academic insights and learning-gap analysis", "Explore the dashboard and teaching assistant"],
  },
  {
    name: "Pilot", eyebrow: "ONE ACADEMIC TERM", price: "₦10,000", suffix: "/ term", detail: "For schools testing Neba with real student results.", action: "Start a pilot", href: "/schools/get-started", icon: Sparkles, featured: true,
    features: ["Up to 2 classes", "Up to 100 students", "Up to 5 staff accounts", "Import assessment results", "Identify learning gaps", "Generate targeted revision exercises and teaching resources", "Basic academic reports", "Guided self-service setup"],
  },
  {
    name: "School", eyebrow: "SCHOOL-WIDE", price: "₦100", suffix: "/ active student / term", detail: "₦25,000 minimum per term. For schools ready to use Neba across their academic operations.", action: "Get started", href: "/schools/get-started", icon: School,
    features: ["All classes and eligible active students", "Staff accounts for teachers and school leaders", "Assessment and results management", "School-wide academic intelligence", "Class, subject, and student performance analysis", "AI-assisted quizzes and revision resources", "Academic reports and comparisons", "Role-based access and teacher assignments", "Standard support"],
  },
  {
    name: "Multi-campus", eyebrow: "SCHOOL GROUPS", price: "Custom", detail: "For school groups managing multiple campuses.", action: "Talk to us", href: "mailto:support@getneba.com?subject=Neba%20multi-campus%20pricing", icon: UsersRound,
    features: ["Multiple school workspaces under one organisation", "Consolidated academic reporting", "Campus-level and group-level oversight", "Central administration with campus-specific permissions", "Onboarding and migration assistance", "Custom implementation and support"],
  },
];

export default function SchoolsPricingPage() {
  return <main className="schools-pricing-page">
    <section className="schools-pricing-hero"><div className="schools-pricing-shell"><Link className="schools-pricing-back" href="/schools"><ArrowRight size={15} /> Neba for Schools</Link><span>PRICING FOR ACADEMIC INTELLIGENCE</span><h1>Start with one useful<br /><em>academic insight.</em></h1><p>Create your school workspace for free. Move to a real-data pilot when your academic team is ready to act on what it finds.</p><div className="schools-pricing-hero-promise"><Check size={16} /><span>No card required to explore. Schools pay per term, when they are ready to use their own assessment data.</span></div></div></section>

    <section className="schools-pricing-plans schools-pricing-shell" aria-label="Neba for Schools pricing plans"><div className="schools-pricing-section-heading"><span>CHOOSE YOUR STARTING POINT</span><h2>Begin small.<br />Grow with evidence.</h2><p>Every plan is designed around the same academic loop: understand the result, choose a response, and measure what changed.</p></div><div className="schools-pricing-grid">{plans.map(({ name, eyebrow, price, suffix, detail, action, href, icon: Icon, features, featured }) => <article key={name} className={`schools-pricing-card${featured ? " featured" : ""}`}><header><span>{featured ? "MOST PRACTICAL FIRST STEP" : eyebrow}</span><Icon size={22} /><h2>{name}</h2><div className="schools-pricing-price"><strong>{price}</strong>{suffix && <small>{suffix}</small>}</div><p>{detail}</p></header><ul>{features.map((feature) => <li key={feature}><Check size={15} />{feature}</li>)}</ul>{href.startsWith("mailto:") ? <a className="schools-pricing-action secondary" href={href}>{action}<ArrowUpRight size={16} /></a> : <Link className={`schools-pricing-action${featured ? " primary" : " secondary"}`} href={href}>{action}<ArrowRight size={16} /></Link>}</article>)}</div></section>

    <section className="schools-pricing-note"><div className="schools-pricing-shell"><div><span>THE SIMPLE RULE</span><h2>Free is for exploring.<br />Pilot is for your own results.</h2></div><p>Use the free workspace and clearly marked sample data to understand the workflow before you involve real student information. When you are ready to test it with your own class results, choose a one-term Pilot.</p></div></section>

    <section className="schools-pricing-faq schools-pricing-shell"><div><span>PLAIN ANSWERS</span><h2>Before your school starts.</h2></div><div>{[["Can we use Free indefinitely?", "Yes. Free is for learning the product with sample data. It does not include using Neba with your school’s real student assessment data."], ["When do we need Pilot?", "Choose Pilot when you are ready to import real assessment results and run the first academic-intelligence workflow with your school."], ["How does School pricing work?", "School is billed per active student, per academic term, with a ₦25,000 minimum for the term."], ["Can we talk to someone first?", "Yes. Schools that want help choosing a plan, migrating data, or rolling out across multiple campuses can request a tailored walkthrough."]].map(([question, answer]) => <article key={question}><CircleHelp size={18} /><div><h3>{question}</h3><p>{answer}</p></div></article>)}</div></section>

    <section className="schools-pricing-final"><div className="schools-pricing-shell"><div><span>READY WHEN YOU ARE</span><h2>Give your next assessment<br />a clearer purpose.</h2></div><div><p>Create a workspace in minutes. Start with a class, then let the evidence determine what your school needs next.</p><Link href="/schools/get-started" className="schools-pricing-action lime">Get started for your school <ArrowRight size={17} /></Link><a href="mailto:support@getneba.com?subject=Neba%20for%20Schools%20demo">Need a walkthrough? Book a demo.</a></div></div></section>
  </main>;
}


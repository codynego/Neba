"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, BarChart3, BookOpen, BrainCircuit, ClipboardCheck, Home, LayoutGrid } from "lucide-react";

const links = [
  { href: "/learn/dashboard", label: "Home", icon: Home },
  { href: "/learn/study", label: "Study", icon: BookOpen },
  { href: "/learn/exam-prep", label: "Exam Prep", icon: ClipboardCheck },
  { href: "/learn/tutor", label: "AI Tutor", icon: BrainCircuit },
  { href: "/learn/performance", label: "My Performance", icon: BarChart3 },
];

export function LearnNav() {
  const path = usePathname();
  const navigation = <nav aria-label="Neba Learn navigation">{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={path === href || (href === "/learn/exam-prep" && path.startsWith("/learn/exam-prep/")) ? "active" : ""} aria-current={path === href ? "page" : undefined}><Icon size={18} /><span>{label}</span></Link>)}</nav>;
  return <><aside className="learn-sidebar"><Link href="/learn/dashboard" className="learn-sidebar-brand"><span>n</span><strong>Neba Learn</strong></Link><p>STUDENT LEARNING WORKSPACE</p>{navigation}<div className="learn-sidebar-bottom"><Link href="/workspace"><LayoutGrid size={16} /> All Neba products</Link><Link href="/learn"><ArrowUpRight size={16} /> About Neba Learn</Link></div></aside><nav className="learn-mobile-nav" aria-label="Neba Learn mobile navigation">{links.slice(0, 4).map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={path === href || (href === "/learn/exam-prep" && path.startsWith("/learn/exam-prep/")) ? "active" : ""}><Icon size={19} /><span>{label === "Exam Prep" ? "Prep" : label.replace("AI ", "")}</span></Link>)}<Link href="/learn/performance" className={path === "/learn/performance" ? "active" : ""}><BarChart3 size={19} /><span>Scores</span></Link></nav></>;
}

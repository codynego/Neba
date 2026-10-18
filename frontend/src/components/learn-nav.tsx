"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, BrainCircuit, ClipboardCheck, Home, LayoutGrid } from "lucide-react";

const links = [
  { href: "/learn/dashboard", label: "Home", icon: Home },
  { href: "/learn/study", label: "Study", icon: BookOpen },
  { href: "/learn/exam-prep", label: "Exam Prep", icon: ClipboardCheck },
  { href: "/learn/tutor", label: "AI Tutor", icon: BrainCircuit },
  { href: "/learn/performance", label: "My Performance", icon: BarChart3 },
];

export function LearnNav() {
  const path = usePathname();
  return <header className="ld-topbar"><Link href="/learn/dashboard" className="ld-brand"><span>n</span><strong>Neba Learn</strong></Link><nav className="ld-nav" aria-label="Neba Learn navigation">{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={path === href ? "active" : ""} aria-current={path === href ? "page" : undefined}><Icon size={15} /><span>{label}</span></Link>)}</nav><Link className="ld-products" href="/workspace" aria-label="All Neba products"><LayoutGrid size={16} /></Link></header>;
}

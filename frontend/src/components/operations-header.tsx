"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Building2, ClipboardList, DollarSign, FileCheck2, FileText, Flag, Gauge, History, UsersRound } from "lucide-react";
import { Brand } from "./brand";

const links = [
  { href: "/operations", label: "Overview", icon: Gauge },
  { href: "/operations/users", label: "Users & trust", icon: UsersRound },
  { href: "/operations/organizations", label: "Organizations", icon: Building2 },
  { href: "/operations/opportunities", label: "Opportunities", icon: FileCheck2 },
  { href: "/operations/applications", label: "Applications", icon: ClipboardList },
  { href: "/operations/revenue", label: "Revenue", icon: DollarSign },
  { href: "/operations/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/operations/safety", label: "Safety & reports", icon: Flag },
  { href: "/operations/audit", label: "Audit log", icon: History },
];

export function OperationsHeader() {
  const path = usePathname();
  const active = (href: string) => href === "/operations" ? path === href : path.startsWith(href);
  return <><header className="site-header organization-header operations-header"><div className="nav-wrap"><Brand /><span className="organization-header-label">Operations</span><div className="header-account"><Link className="account-link" href="/profile">Exit operations</Link></div></div></header><aside className="sidebar organization-sidebar operations-sidebar"><Brand /><span className="organization-sidebar-label">Operations center</span><nav aria-label="Operations navigation">{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={active(href) ? "side-link active" : "side-link"} aria-current={active(href) ? "page" : undefined}><Icon size={19} /><span>{label}</span></Link>)}</nav><div className="sidebar-divider" /><Link className="side-link" href="/admin/" target="_blank"><FileText size={19} /><span>Django admin</span></Link></aside><nav className="bottom-nav organization-bottom-nav operations-bottom-nav" aria-label="Operations mobile navigation">{links.slice(0, 5).map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={active(href) ? "active" : ""}><Icon size={20} /><span>{label}</span></Link>)}</nav></>;
}

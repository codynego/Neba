"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowUpRight, BarChart3, Bell, Bookmark, Building2, Compass, FileText, House, ListChecks, MessageCircle, MoreHorizontal, Search, Settings, Sparkles, UserRound, UsersRound } from "lucide-react";
import { Brand } from "./brand";
import { api, clearToken, getToken } from "@/lib/api";
import { NotificationBell } from "./notification-bell";
import { isOpportunityPath, isPublicPath } from "@/lib/routes";
import { OperationsHeader } from "./operations-header";

const primaryLinks = [
  { href: "/dashboard", label: "Overview", icon: House },
  { href: "/opportunities", label: "Opportunities", icon: Compass },
  { href: "/saved", label: "Saved", icon: Bookmark },
  { href: "/applications", label: "Applications", icon: ListChecks },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/assistant", label: "Practice", icon: MessageCircle },
];
const secondaryLinks = [
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/settings", label: "Settings", icon: Settings },
];
const organizationLinks = [
  { href: "/organization/dashboard", label: "Overview", icon: House },
  { href: "/organization/opportunities", label: "My opportunities", icon: FileText },
  { href: "/organization/applicants", label: "Applicants", icon: UsersRound },
  { href: "/organization/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/organization/assistant", label: "AI Assistant", icon: Sparkles },
];
export function Header() {
  const path = usePathname();
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  const [search, setSearch] = useState("");
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [unread, setUnread] = useState({ activity_count: 0, message_count: 0 });
  useEffect(() => {
    const sync = () => setSignedIn(Boolean(getToken()));
    sync();
    window.addEventListener("nearwork_auth", sync);
    return () => window.removeEventListener("nearwork_auth", sync);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => {
      if (!getToken()) { setUnread({ activity_count: 0, message_count: 0 }); return; }
      if (!document.hidden) api<{ activity_count: number; message_count: number }>("/notifications/unread/", { signal: controller.signal }).then(setUnread).catch(() => {});
    };
    refresh();
    const timer = setInterval(refresh, 20000);
    window.addEventListener("neba_notifications", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener("neba_notifications", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  const active = (href: string) => href === "/" ? path === "/" : href === "/tasks" ? path === "/tasks" || path.startsWith("/offers") || (path.startsWith("/tasks/") && path !== "/tasks/new") : path.startsWith(href);
  function submit(event: FormEvent) {
    event.preventDefault();
    router.push(`/tasks?search=${encodeURIComponent(search.trim())}`);
  }
  if (path.startsWith("/operations")) return <OperationsHeader />;
  if (path.startsWith("/organization")) return <><header className="site-header organization-header"><div className="nav-wrap"><Brand /><span className="organization-header-label">Organization</span><div className="header-account"><Link className="account-link" href="/settings"><Settings size={18} /> Settings</Link></div></div></header><aside className="sidebar organization-sidebar"><Brand /><span className="organization-sidebar-label">Organization</span><nav aria-label="Organization navigation">{organizationLinks.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={active(href) ? "side-link active" : "side-link"} aria-current={active(href) ? "page" : undefined}><Icon size={20} /><span>{label}</span></Link>)}</nav><div className="sidebar-divider" /><nav aria-label="Organization account navigation"><Link className={active("/organization/onboarding") ? "side-link active" : "side-link"} href="/organization/onboarding"><Building2 size={20} /><span>Organization</span></Link><Link className={active("/settings") ? "side-link active" : "side-link"} href="/settings"><Settings size={20} /><span>Settings</span></Link></nav></aside><nav className="bottom-nav organization-bottom-nav" aria-label="Organization mobile navigation">{organizationLinks.slice(0, 4).map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={active(href) ? "active" : ""}><Icon size={21} /><span>{label}</span></Link>)}</nav></>;
  if (isPublicPath(path) && !(signedIn && isOpportunityPath(path))) return <header className="site-header public-header"><div className="landing-container public-nav"><Brand /><nav className="public-links" aria-label="Website navigation"><Link href="/#opportunities">Explore opportunities</Link><Link href="/#how-it-works">How it works</Link><Link href="/assistant">Practice</Link><Link href="/about">Why GetNeba</Link><Link href="/help">Help center</Link></nav><div className="header-account">{signedIn ? <Link className="button button-dark compact" href="/dashboard">Open my radar <ArrowUpRight size={16} /></Link> : <><Link className="login-link" href="/login">Log in</Link><Link className="button button-dark compact" href="/register">Get started <ArrowUpRight size={16} /></Link></>}</div></div></header>;
  return <>
    <header className="site-header"><div className="nav-wrap"><Brand /><form className="header-search" onSubmit={(event) => { event.preventDefault(); router.push(`/opportunities?search=${encodeURIComponent(search.trim())}`); }}><Search size={18} /><input aria-label="Search opportunities" placeholder="Search opportunities…" value={search} onChange={(event) => setSearch(event.target.value)} /><button type="submit" aria-label="Search"><ArrowUpRight size={18} /></button></form><div className="header-account">{signedIn && <NotificationBell />}{signedIn ? <Link className="account-link" href="/profile"><UserRound size={19} /> My profile</Link> : <><Link className="login-link" href="/login">Log in</Link><Link className="button button-dark compact" href="/register">Join GetNeba <ArrowUpRight size={16} /></Link></>}</div></div></header>
    <aside className="sidebar"><Brand /><nav aria-label="Main navigation">{primaryLinks.map(({ href, label, icon: Icon }) => { const count = href === "/alerts" ? unread.activity_count : 0; return <Link key={href} href={href} className={active(href) ? "side-link active" : "side-link"} aria-current={active(href) ? "page" : undefined}><Icon size={20} /><span>{label}</span>{count > 0 && <b className="nav-count">{count > 99 ? "99+" : count}</b>}</Link>; })}</nav><div className="sidebar-divider" /><nav aria-label="Account navigation">{secondaryLinks.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={active(href) ? "side-link active" : "side-link"} aria-current={active(href) ? "page" : undefined}><Icon size={20} /><span>{label}</span></Link>)}</nav><div className="sidebar-pro"><strong>Getneba Pro</strong><p>Unlock more matches &amp; intelligence</p><Link href="/profile">Upgrade <ArrowUpRight size={15} /></Link></div></aside>
    <nav className="bottom-nav" aria-label="Mobile navigation">{[primaryLinks[0], primaryLinks[1], primaryLinks[2], primaryLinks[4]].map(({ href, label, icon: Icon }) => { const count = href === "/alerts" ? unread.activity_count : 0; return <Link key={href} href={href} className={active(href) ? "active" : ""} aria-current={active(href) ? "page" : undefined}><Icon size={21} /><span>{label}</span>{count > 0 && <b className="nav-count">{count > 99 ? "99+" : count}</b>}</Link>; })}<button type="button" className={`mobile-more-toggle${mobileMoreOpen ? " active" : ""}`} onClick={() => setMobileMoreOpen((open) => !open)} aria-expanded={mobileMoreOpen} aria-controls="mobile-more-menu"><MoreHorizontal size={21} /><span>More</span></button></nav>
    {mobileMoreOpen && <div className="mobile-more-menu" id="mobile-more-menu"><div className="mobile-more-menu-inner">{[primaryLinks[2], primaryLinks[3], primaryLinks[5], secondaryLinks[0], secondaryLinks[1]].map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={active(href) ? "active" : ""} onClick={() => setMobileMoreOpen(false)}><Icon size={18} /><span>{label}</span><ArrowUpRight size={14} /></Link>)}</div></div>}
  </>;
}

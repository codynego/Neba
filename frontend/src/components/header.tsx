"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUpRight, BarChart3, Bell, Bookmark, Building2, Compass, FileText, House, Link2, ListChecks, Menu, MessageCircle, Plus, Search, Settings, UserRound, UsersRound, X } from "lucide-react";
import { Brand } from "./brand";
import { api, getToken } from "@/lib/api";
import { NotificationBell } from "./notification-bell";
import { isOpportunityPath, isPublicPath } from "@/lib/routes";
import { OperationsHeader } from "./operations-header";

const memberLinks = [{ href: "/dashboard", label: "Home", icon: House }, { href: "/opportunities", label: "Explore", icon: Compass }, { href: "/saved", label: "Saved", icon: Bookmark }, { href: "/applications", label: "My progress", icon: ListChecks }, { href: "/my-opportunities", label: "My contributions", icon: Link2 }, { href: "/assistant", label: "Practice", icon: MessageCircle }];
const orgLinks = [{ href: "/organization/dashboard", label: "Overview", icon: House }, { href: "/organization/opportunities", label: "Opportunities", icon: FileText }, { href: "/organization/applicants", label: "Applicants", icon: UsersRound }, { href: "/organization/analytics", label: "Analytics", icon: BarChart3 }, { href: "/organization/onboarding", label: "Organisation", icon: Building2 }];
const publicLinks = [{ href: "/opportunities", label: "Find opportunities" }, { href: "/#how-it-works", label: "How it works" }, { href: "/my-opportunities/new", label: "Share a find" }, { href: "/about", label: "Our story" }];

export function Header() {
  const path = usePathname(); const router = useRouter();
  const [signedIn, setSignedIn] = useState(false); const [search, setSearch] = useState(""); const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState({ activity_count: 0, application_count: 0 });
  useEffect(() => { const sync = () => setSignedIn(Boolean(getToken())); sync(); window.addEventListener("nearwork_auth", sync); return () => window.removeEventListener("nearwork_auth", sync); }, []);
  useEffect(() => { setMenuOpen(false); }, [path]);
  useEffect(() => { if (!menuOpen) return; const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [menuOpen]);
  useEffect(() => {
    if (!signedIn) return;
    const controller = new AbortController();
    const refresh = () => { if (document.hidden) return; Promise.all([api<{ activity_count: number }>("/notifications/unread/", { signal: controller.signal }), api<{ count: number }>("/opportunity-applications/unread/", { signal: controller.signal })]).then(([notifications, applications]) => setUnread({ activity_count: notifications.activity_count, application_count: applications.count })).catch(() => {}); };
    refresh(); const timer = setInterval(refresh, 30000); window.addEventListener("neba_notifications", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener("neba_notifications", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [signedIn]);
  const active = (href: string) => path === href || path.startsWith(`${href}/`);
  if (path.startsWith("/operations")) return <OperationsHeader />;
  const publicPage = isPublicPath(path) && !(signedIn && isOpportunityPath(path));
  if (publicPage) return <header className="site-header public-header nb-public-header"><div className="nb-wrap public-nav"><Brand /><nav className="public-links" aria-label="Website navigation">{publicLinks.map((link) => <Link key={link.href} href={link.href} aria-current={path === link.href ? "page" : undefined}>{link.label}</Link>)}</nav><div className="header-account">{signedIn ? <Link className="nb-button nb-button-green" href="/dashboard">My home <ArrowUpRight size={17} /></Link> : <><Link className="login-link" href="/login">Log in</Link><Link className="nb-button nb-button-green" href="/register">Join GetNeba <ArrowUpRight size={17} /></Link></>}<button className="nb-menu-button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="public-mobile-menu" onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button></div></div>{menuOpen && <nav id="public-mobile-menu" className="nb-public-mobile" aria-label="Mobile website navigation">{publicLinks.map((link) => <Link href={link.href} key={link.href} onClick={() => setMenuOpen(false)}>{link.label}<ArrowUpRight size={17} /></Link>)}<Link href="/login">Log in <UserRound size={17} /></Link></nav>}</header>;
  const organization = path.startsWith("/organization"); const links = organization ? orgLinks : memberLinks;
  const mobileLinks = organization ? orgLinks.slice(0, 4) : [memberLinks[0], memberLinks[1], { href: "/my-opportunities/new", label: "Share", icon: Plus }, memberLinks[3], { href: "/profile", label: "Profile", icon: UserRound }];
  return <><header className="site-header nb-workspace-header"><div className="nav-wrap"><Brand /><form className="header-search" onSubmit={(event) => { event.preventDefault(); router.push(`/opportunities?search=${encodeURIComponent(search.trim())}`); }}><Search size={18} /><input aria-label="Search opportunities" placeholder="What’s your next move?" value={search} onChange={(event) => setSearch(event.target.value)} /><button type="submit" aria-label="Search"><ArrowUpRight size={18} /></button></form><div className="header-account">{signedIn && <NotificationBell />}<Link className="nb-profile-link" href="/profile" aria-label="My profile"><UserRound size={20} /></Link></div></div></header>
    <aside className="sidebar nb-sidebar"><Brand /><span className="nb-nav-label">{organization ? "YOUR ORGANISATION" : "YOUR NEXT CHAPTER"}</span><nav aria-label={organization ? "Organisation navigation" : "Main navigation"}>{links.map(({ href, label, icon: Icon }) => <Link href={href} key={href} className={`side-link${active(href) ? " active" : ""}`} aria-current={active(href) ? "page" : undefined}><Icon size={19} /><span>{label}</span>{href === "/applications" && unread.application_count > 0 && <b className="nav-count">{Math.min(unread.application_count, 99)}</b>}</Link>)}</nav><Link href={organization ? "/organization/opportunities/new" : "/my-opportunities/new"} className="nb-button nb-button-green nb-sidebar-share"><Plus size={18} />{organization ? "Post opportunity" : "Share a good find"}</Link><div className="nb-sidebar-bottom"><nav aria-label="Account navigation"><Link href="/alerts" className={`side-link${active("/alerts") ? " active" : ""}`}><Bell size={19} /><span>Notifications</span>{unread.activity_count > 0 && <b className="nav-count">{Math.min(unread.activity_count, 99)}</b>}</Link><Link href="/profile" className={`side-link${active("/profile") ? " active" : ""}`}><UserRound size={19} /><span>My profile</span></Link><Link href="/settings" className={`side-link${active("/settings") ? " active" : ""}`}><Settings size={19} /><span>Settings</span></Link></nav><span className="nb-sidebar-note">Good finds. Passed on.</span></div></aside>
    <nav className="bottom-nav nb-bottom-nav" aria-label="Mobile navigation">{mobileLinks.map(({ href, label, icon: Icon }) => <Link href={href} key={href} className={`${active(href) ? "active " : ""}${label === "Share" ? "nb-mobile-share" : ""}`} aria-current={active(href) ? "page" : undefined}><Icon size={21} /><span>{label}</span></Link>)}</nav></>;
}

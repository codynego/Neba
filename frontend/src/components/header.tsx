"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowUpRight, House, Compass, ListChecks, UserRound, Plus, Search, LogOut, HandHeart, MessageCircle } from "lucide-react";
import { Brand } from "./brand";
import { clearToken, getToken } from "@/lib/api";
import { NotificationBell } from "./notification-bell";
import { isPublicPath } from "@/lib/routes";

const links = [
  { href: "/dashboard", label: "Home", icon: House },
  { href: "/tasks", label: "Nearby", icon: Compass },
  { href: "/activity", label: "Activity", icon: ListChecks },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/profile", label: "Profile", icon: UserRound },
];
export function Header() {
  const path = usePathname();
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  const [search, setSearch] = useState("");
  useEffect(() => {
    const sync = () => setSignedIn(Boolean(getToken()));
    sync();
    window.addEventListener("nearwork_auth", sync);
    return () => window.removeEventListener("nearwork_auth", sync);
  }, []);
  const active = (href: string) => href === "/" ? path === "/" : href === "/tasks" ? path === "/tasks" || path.startsWith("/offers") || (path.startsWith("/tasks/") && path !== "/tasks/new") : path.startsWith(href);
  function submit(event: FormEvent) {
    event.preventDefault();
    router.push(`/tasks?search=${encodeURIComponent(search.trim())}`);
  }
  if (isPublicPath(path)) return <header className="site-header public-header"><div className="landing-container public-nav"><Brand /><nav className="public-links" aria-label="Website navigation"><Link href="/tasks">Explore nearby</Link><Link href="/stories">Stories</Link><Link href="/#how-it-works">How it works</Link><Link href="/offers/new">Become a helper</Link></nav><div className="header-account">{signedIn && <NotificationBell />}{signedIn ? <Link className="button button-dark compact" href="/dashboard">Open GetNeba <ArrowUpRight size={16} /></Link> : <><Link className="login-link" href="/login">Log in</Link><Link className="button button-dark compact" href="/register">Get started <ArrowUpRight size={16} /></Link></>}</div></div></header>;
  return <>
    <header className="site-header"><div className="nav-wrap"><Brand /><form className="header-search" onSubmit={submit}><Search size={18} /><input aria-label="Search tasks" placeholder="Find something nearby…" value={search} onChange={(event) => setSearch(event.target.value)} /><button type="submit" aria-label="Search"><ArrowUpRight size={18} /></button></form><div className="header-account">{signedIn && <NotificationBell />}{signedIn ? <Link className="account-link" href="/profile"><UserRound size={19} /> My account</Link> : <><Link className="login-link" href="/login">Log in</Link><Link className="button button-dark compact" href="/register">Join GetNeba <ArrowUpRight size={16} /></Link></>}</div></div></header>
    <aside className="sidebar"><span className="nav-caption">YOUR NEIGHBORHOOD</span><nav aria-label="Main navigation">{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={active(href) ? "side-link active" : "side-link"} aria-current={active(href) ? "page" : undefined}><Icon size={20} />{label}</Link>)}</nav><Link className="button button-dark sidebar-post" href="/tasks/new"><Plus size={19} /> Post a task</Link><div className="sidebar-bottom"><div className="community-note"><HandHeart size={24} /><strong>A little help.<br />A better neighborhood.</strong><p>Your skills could make someone’s day.</p><Link href="/offers/new">Offer your skills <ArrowUpRight size={15} /></Link></div>{signedIn && <button className="logout-button" onClick={() => { clearToken(); router.push("/"); }}><LogOut size={17} /> Log out</button>}<small>Good people. Close by.</small></div></aside>
    <nav className="bottom-nav" aria-label="Mobile navigation">{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={active(href) ? "active" : ""} aria-current={active(href) ? "page" : undefined}><Icon size={21} /><span>{label}</span></Link>)}</nav>
  </>;
}

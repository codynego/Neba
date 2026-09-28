"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Brand } from "./brand";
import { clearToken, getToken } from "@/lib/api";
export function Header() {
  const [signedIn, setSignedIn] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const sync = () => setSignedIn(Boolean(getToken()));
    sync();
    window.addEventListener("nearwork_auth", sync);
    return () => window.removeEventListener("nearwork_auth", sync);
  }, []);
  return <header className="site-header"><div className="container nav-wrap"><Brand />
    <button className="mobile-menu" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(!open)}>{open ? <X size={24} /> : <Menu size={24} />}</button>
    <nav className={open ? "nav-links open" : "nav-links"} aria-label="Main navigation">
      <Link href="/tasks" onClick={() => setOpen(false)}>Find tasks</Link><Link href="/offers" onClick={() => setOpen(false)}>Find people</Link>
      {signedIn ? <><Link href="/dashboard" onClick={() => setOpen(false)}>Dashboard</Link><button className="text-button" onClick={() => { clearToken(); setOpen(false); location.href = "/"; }}>Log out</button></> : <Link href="/login" onClick={() => setOpen(false)}>Log in</Link>}
      <Link className="nav-cta" href="/tasks/new" onClick={() => setOpen(false)}>Post a task <span>↗</span></Link>
    </nav>
  </div></header>;
}

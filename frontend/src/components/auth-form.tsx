"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api, setToken } from "@/lib/api";
export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await api<{ token: string }>(`/auth/${mode}/`, { method: "POST", body: JSON.stringify(data) });
      setToken(result.token);
      const next = new URLSearchParams(location.search).get("next");
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
    } catch (error) { setError((error as Error).message); } finally { setBusy(false); }
  }
  return <main className="form-page"><div className="form-shell"><span className="eyebrow">{mode === "register" ? "JOIN YOUR COMMUNITY" : "WELCOME BACK"}</span><h1>{mode === "register" ? <>Find your next <em>connection.</em></> : <>Good to have you <em>back.</em></>}</h1><p>{mode === "register" ? "Create an account to post, apply, and offer help." : "Log in to manage your tasks and applications."}</p><form onSubmit={submit} className="stack-form">{mode === "register" && <><label>Display name<input name="display_name" required placeholder="What should people call you?" /></label><label>Email<input name="email" type="email" required placeholder="you@example.com" /></label></>}<label>Username<input name="username" required placeholder="Your username" /></label><label>Password<input name="password" type="password" required minLength={8} placeholder="At least 8 characters" /></label>{mode === "register" && <div className="form-row"><label>City<input name="city" placeholder="e.g. Lagos" /></label><label>State<input name="state" placeholder="e.g. Lagos" /></label></div>}{error && <p className="error-box">{error}</p>}<button className="button button-dark full-width" disabled={busy}>{busy ? "Please wait..." : mode === "register" ? "Create account ↗" : "Log in ↗"}</button></form><p className="form-switch">{mode === "register" ? <>Already have an account? <Link href="/login">Log in</Link></> : <>New to Nearwork? <Link href="/register">Create an account</Link></>}</p></div></main>;
}

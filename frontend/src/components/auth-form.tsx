"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Compass, LockKeyhole, Mail, UserRound } from "lucide-react";
import { api, setToken } from "@/lib/api";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [nextQuery, setNextQuery] = useState("");

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) setNextQuery(`?next=${encodeURIComponent(next)}`);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await api<{ token: string; user?: { profile_complete?: boolean } }>(`/auth/${mode}/`, { method: "POST", body: JSON.stringify(data) });
      setToken(result.token);
      const next = new URLSearchParams(location.search).get("next");
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") && next !== "/onboarding" ? next : undefined;
      router.push(mode === "register" || result.user?.profile_complete === false ? `/onboarding${safeNext ? `?next=${encodeURIComponent(safeNext)}` : ""}` : safeNext || "/dashboard");
    } catch (submitError) { setError((submitError as Error).message); } finally { setBusy(false); }
  }

  const registering = mode === "register";
  return <main className="auth-radar-page"><section className="auth-radar-intro"><Link href="/" className="auth-back">← Back to GetNeba</Link><div className="auth-intro-copy"><span className="landing-eyebrow"><Compass size={14} /> YOUR PERSONAL OPPORTUNITY RADAR</span><h1>{registering ? <>The right opportunity<br />starts with <em>you.</em></> : <>Welcome back to<br /><em>your radar.</em></>}</h1><p>{registering ? "Create your account in a minute. Then we’ll help you find the doors worth opening." : "Your saved opportunities, profile, and next steps are waiting."}</p></div><div className="auth-intro-proof"><span><Check size={16} /> Scholarships, jobs, grants, and more</span><span><Check size={16} /> Personalized to your direction</span><span><Check size={16} /> Free to get started</span></div></section><section className="auth-radar-panel"><div className="auth-form-wrap"><div className="auth-form-heading"><span className="auth-step">{registering ? "STEP 1 OF 3" : "WELCOME BACK"}</span><h2>{registering ? "Create your GetNeba account" : "Log in to GetNeba"}</h2><p>{registering ? "No long questionnaire yet. We’ll build your opportunity profile next." : "Use the email address connected to your account."}</p></div><form onSubmit={submit} className="auth-form-stack">{registering && <label><span>Full name</span><span className="auth-input"><UserRound size={17} /><input name="display_name" autoComplete="name" required maxLength={80} placeholder="Your full name" /></span></label>}<label><span>Email address</span><span className="auth-input"><Mail size={17} /><input name={registering ? "email" : "identifier"} type="email" autoComplete="email" required placeholder="you@example.com" /></span></label><label><span>Password</span><span className="auth-input"><LockKeyhole size={17} /><input name="password" type="password" autoComplete={registering ? "new-password" : "current-password"} required minLength={8} placeholder={registering ? "At least 8 characters" : "Your password"} /></span></label>{registering && <label className="auth-optional"><span>Phone number <small>Optional — for WhatsApp/SMS alerts later</small></span><span className="auth-input"><input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+234 801 234 5678" /></span></label>}{registering && <label className="legal-consent"><input name="terms_accepted" type="checkbox" value="true" required /><span>I agree to the <Link href="/terms" target="_blank" rel="noreferrer">Terms of Service</Link> and acknowledge the <Link href="/privacy" target="_blank" rel="noreferrer">Privacy Notice</Link>.</span></label>}{!registering && <Link className="text-link" href="/forgot-password">Forgot your password?</Link>}{error && <p className="error-box" role="alert">{error}</p>}<button className="button button-dark full-width" disabled={busy}>{busy ? "One moment…" : registering ? "Create my account" : "Log in"}<ArrowRight size={18} /></button></form>{registering && <div className="google-placeholder" aria-label="Google sign-in will be available soon"><span>G</span> Continue with Google <small>Coming soon</small></div>}<p className="form-switch">{registering ? <>Already have an account? <Link href={`/login${nextQuery}`}>Log in</Link></> : <>New to GetNeba? <Link href={`/register${nextQuery}`}>Create an account</Link></>}</p></div></section></main>;
}

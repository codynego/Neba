"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const email = String(new FormData(event.currentTarget).get("email") || "");
    try { const result = await api<{ detail: string }>("/auth/password-reset/", { method: "POST", body: JSON.stringify({ email }) }); setMessage(result.detail); }
    catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }
  return <main className="form-page"><div className="form-shell"><span className="eyebrow">ACCOUNT RECOVERY</span><h1>Reset your <em>password.</em></h1><p>Enter the email connected to your GetNeba account.</p><form className="stack-form" onSubmit={submit}><label>Email<input name="email" type="email" autoComplete="email" required /></label>{message && <p className="form-note" role="status">{message}</p>}<button className="button button-dark full-width" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button></form><p className="form-switch"><Link href="/login">Back to login</Link></p></div></main>;
}

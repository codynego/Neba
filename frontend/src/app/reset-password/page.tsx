"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { api, clearToken } from "@/lib/api";

export default function ResetPasswordPage() {
  const [credentials, setCredentials] = useState({ uid: "", token: "" });
  const [message, setMessage] = useState("");
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { const query = new URLSearchParams(window.location.search); setCredentials({ uid: query.get("uid") || "", token: query.get("token") || "" }); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") || "");
    if (password !== data.get("confirm_password")) { setMessage("Passwords do not match."); setBusy(false); return; }
    try { const result = await api<{ detail: string }>("/auth/password-reset/confirm/", { method: "POST", body: JSON.stringify({ ...credentials, password }) }); clearToken(); setMessage(result.detail); setComplete(true); }
    catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }
  return <main className="form-page"><div className="form-shell"><span className="eyebrow">ACCOUNT RECOVERY</span><h1>Choose a new <em>password.</em></h1>{complete ? <><p className="form-note" role="status">{message}</p><Link className="button button-dark full-width" href="/login">Log in</Link></> : <form className="stack-form" onSubmit={submit}><label>New password<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label><label>Confirm password<input name="confirm_password" type="password" autoComplete="new-password" minLength={8} required /></label>{message && <p className="error-box" role="alert">{message}</p>}<button className="button button-dark full-width" disabled={busy || !credentials.uid}>{busy ? "Updating…" : "Update password"}</button></form>}</div></main>;
}

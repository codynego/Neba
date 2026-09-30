"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function VerifyEmailPage() {
  const [status, setStatus] = useState("Verifying your email…");
  const [verified, setVerified] = useState(false);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    api<{ detail: string }>("/auth/email/verify/", { method: "POST", body: JSON.stringify({ uid: query.get("uid"), token: query.get("token") }) })
      .then((result) => { setStatus(result.detail); setVerified(true); })
      .catch((error) => setStatus((error as Error).message));
  }, []);
  return <main className="form-page"><div className="form-shell"><span className="eyebrow">EMAIL VERIFICATION</span><h1>{verified ? <>Email <em>verified.</em></> : <>Checking your <em>link.</em></>}</h1><p role="status" className={verified ? "form-note" : "error-box"}>{status}</p><Link className="button button-dark full-width" href={verified ? "/dashboard" : "/login"}>{verified ? "Continue to GetNeba" : "Return to login"}</Link></div></main>;
}

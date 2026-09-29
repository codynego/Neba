"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { api, ApiError, clearToken, getToken } from "@/lib/api";
import { User } from "@/lib/types";
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let controller: AbortController;
    const redirect = () => router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    const check = () => {
      controller?.abort(); controller = new AbortController(); const current = controller;
      setReady(false); setError("");
      if (!getToken()) { redirect(); return; }
      api<User>("/auth/me/", { signal: current.signal }).then(() => { if (!current.signal.aborted) setReady(true); }).catch((err) => {
        if (current.signal.aborted) return;
        if (err instanceof ApiError && err.status === 401) { clearToken(); redirect(); }
        else setError("We could not check your account. Please try again.");
      });
    };
    check(); window.addEventListener("nearwork_auth", check); window.addEventListener("storage", check);
    return () => { controller?.abort(); window.removeEventListener("nearwork_auth", check); window.removeEventListener("storage", check); };
  }, [router, retry]);
  if (!ready) return <main className="listing-page container">{error ? <div className="load-error" role="alert"><p>{error}</p><button className="button button-outline" onClick={() => setRetry((value) => value + 1)}>Try again</button></div> : <div className="account-check" role="status" aria-label="Checking your account"><span aria-hidden="true"><LoaderCircle size={24} strokeWidth={1.75} /></span></div>}</main>;
  return children;
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { api, getToken } from "@/lib/api";
import { isPublicPath } from "@/lib/routes";
import { usePathname } from "next/navigation";

const dismissKey = "neba_push_prompt_dismissed";

function keyBytes(value: string) {
  const padded = value.padEnd(value.length + (4 - value.length % 4) % 4, "=").replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export function PushNotifications() {
  const path = usePathname();
  const [publicKey, setPublicKey] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const subscribe = useCallback(async (key: string) => {
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
    const ready = await navigator.serviceWorker.ready;
    let subscription = await ready.pushManager.getSubscription();
    if (!subscription) subscription = await ready.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
    await api("/notifications/push-subscription/", { method: "POST", body: JSON.stringify(subscription.toJSON()) });
    return registration;
  }, []);

  useEffect(() => {
    if (isPublicPath(path) || !getToken() || !window.isSecureContext || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) { setVisible(false); return; }
    let active = true;
    api<{ public_key: string }>("/notifications/push-config/").then(async ({ public_key }) => {
      if (!active || !public_key) return;
      setPublicKey(public_key);
      if (Notification.permission === "granted") {
        try { await subscribe(public_key); } catch {}
      } else if (Notification.permission === "default" && sessionStorage.getItem(dismissKey) !== "1") setVisible(true);
    }).catch(() => {});
    return () => { active = false; };
  }, [path, subscribe]);

  async function enable() {
    if (!publicKey || busy) return;
    setBusy(true); setError("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setVisible(false); return; }
      await subscribe(publicKey);
      setVisible(false);
    } catch {
      setError("Notifications could not be enabled. Check your browser settings and try again.");
    } finally { setBusy(false); }
  }

  function dismiss() {
    try { sessionStorage.setItem(dismissKey, "1"); } catch {}
    setVisible(false);
  }

  if (!visible) return null;
  return <aside className="push-notification-prompt" aria-label="Enable notifications"><span><BellRing size={18} /></span><div><strong>Keep up with your task</strong><p>Get messages, offers and booking updates even when GetNeba is closed.</p>{error && <small role="alert">{error}</small>}</div><button type="button" className="button button-dark compact" onClick={enable} disabled={busy}>{busy ? "Enabling…" : "Enable alerts"}</button><button type="button" className="push-prompt-dismiss" onClick={dismiss} aria-label="Not now"><X size={16} /></button></aside>;
}

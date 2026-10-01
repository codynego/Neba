"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Check, X } from "lucide-react";
import { api, getToken } from "@/lib/api";
import { isPublicPath } from "@/lib/routes";
import { usePathname } from "next/navigation";

const promptSeenKey = "neba_push_prompt_seen_v1";

function keyBytes(value: string) {
  const padded = value.padEnd(value.length + (4 - value.length % 4) % 4, "=").replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export async function subscribeToPush(key: string) {
  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  const ready = await navigator.serviceWorker.ready;
  let subscription = await ready.pushManager.getSubscription();
  if (!subscription) subscription = await ready.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
  await api("/notifications/push-subscription/", { method: "POST", body: JSON.stringify(subscription.toJSON()) });
  return registration;
}

function pushSupported() {
  return typeof window !== "undefined" && window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function PushNotificationSettings() {
  const [publicKey, setPublicKey] = useState("");
  const [permission, setPermission] = useState<NotificationPermission | "unavailable">("default");
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!pushSupported()) { setPermission("unavailable"); return; }
    setPermission(Notification.permission);
    api<{ public_key: string }>("/notifications/push-config/").then(async ({ public_key }) => {
      setPublicKey(public_key || "");
      if (Notification.permission === "granted") {
        const registration = await navigator.serviceWorker.getRegistration("/");
        setEnabled(Boolean(await registration?.pushManager.getSubscription()));
      }
    }).catch(() => setError("Notification settings could not be loaded."));
  }, []);

  async function enable() {
    if (!publicKey || busy) return;
    setBusy(true); setError("");
    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") return;
      await subscribeToPush(publicKey);
      setEnabled(true);
    } catch {
      setError("Notifications could not be enabled. Check your browser settings and try again.");
    } finally { setBusy(false); }
  }

  const unavailable = permission === "unavailable";
  const blocked = permission === "denied";
  const configured = Boolean(publicKey);
  return <section className="notification-settings" aria-labelledby="notification-settings-title">
    <div className="notification-settings-icon" aria-hidden="true"><BellRing size={18} /></div>
    <div className="notification-settings-copy">
      <div className="notification-settings-heading"><h2 id="notification-settings-title">Notifications</h2>{enabled && <span className="notification-settings-status"><Check size={13} /> Enabled</span>}</div>
      <p>{unavailable ? "Push notifications aren’t available in this browser or connection." : blocked ? "Notifications are blocked in your browser. Allow them in this site’s settings, then try again." : !configured ? "Push notifications aren’t configured yet." : enabled ? "You’ll get messages, booking updates and task activity as they happen." : "Get messages, booking updates and task activity even when GetNeba is closed."}</p>
      {error && <small className="form-error" role="alert">{error}</small>}
      {!unavailable && configured && !enabled && <button type="button" className="button button-dark compact" onClick={enable} disabled={busy}>{busy ? "Checking…" : blocked ? "Try again" : "Enable notifications"}</button>}
    </div>
  </section>;
}

export function PushNotifications() {
  const path = usePathname();
  const [publicKey, setPublicKey] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const subscribe = useCallback(subscribeToPush, []);

  useEffect(() => {
    if (path !== "/dashboard" || isPublicPath(path) || !getToken() || !window.isSecureContext || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) { setVisible(false); return; }
    let active = true;
    api<{ public_key: string }>("/notifications/push-config/").then(async ({ public_key }) => {
      if (!active || !public_key) return;
      setPublicKey(public_key);
      if (Notification.permission === "granted") {
        try { await subscribe(public_key); } catch {}
      } else if (Notification.permission === "default" && localStorage.getItem(promptSeenKey) !== "1") {
        localStorage.setItem(promptSeenKey, "1");
        setVisible(true);
      }
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
    setVisible(false);
  }

  if (!visible) return null;
  return <aside className="push-notification-prompt" aria-label="Enable notifications"><span><BellRing size={18} /></span><div><strong>Keep up with your task</strong><p>Get messages, offers and booking updates even when GetNeba is closed.</p>{error && <small role="alert">{error}</small>}</div><button type="button" className="button button-dark compact" onClick={enable} disabled={busy}>{busy ? "Enabling…" : "Enable alerts"}</button><button type="button" className="push-prompt-dismiss" onClick={dismiss} aria-label="Not now"><X size={16} /></button></aside>;
}

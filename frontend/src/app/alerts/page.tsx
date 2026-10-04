"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, BellRing, CalendarClock, Check, CheckCheck, ChevronRight, Clock3, ExternalLink, Settings, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { Notification, Page } from "@/lib/types";
import { PushNotificationSettings } from "@/components/push-notifications";

type AlertTab = "all" | "matches" | "deadlines" | "applications" | "updates";
const tabs: Array<{ value: AlertTab; label: string }> = [{ value: "all", label: "All" }, { value: "matches", label: "New Matches" }, { value: "deadlines", label: "Deadlines" }, { value: "applications", label: "Applications" }, { value: "updates", label: "Updates" }];

function alertKind(item: Notification): Exclude<AlertTab, "all"> {
  const text = `${item.title} ${item.detail}`.toLowerCase();
  if (text.includes("deadline") || text.includes("due") || text.includes("closing")) return "deadlines";
  if (text.includes("application") || text.includes("interview") || text.includes("shortlist") || text.includes("applied")) return "applications";
  if (text.includes("updated") || text.includes("changed") || text.includes("closed")) return "updates";
  return "matches";
}

function timeAgo(value: string) {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} hr ago`;
  if (minutes < 2880) return "Yesterday";
  return new Intl.DateTimeFormat("en-NG", { month: "short", day: "numeric" }).format(new Date(value));
}

function AlertCard({ item, onRead }: { item: Notification; onRead: (item: Notification) => void }) {
  const kind = alertKind(item); const unread = !item.read_at;
  const Icon = kind === "deadlines" ? CalendarClock : kind === "applications" ? Clock3 : kind === "updates" ? Bell : Sparkles;
  const label = kind === "deadlines" ? "Deadline approaching" : kind === "applications" ? "Application update" : kind === "updates" ? "Opportunity update" : "New match";
  return <article className={`alert-card${unread ? " unread" : ""}`}><div className={`alert-card-icon ${kind}`}><Icon size={18} /></div><div className="alert-card-content"><div className="alert-card-label"><span>{label}</span>{unread && <b>New</b>}</div><Link href={item.path || "/opportunities"} onClick={() => unread && onRead(item)}><h2>{item.title}</h2><p>{item.detail}</p></Link><div className="alert-card-footer"><Link href={item.path || "/opportunities"} onClick={() => unread && onRead(item)}>{kind === "deadlines" ? "Continue application" : kind === "updates" ? "View changes" : kind === "applications" ? "View application" : "View opportunity"} <ChevronRight size={14} /></Link><time dateTime={item.created_at}>{timeAgo(item.created_at)}</time></div></div></article>;
}

function AlertSettings() {
  const [settings, setSettings] = useState({ highMatch: true, anyMatch: true, deadlines: true, changes: true, weekly: true });
  const toggle = (key: keyof typeof settings) => setSettings((current) => ({ ...current, [key]: !current[key] }));
  return <section className="alert-settings-panel"><div className="alert-settings-heading"><div><span className="eyebrow">ALERT SETTINGS</span><h2>Choose what deserves your attention.</h2></div><Settings size={20} /></div><div className="alert-settings-grid"><div><h3>What do you want to hear about?</h3>{[["highMatch", "High-match opportunities"], ["anyMatch", "Any matching opportunity"], ["deadlines", "Deadline reminders"], ["changes", "Opportunity changes"], ["weekly", "Weekly opportunity digest"]].map(([key, label]) => <label key={key}><span>{label}</span><button className={`alert-switch${settings[key as keyof typeof settings] ? " on" : ""}`} onClick={() => toggle(key as keyof typeof settings)} aria-pressed={settings[key as keyof typeof settings]}><i /></button></label>)}</div><div><h3>How should we notify you?</h3><div className="alert-channel-row"><span>Email</span><b className="channel-status">Available</b></div><div className="alert-channel-row"><span>Browser push</span><b className="channel-status">Available</b></div><div className="alert-channel-row muted"><span>WhatsApp</span><b>Coming later</b></div><PushNotificationSettings /></div></div></section>;
}

export default function AlertsPage() {
  const [items, setItems] = useState<Notification[]>([]); const [tab, setTab] = useState<AlertTab>("all"); const [settingsOpen, setSettingsOpen] = useState(false); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const load = useCallback(async () => { const data = await api<Page<Notification>>("/notifications/"); setItems(data.results); }, []);
  useEffect(() => { load().catch((err) => setError(err.message)).finally(() => setLoading(false)); }, [load]);
  const filtered = useMemo(() => tab === "all" ? items : items.filter((item) => alertKind(item) === tab), [items, tab]);
  const unread = items.filter((item) => !item.read_at).length; const deadlines = items.filter((item) => alertKind(item) === "deadlines" && !item.read_at).length;
  async function mark(item?: Notification) { setBusy(true); try { await api(item ? `/notifications/${item.id}/read/` : "/notifications/read-all/", { method: "POST" }); setItems((current) => current.map((row) => item ? row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row : { ...row, read_at: new Date().toISOString() })); window.dispatchEvent(new Event("neba_notifications")); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }
  return <main className="alerts-page container"><header className="alerts-header"><div><span className="eyebrow">YOUR OPPORTUNITY RADAR</span><h1>Your Alerts</h1><p>Stay ahead of new opportunities, deadlines, and important changes.</p></div><button className={`button button-outline${settingsOpen ? " active" : ""}`} onClick={() => setSettingsOpen((open) => !open)}><Settings size={16} /> Alert settings</button></header><div className="alerts-summary"><strong>{unread} new alerts</strong><span>·</span><strong>{deadlines} deadlines approaching</strong>{unread > 0 && <button className="text-button" disabled={busy} onClick={() => mark()}><CheckCheck size={14} /> Mark all read</button>}</div>{settingsOpen && <AlertSettings />}<nav className="alert-tabs" aria-label="Alert categories">{tabs.map((entry) => <button key={entry.value} className={tab === entry.value ? "active" : ""} onClick={() => setTab(entry.value)}>{entry.label}{entry.value !== "all" && <span>{items.filter((item) => alertKind(item) === entry.value).length}</span>}</button>)}</nav>{error && <p className="error-box" role="alert">{error}</p>}{loading ? <div className="alerts-empty"><BellRing size={24} /><p>Loading your alerts...</p></div> : filtered.length ? <section className="alerts-feed">{filtered.map((item) => <AlertCard key={item.id} item={item} onRead={mark} />)}</section> : <section className="alerts-empty"><Bell size={25} /><div><h2>You&apos;re all caught up.</h2><p>New matches, deadlines, and opportunity changes will appear here.</p><Link href="/opportunities" className="button button-dark compact">Explore opportunities <ExternalLink size={14} /></Link></div></section>}</main>;
}
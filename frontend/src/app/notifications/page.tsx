"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { api } from "@/lib/api";
import { Notification, Page } from "@/lib/types";
export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [next, setNext] = useState(false);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const data = await api<Page<Notification>>(`/notifications/?page=${page}`); setItems(data.results); setNext(!!data.next); }, [page]);
  useEffect(() => { load().catch((err) => setError(err.message)); const timer = setInterval(() => { if (!document.hidden) load().catch(() => {}); }, 20000); return () => clearInterval(timer); }, [load]);
  async function mark(id?: number) { setBusy(true); setError(""); try { await api(id ? `/notifications/${id}/read/` : "/notifications/read-all/", { method: "POST" }); await load(); window.dispatchEvent(new Event("neba_notifications")); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }
  return <main className="listing-page container"><div className="listing-heading"><div><span className="eyebrow">STAY IN THE LOOP</span><h1>Your <em>notifications.</em></h1><p>Applications, messages, task changes, and review decisions.</p></div><button className="button button-outline" disabled={busy} onClick={() => mark()}><CheckCheck size={17} />Mark all read</button></div>{error && <p className="error-box" role="alert">{error}</p>}<section className="notifications-list">{items.length ? items.map((item) => <article key={item.id} className={`notification-row ${item.read_at ? "" : "unread"}`}><Bell size={19} /><div><Link href={item.path} onClick={() => { if (!item.read_at) api(`/notifications/${item.id}/read/`, { method: "POST" }).then(() => window.dispatchEvent(new Event("neba_notifications"))).catch(() => {}); }}><strong>{item.title}</strong><p>{item.detail}</p></Link><small>{new Date(item.created_at).toLocaleString("en-NG")}</small></div>{!item.read_at && <button className="text-button" disabled={busy} onClick={() => mark(item.id)}>Mark read</button>}</article>) : <div className="empty-list"><h2>You’re all caught up.</h2><p>New activity will appear here.</p></div>}</section><div className="pagination-controls"><button className="small-button" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page}</span><button className="small-button" disabled={!next} onClick={() => setPage(page + 1)}>Next</button></div></main>;
}

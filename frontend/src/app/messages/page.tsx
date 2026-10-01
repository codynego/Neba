"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, MessageCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Conversation, Page } from "@/lib/types";
import { MemberPhoto } from "@/components/trust";

export default function MessagesPage() {
  const [rows, setRows] = useState<Conversation[]>([]);
  const [page, setPage] = useState(1);
  const [next, setNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    api("/notifications/read-task-messages/", { method: "POST" }).then(() => window.dispatchEvent(new Event("neba_notifications"))).catch(() => {});
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const data = await api<Page<Conversation>>(`/tasks/conversations/?page=${page}`, { signal: controller.signal });
        if (!controller.signal.aborted) { setRows(data.results); setNext(!!data.next); setError(""); }
      } catch (err) { if (!controller.signal.aborted) setError((err as Error).message); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    setLoading(true); load();
    const refresh = () => { if (!document.hidden) load(); };
    const timer = setInterval(refresh, 10000);
    document.addEventListener("visibilitychange", refresh);
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [page, retry]);
  return <main className="listing-page container messages-page"><div className="listing-heading"><div><span className="eyebrow">A GOOD PLACE TO TALK</span><h1>Your <em>messages.</em></h1><p>Work out the details. Keep every task conversation close by.</p></div><MessageCircle size={32} className="inbox-mark" /></div>{error ? <div role="alert" className="load-error"><p>{error}</p><button className="small-button" onClick={() => setRetry(retry + 1)}>Try again</button></div> : loading ? <p role="status">Loading conversations...</p> : rows.length ? <div className="conversation-inbox">{rows.map((row) => <Link className="conversation-row" key={row.task_id} href={`/messages/${row.task_public_id || row.task_id}`}><MemberPhoto id={row.member.id} name={row.member.display_name || "N"} available={row.member.photo_available} /><div className="conversation-preview"><div><strong>{row.member.display_name || "Task partner"}</strong><span className="status-pill">{row.status}</span></div><h2>{row.title}</h2><p>{row.last_message || "No messages yet. Start by agreeing on the details."}</p><small>{new Date(row.last_message_at || row.updated_at).toLocaleString("en-NG")}</small></div><ArrowUpRight size={19} /></Link>)}</div> : <div className="empty-list"><MessageCircle size={32} /><h2>Your conversations start with a booking.</h2><p>Once a helper accepts a request or application, your private conversation appears here.</p><Link className="button button-outline" href="/activity">View activity</Link></div>}<div className="pagination-controls"><button className="small-button" disabled={page === 1 || loading} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page}</span><button className="small-button" disabled={!next || loading} onClick={() => setPage(page + 1)}>Next</button></div><p className="form-note">Completed and cancelled bookings keep their read-only conversation history.</p></main>;
}

"use client";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Send, ArrowLeft, ArrowUpRight } from "lucide-react";
import { api } from "@/lib/api";
import { TaskMessage, Workspace, User } from "@/lib/types";
import { MemberPhoto } from "./trust";
import { SafetyActions } from "./safety-actions";

export function TaskConversation({ taskId }: { taskId: number }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [me, setMe] = useState<number | null>(null);
  const [messages, setMessages] = useState<TaskMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lastMessage = useRef(0);
  const messageRequest = useRef(false);
  const messageRetry = useRef<{ text: string; id: string } | null>(null);
  const base = `/tasks/${taskId}`;
  const load = useCallback(async (signal?: AbortSignal) => { const data = await api<Workspace>(`${base}/workspace/`, { signal }); if (!signal?.aborted) setWorkspace(data); }, [base]);
  const loadMessages = useCallback(async (signal?: AbortSignal) => {
    if (messageRequest.current) return;
    messageRequest.current = true;
    try {
      let more = true;
      while (more) {
        const data = await api<{ results: TaskMessage[]; has_more: boolean }>(`${base}/messages/?after=${lastMessage.current}`, { signal });
        if (signal?.aborted) return;
        if (data.results.length) { lastMessage.current = data.results.at(-1)!.id; setMessages((previous) => { const ids = new Set(previous.map((message) => message.id)); return [...previous, ...data.results.filter((message) => !ids.has(message.id))]; }); }
        more = data.has_more;
      }
    } finally { messageRequest.current = false; }
  }, [base]);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([load(controller.signal), api<User>("/auth/me/", { signal: controller.signal }).then((user) => { if (!controller.signal.aborted) setMe(user.id); })]).then(() => { if (!controller.signal.aborted) return loadMessages(controller.signal); }).catch((err) => { if (!controller.signal.aborted) setError(err.message); });
    const refresh = () => { if (!document.hidden) { load(controller.signal).catch(() => {}); loadMessages(controller.signal).catch(() => {}); } };
    const timer = setInterval(refresh, 10000); document.addEventListener("visibilitychange", refresh);
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [load, loadMessages]);
  async function send(event: FormEvent) {
    event.preventDefault(); if (busy || !text.trim()) return; setBusy(true); setError("");
    const pending = messageRetry.current?.text === text.trim() ? messageRetry.current : { text: text.trim(), id: crypto.randomUUID() }; messageRetry.current = pending;
    try { await api(`${base}/messages/`, { method: "POST", body: JSON.stringify({ text: pending.text, client_id: pending.id }) }); messageRetry.current = null; setText(""); await loadMessages(); window.dispatchEvent(new Event("neba_notifications")); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return <main className="container conversation-page"><Link className="back-link" href="/messages"><ArrowLeft size={16} />All messages</Link>{error && <p className="error-box" role="alert">{error}</p>}{!workspace || me === null ? <p role="status">{error ? "Open another conversation from your inbox." : "Loading your conversation..."}</p> : <section className="conversation-sheet"><header className="conversation-heading"><MemberPhoto id={workspace.member.id} name={workspace.member.display_name || "N"} available={workspace.member.photo_available} /><div><h1>{workspace.member.display_name || "Task partner"}</h1><p>{workspace.task.title}</p></div><span className="status-pill">{workspace.task.status}</span></header><div className="conversation-task-link"><span>{workspace.task.status === "completed" || workspace.task.status === "cancelled" ? "Task ended. Conversation archived" : "Keep the work and arrangements in one conversation."}</span><Link href={`/tasks/${taskId}`}>View booking <ArrowUpRight size={16} /></Link></div>
    <section className="task-conversation"><h3><MessageCircle size={20} />Your task conversation</h3><p className="form-note">Private to the requester and accepted helper. Messages refresh while this page is open.</p><div className="message-list" role="log" aria-label="Task messages" aria-live="polite">{messages.length ? messages.map((message) => <article key={message.id} className={`message-bubble ${message.sender === me ? "mine" : ""}`}><strong>{message.sender === me ? "You" : message.sender_name || "Task partner"}</strong><p>{message.text}</p><small>{new Date(message.created_at).toLocaleString("en-NG")}</small></article>) : <p className="panel-empty">No messages yet. Agree on the details before starting.</p>}</div>{workspace.can_message ? <form className="message-compose" onSubmit={send}><label htmlFor={`message-${taskId}`} className="sr-only">Message your task partner</label><textarea id={`message-${taskId}`} value={text} onChange={(event) => setText(event.target.value)} maxLength={2000} rows={3} placeholder="Confirm timing, location, or the work…" required /><button className="button button-dark compact" disabled={busy || !text.trim()}><Send size={16} />Send</button></form> : <p className="form-note">New messages are disabled for ended bookings or unavailable/blocked members. Your conversation history remains accessible.</p>}</section>
<SafetyActions member={workspace.member.id} name={workspace.member.display_name} task={taskId} /></section>}</main>;
}

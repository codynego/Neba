"use client";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Send, ArrowLeft, ArrowUpRight } from "lucide-react";
import { api } from "@/lib/api";
import { TaskMessage, Workspace, User } from "@/lib/types";
import { MemberPhoto } from "./trust";
import { SafetyActions } from "./safety-actions";
import { AttachmentPicker, MessageAttachments, uploadMessageFiles } from "./message-attachments";

export function TaskConversation({ taskId }: { taskId: string | number }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [me, setMe] = useState<number | null>(null);
  const [messages, setMessages] = useState<TaskMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState("");
  const lastMessage = useRef(0);
  const messageRequest = useRef(false);
  const openedLinkedMessage = useRef(false);
  const messageRetry = useRef<{ text: string; id: string; signature: string; attachments: TaskMessage["attachments"] } | null>(null);
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
  useEffect(() => {
    if (openedLinkedMessage.current || !window.location.hash.startsWith("#message-")) return;
    const message = document.getElementById(window.location.hash.slice(1));
    if (message) { openedLinkedMessage.current = true; message.scrollIntoView({ behavior: "smooth", block: "center" }); message.focus({ preventScroll: true }); }
  }, [messages]);
  async function send(event: FormEvent) {
    event.preventDefault(); if (busy || (!text.trim() && !files.length)) return; setBusy(true); setError("");
    const signature = files.map((file) => `${file.name}:${file.size}:${file.lastModified}`).join("|");
    try {
      let pending = messageRetry.current;
      if (!pending || pending.text !== text.trim() || pending.signature !== signature) {
        const attachments = files.length ? await uploadMessageFiles(base, files, setUploadProgress) : [];
        pending = { text: text.trim(), id: crypto.randomUUID(), signature, attachments };
        messageRetry.current = pending;
      }
      setUploadProgress("Sending…");
      await api(`${base}/messages/`, { method: "POST", body: JSON.stringify({ text: pending.text, attachments: pending.attachments, client_id: pending.id }) });
      messageRetry.current = null; setText(""); setFiles([]); await loadMessages(); window.dispatchEvent(new Event("neba_notifications"));
    }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); setUploadProgress(""); }
  }
  return <main className="container conversation-page"><Link className="back-link" href="/messages"><ArrowLeft size={16} />All messages</Link>{error && <p className="error-box" role="alert">{error}</p>}{!workspace || me === null ? <p role="status">{error ? "Open another conversation from your inbox." : "Loading your conversation..."}</p> : <section className="conversation-sheet"><header className="conversation-heading"><MemberPhoto id={workspace.member.public_id || workspace.member.id} name={workspace.member.display_name || "N"} available={workspace.member.photo_available} /><div><h1>{workspace.members && workspace.members.length > 1 ? `Task team · ${workspace.members.length} helpers` : workspace.member.display_name || "Task partner"}</h1><p>{workspace.task.title}</p></div><span className="status-pill">{workspace.task.status}</span></header><div className="conversation-task-link"><span>{workspace.task.status === "completed" || workspace.task.status === "cancelled" ? "Task ended. Conversation archived" : "Keep the work and arrangements in one conversation."}</span><Link href={`/tasks/${workspace.task.public_id || taskId}`}>View booking <ArrowUpRight size={16} /></Link></div>
    <section className="task-conversation"><h3><MessageCircle size={20} />Your task conversation</h3><p className="form-note">Private to the requester and accepted helper. Share photos or a PDF when you need proof of the work.</p><div className="message-list" role="log" aria-label="Task messages" aria-live="polite">{messages.length ? messages.map((message) => <article id={`message-${message.id}`} tabIndex={-1} key={message.id} className={`message-bubble ${message.sender === me ? "mine" : ""}`}><strong>{message.sender === me ? "You" : message.sender_name || "Task partner"}</strong>{message.text && <p>{message.text}</p>}<MessageAttachments base={base} messageId={message.id} attachments={message.attachments} /><small>{new Date(message.created_at).toLocaleString("en-NG")}</small></article>) : <p className="panel-empty">No messages yet. Agree on the details before starting.</p>}</div>{workspace.can_message ? <form className="message-compose" onSubmit={send}><AttachmentPicker files={files} disabled={busy} progress={uploadProgress} onChange={(next) => { setFiles(next); messageRetry.current = null; }} onError={setError} /><div className="message-compose-row"><label htmlFor={`message-${taskId}`} className="sr-only">Message your task partner</label><textarea id={`message-${taskId}`} value={text} onChange={(event) => { setText(event.target.value); messageRetry.current = null; }} maxLength={2000} rows={3} placeholder="Write a message or attach proof…" /><button className="button button-dark compact" disabled={busy || (!text.trim() && !files.length)}><Send size={16} />Send</button></div></form> : <p className="form-note">New messages are disabled for ended bookings or unavailable/blocked members. Your conversation history remains accessible.</p>}</section>
<SafetyActions member={workspace.member.public_id || workspace.member.id} name={workspace.member.display_name} task={workspace.task.public_id || taskId} /></section>}</main>;
}

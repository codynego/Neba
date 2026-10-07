"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Lock, MessageCircle, Send } from "lucide-react";
import { api } from "@/lib/api";
import { OpportunityApplication, OpportunityMessage } from "@/lib/types";

const closedStatuses = new Set(["unsuccessful", "withdrawn"]);

export function OpportunityApplicationMessages({ applicationId }: { applicationId: string }) {
  const [application, setApplication] = useState<OpportunityApplication | null>(null);
  const [messageText, setMessageText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<OpportunityApplication>(`/opportunity-applications/${applicationId}/`).then((item) => {
      setApplication(item);
      return api<OpportunityMessage[]>(`/opportunity-applications/${applicationId}/messages/`);
    }).then((messages) => setApplication((current) => current ? { ...current, messages, unread_message_count: 0 } : current)).catch((err) => setError((err as Error).message));
  }, [applicationId]);

  async function sendMessage() {
    if (!application || !messageText.trim() || busy || (!application.is_poster && closedStatuses.has(application.status))) return;
    setBusy(true); setError("");
    try {
      const message = await api<OpportunityMessage>(`/opportunity-applications/${application.public_id}/messages/`, { method: "POST", body: JSON.stringify({ text: messageText.trim() }) });
      setApplication({ ...application, messages: [...application.messages, message] });
      setMessageText("");
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  if (error) return <main className="application-message-page container"><p className="error-box">{error}</p><Link className="text-link" href="/applications">Back to applications</Link></main>;
  if (!application) return <main className="application-message-page container"><p role="status">Loading messages...</p></main>;

  const closed = !application.is_poster && closedStatuses.has(application.status);
  const backHref = application.is_poster ? `/opportunity-applications/${application.public_id}` : `/applications/${application.public_id}`;
  return <main className="application-message-page container"><Link className="back-link" href={backHref}><ArrowLeft size={15} /> Back to application</Link><header className="application-message-header"><div><span className="eyebrow">APPLICATION MESSAGES</span><h1>{application.is_poster ? application.applicant_name : application.opportunity.title}</h1><p>{application.is_poster ? application.opportunity.title : application.opportunity.provider}</p></div><MessageCircle size={28} /></header><section className="application-message-card"><div className="application-message-context"><span className="application-message-avatar"><MessageCircle size={17} /></span><div><strong>Private application conversation</strong><small>{application.is_poster ? "You are speaking with the applicant." : "You are speaking with the opportunity poster."}</small></div><span className={`application-message-status ${application.status}`}>{application.status}</span></div><div className="application-message-list">{application.messages.length ? application.messages.map((message) => <article className={`application-message-bubble${message.is_mine ? " mine" : ""}`} key={message.id}><strong>{message.sender_name}</strong><p>{message.text}</p><small>{new Date(message.created_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</small></article>) : <div className="application-message-empty"><MessageCircle size={22} /><p>No messages yet. Start the conversation when you are ready.</p></div>}</div>{closed ? <div className="application-message-closed"><Lock size={16} /><span>This application is closed. Messaging is no longer available.</span></div> : <div className="application-message-compose"><textarea value={messageText} onChange={(event) => setMessageText(event.target.value)} rows={3} maxLength={2000} placeholder="Write a message about this application…" /><button className="button button-dark" onClick={sendMessage} disabled={busy || !messageText.trim()}><Send size={16} /> {busy ? "Sending…" : "Send message"}</button></div>}</section></main>;
}

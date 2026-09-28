"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ArrowLeft, MapPin, CalendarDays, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { api, getToken } from "@/lib/api";
import { Task, naira, categories } from "@/lib/types";
export default function TaskDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { api<Task>(`/tasks/${id}/`).then(setTask).catch((error) => setFeedback(error.message)).finally(() => setLoading(false)); }, [id]);
  async function apply() {
    if (!getToken()) { router.push(`/login?next=/tasks/${id}`); return; }
    try { await api("/applications/", { method: "POST", body: JSON.stringify({ task: Number(id), message, contact_phone: phone }) }); setFeedback("Application sent. You can track it in your dashboard."); setMessage(""); }
    catch (error) { setFeedback((error as Error).message); }
  }
  if (loading) return <main className="detail-page container"><p>Loading task...</p></main>;
  if (!task) return <main className="detail-page container"><p className="error-box">{feedback || "Task not found."}</p></main>;
  return <main className="detail-page"><div className="container"><Link className="back-link" href="/tasks"><ArrowLeft size={17} /> Back to tasks</Link><div className="detail-grid"><article className="detail-main"><span className="category-pill">{categories.find((c) => c.value === task.category)?.label}</span><h1>{task.title}</h1><div className="detail-meta"><span><MapPin size={18} /> {task.neighborhood ? `${task.neighborhood}, ` : ""}{task.city}, {task.state}</span><span><CalendarDays size={18} /> {task.scheduled_for ? new Date(task.scheduled_for).toLocaleString("en-NG") : "Flexible timing"}</span><span><Users size={18} /> {task.application_count} applicants</span></div><div className="detail-body"><h2>What needs doing</h2><p>{task.description}</p></div><div className="posted-by">Posted by <strong>{task.requester_name || "Community member"}</strong> Â· {new Date(task.created_at).toLocaleDateString("en-NG")}</div></article><aside className="detail-aside"><span className="eyebrow">TASK REWARD</span><div className="detail-price">{naira(task.reward_amount)}</div>{task.reward_note && <p>{task.reward_note}</p>}<div className="aside-rule" />{task.status === "open" ? <><label htmlFor="message">Introduce yourself</label><textarea id="message" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell them why you can help..." /><label htmlFor="phone">Phone number for coordination</label><input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="080..." /><button className="button button-dark full-width" onClick={apply} disabled={!message.trim() || !phone.trim()}>Apply for this task â†—</button></> : <p>This task is {task.status}.</p>}{feedback && <p className="form-feedback">{feedback}</p>}<small>Agree on the exact work, timing, and payment method before you begin.</small></aside></div></div></main>;
}


"use client";

import { useEffect, useState } from "react";
import { BarChart3, CircleAlert, LoaderCircle, Target } from "lucide-react";
import { api } from "@/lib/api";
import { LearnNav } from "@/components/learn-nav";

type Performance = { summary: { sessions_completed: number; questions_answered: number; accuracy: number | null }; topic_performance: { topic: string; accuracy: number; attempts: number; status: string }[]; recent_sessions: { id: string; exam: string; paper: string; mode: string; completed_at: string; answered: number; accuracy: number | null }[] };

export default function PerformancePage() {
  const [data, setData] = useState<Performance | null>(null); const [error, setError] = useState("");
  useEffect(() => { api<Performance>("/exam-buddy/performance/").then(setData).catch((err) => setError((err as Error).message)); }, []);
  if (!data && !error) return <main className="learn-dashboard"><LearnNav /><div className="ld-loading"><LoaderCircle size={22} /> Reading your practice history…</div></main>;
  return <main className="learn-dashboard"><LearnNav /><div className="ld-shell ld-subpage"><section className="ld-page-hero"><span className="ld-kicker"><BarChart3 size={14} /> MY PERFORMANCE</span><h1>See what deserves<br /><em>your attention.</em></h1><p>These signals come from completed practice. They are a guide for revision, not a judgement about your ability.</p></section>{error ? <div className="ld-error"><CircleAlert size={17} /> {error}</div> : data?.summary.questions_answered ? <><section className="ld-performance-summary"><div><small>COMPLETED SESSIONS</small><strong>{data.summary.sessions_completed}</strong></div><div><small>QUESTIONS ANSWERED</small><strong>{data.summary.questions_answered}</strong></div><div><small>OVERALL ACCURACY</small><strong>{data.summary.accuracy}%</strong></div></section><section className="ld-performance-grid"><article className="ld-panel"><span className="ld-kicker">TOPIC PERFORMANCE</span><h2>What to revisit next.</h2><div className="ld-performance-topics">{data.topic_performance.map((topic) => <div key={topic.topic}><div><strong>{topic.topic}</strong><small>{topic.attempts} attempt{topic.attempts === 1 ? "" : "s"} · {topic.status.replaceAll("_", " ")}</small></div><b>{topic.accuracy}%</b><i><em style={{ width: `${topic.accuracy}%` }} /></i></div>)}</div></article><article className="ld-panel"><span className="ld-kicker">RECENT SESSIONS</span><h2>Your practice history.</h2><div className="ld-history">{data.recent_sessions.map((item) => <div key={item.id}><span><strong>{item.paper}</strong><small>{item.exam} · {item.mode}</small></span><b>{item.accuracy ?? "—"}%</b></div>)}</div></article></section></> : <section className="ld-empty-panel"><Target size={23} /><h2>Your performance will build here.</h2><p>Complete your first Exam Buddy practice session to see topic accuracy and your revision priorities.</p></section>}</div></main>;
}

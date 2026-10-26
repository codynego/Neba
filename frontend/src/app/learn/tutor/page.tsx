"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowUp, BrainCircuit, CircleAlert, LoaderCircle, MessageCircleQuestion, ShieldCheck, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { LearnNav } from "@/components/learn-nav";

type Topic = { id: string; name: string };
type Paper = { id: string; name: string; topics: Topic[] };
type Exam = { id: string; name: string; papers: Paper[] };
type Message = { role: "learner" | "tutor"; text: string };

export default function TutorPage() {
  const [exams, setExams] = useState<Exam[]>([]); const [paperId, setPaperId] = useState(""); const [topicId, setTopicId] = useState(""); const [question, setQuestion] = useState(""); const [messages, setMessages] = useState<Message[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useEffect(() => { api<{ exams: Exam[] }>("/exam-buddy/catalog/").then((result) => { setExams(result.exams); setPaperId(result.exams[0]?.papers[0]?.id || ""); }).catch((err) => setError((err as Error).message)); }, []);
  const papers = useMemo(() => exams.flatMap((exam) => exam.papers.map((paper) => ({ ...paper, exam: exam.name }))), [exams]);
  const paper = papers.find((item) => item.id === paperId);

  async function ask(event: FormEvent) {
    event.preventDefault(); const prompt = question.trim(); if (!prompt || !paperId || busy) return;
    const next: Message[] = [...messages, { role: "learner", text: prompt }]; setMessages(next); setQuestion(""); setBusy(true); setError("");
    try {
      const result = await api<{ answer: string }>("/exam-buddy/tutor/", { method: "POST", body: JSON.stringify({ paper_id: paperId, topic_id: topicId || null, question: prompt, history: next.slice(-6).map((item) => ({ role: item.role, text: item.text })) }) });
      setMessages([...next, { role: "tutor", text: result.answer }]);
    } catch (err) { setError((err as Error).message || "AI Tutor could not respond."); }
    finally { setBusy(false); }
  }

  return <main className="learn-dashboard"><LearnNav /><div className="ld-shell ld-subpage"><section className="ld-page-hero ld-tutor-hero"><span className="ld-kicker"><BrainCircuit size={14} /> AI TUTOR</span><h1>Ask until it<br /><em>makes sense.</em></h1><p>Choose the paper and topic you are studying. Neba will explain the method, work through a step, and give you one question to check your understanding.</p></section>
    <section className="ld-tutor-workspace"><aside><span className="ld-kicker">STUDY CONTEXT</span><label>Exam paper<select value={paperId} onChange={(event) => { setPaperId(event.target.value); setTopicId(""); }}>{papers.map((item) => <option value={item.id} key={item.id}>{item.exam} · {item.name}</option>)}</select></label><label>Topic<select value={topicId} onChange={(event) => setTopicId(event.target.value)}><option value="">Any topic in this paper</option>{paper?.topics.map((topic) => <option value={topic.id} key={topic.id}>{topic.name}</option>)}</select></label><div className="ld-tutor-guard"><ShieldCheck size={18} /><p><strong>Built for understanding</strong>Neba teaches from verified syllabus context and will not help with leaked exam material.</p></div></aside>
      <div className="ld-tutor-conversation"><header><span><BrainCircuit size={19} /></span><div><strong>Neba Tutor</strong><small>{paper ? `${paper.exam} · ${paper.name}` : "Choose a paper to begin"}</small></div></header><div className="ld-tutor-messages">{messages.length ? messages.map((message, index) => <article className={message.role} key={`${message.role}-${index}`}><small>{message.role === "tutor" ? "NEBA TUTOR" : "YOU"}</small><p>{message.text}</p></article>) : <div className="ld-tutor-empty"><MessageCircleQuestion size={27} /><h2>What are you stuck on?</h2><p>Ask for an explanation, a worked example, or help understanding why an answer is wrong.</p><div>{["Explain this topic simply", "Show me the first step", "Give me a similar example"].map((item) => <button type="button" key={item} onClick={() => setQuestion(item)}>{item}</button>)}</div></div>}{busy && <article className="tutor"><small>NEBA TUTOR</small><p className="ld-tutor-thinking"><LoaderCircle size={15} /> Working through the method…</p></article>}</div>{error && <p className="ld-tutor-error"><CircleAlert size={15} /> {error}</p>}<form onSubmit={ask}><textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about a concept or paste the question you are working on…" rows={3} disabled={busy} /><button type="submit" disabled={!question.trim() || !paperId || busy} aria-label="Ask Neba Tutor">{busy ? <LoaderCircle size={18} /> : <ArrowUp size={18} />}</button><small><Sparkles size={12} /> Check important answers against your teacher or official materials.</small></form></div>
    </section></div></main>;
}

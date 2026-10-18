"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BrainCircuit, ClipboardList, Clock3, FileQuestion, LoaderCircle, Sparkles, Target } from "lucide-react";
import { api } from "@/lib/api";
import { LearnNav } from "@/components/learn-nav";

type Paper = { id: string; name: string; topics: { id: string; name: string }[] };
type Exam = { id: string; name: string; slug: string; papers: Paper[] };
const options = [{ name: "Past Questions", copy: "Practice available past papers", icon: FileQuestion }, { name: "AI Practice", copy: "New exam-style questions", icon: Sparkles }, { name: "Mock Exam", copy: "Timed exam simulation", icon: Clock3 }, { name: "Exam Focus", copy: "Topic priorities and revision", icon: Target }];

export default function ExamWorkspacePage() {
  const { examSlug } = useParams<{ examSlug: string }>(); const [exam, setExam] = useState<Exam | null>(null);
  useEffect(() => { api<{ exams: Exam[] }>("/exam-buddy/catalog/").then((data) => setExam(data.exams.find((item) => item.slug === examSlug) || null)); }, [examSlug]);
  return <main className="learn-dashboard"><LearnNav /><div className="eb-shell">{!exam ? <div className="ld-loading"><LoaderCircle size={22} /> Opening your preparation space…</div> : <><Link className="eb-back" href="/learn/exam-prep"><ArrowLeft size={15} /> Exam Buddy</Link><section className="eb-workspace-head"><span className="ld-kicker">EXAM BUDDY / {exam.name}</span><h1>Your {exam.name}<br /><em>preparation.</em></h1><p>Choose a subject, practise questions, or take a mock exam.</p></section><section className="eb-next-step"><div><span className="ld-kicker">YOUR NEXT STEP</span><h2>Practice your weak areas.</h2><p>Spend time on the topics where you are getting questions wrong.</p></div><Link href="/learn/dashboard#exam-buddy">Practice weak areas <ArrowRight size={16} /></Link></section><section className="eb-subjects"><header><span>YOUR SUBJECTS &amp; PAPERS</span><small>Choose one to start</small></header><div>{exam.papers.map((paper) => <article key={paper.id}><span><ClipboardList size={19} /></span><div><strong>{paper.name}</strong><small>{paper.topics.length} topic{paper.topics.length === 1 ? "" : "s"} available</small></div><Link href="/learn/dashboard#exam-buddy"><ArrowRight size={17} /></Link></article>)}</div></section><section className="eb-options"><header><span>PRACTICE OPTIONS</span></header><div>{options.map(({ name, copy, icon: Icon }) => <Link href="/learn/dashboard#exam-buddy" key={name}><Icon size={20} /><strong>{name}</strong><small>{copy}</small><ArrowRight size={16} /></Link>)}</div></section><section className="eb-note"><BrainCircuit size={19} /><span>Exam Focus uses syllabus coverage, verified question patterns, and your own attempts. It does not predict an exact exam paper.</span></section></>}</div></main>;
}

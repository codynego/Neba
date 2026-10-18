"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ClipboardCheck, Clock3, LoaderCircle, Play, Target } from "lucide-react";
import { api } from "@/lib/api";
import { LearnNav } from "@/components/learn-nav";

type Goal = { id: number; exam: string; paper: { name: string; question_formats: string[]; topics: { name: string; syllabus_priority: number }[] }; exam_date: string | null; weekly_study_minutes: number };

export default function ExamPrepPage() {
  const [goals, setGoals] = useState<Goal[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => { api<{ goals: Goal[] }>("/exam-buddy/goals/").then((data) => setGoals(data.goals)).finally(() => setLoading(false)); }, []);
  return <main className="learn-dashboard"><LearnNav /><div className="ld-shell ld-subpage"><section className="ld-page-hero ld-prep-hero"><span className="ld-kicker"><ClipboardCheck size={14} /> EXAM PREP · EXAM BUDDY</span><h1>Practise for the<br /><em>exam ahead.</em></h1><p>Use verified questions, targeted revision, and timed practice. Exam Focus helps you prioritise—it does not predict an exact paper.</p></section>{loading ? <div className="ld-loading"><LoaderCircle size={22} /> Loading your exams…</div> : goals.length ? <section className="ld-prep-list">{goals.map((goal) => <article key={goal.id}><div className="ld-prep-icon"><Target size={21} /></div><div><small>{goal.exam}</small><h2>{goal.paper.name}</h2><p>{goal.paper.topics.length ? `Start with ${goal.paper.topics[0].name}, then build from there.` : "Start with a baseline practice session."}</p><span><Clock3 size={14} /> {goal.weekly_study_minutes} minutes planned each week</span></div><Link href="/learn/dashboard#exam-buddy"><Play size={15} fill="currentColor" /> Open Exam Buddy</Link></article>)}</section> : <section className="ld-empty-panel"><ClipboardCheck size={23} /><h2>Choose an exam to begin.</h2><p>Once you add a paper, Exam Buddy will create focused practice from verified questions.</p><Link href="/learn/dashboard#add-exam">Add an exam paper <ArrowRight size={15} /></Link></section>}</div></main>;
}

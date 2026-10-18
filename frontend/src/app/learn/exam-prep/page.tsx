"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ClipboardCheck, GraduationCap, LoaderCircle, Search } from "lucide-react";
import { api } from "@/lib/api";
import { LearnNav } from "@/components/learn-nav";

type Paper = { id: string; name: string; topics: { id: string; name: string }[] };
type Exam = { id: string; name: string; slug: string; category: string; description: string; papers: Paper[] };
type Goal = { id: number; exam: string; paper: { name: string; topics: { name: string }[] } };
const labels: Record<string, string> = { school: "Secondary school", university: "Course-based revision", professional: "ICAN, ACCA and more", international: "International qualification" };

export default function ExamPrepPage() {
  const [exams, setExams] = useState<Exam[]>([]); const [goals, setGoals] = useState<Goal[]>([]); const [query, setQuery] = useState(""); const [loading, setLoading] = useState(true);
  useEffect(() => { Promise.all([api<{ exams: Exam[] }>("/exam-buddy/catalog/"), api<{ goals: Goal[] }>("/exam-buddy/goals/")]).then(([catalog, learnerGoals]) => { setExams(catalog.exams); setGoals(learnerGoals.goals); }).finally(() => setLoading(false)); }, []);
  const visible = useMemo(() => exams.filter((exam) => `${exam.name} ${exam.description} ${exam.papers.map((paper) => paper.name).join(" ")}`.toLowerCase().includes(query.trim().toLowerCase())), [exams, query]);
  return <main className="learn-dashboard"><LearnNav /><div className="eb-shell"><section className="eb-intro"><span className="ld-kicker"><ClipboardCheck size={14} /> EXAM BUDDY</span><h1>Prepare smarter.<br /><em>Know what to work on next.</em></h1><p>Find your examination, choose your papers, and start a focused practice session when you are ready.</p><label className="eb-search"><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search exams, subjects or courses…" aria-label="Search exams, subjects or courses" /></label></section>{loading ? <div className="ld-loading"><LoaderCircle size={22} /> Loading exams…</div> : <><section className="eb-section"><header><span>POPULAR EXAMS</span><small>Choose an exam to begin</small></header>{visible.length ? <div className="eb-exam-grid">{visible.map((exam) => <Link href={`/learn/exam-prep/${exam.slug}`} key={exam.id}><span><GraduationCap size={20} /></span><div><strong>{exam.name}</strong><small>{labels[exam.category] || exam.category}</small></div><ArrowRight size={17} /></Link>)}</div> : <div className="eb-no-results">No exams match that search yet.</div>}</section>{goals.length > 0 && <section className="eb-continue"><header><div><span className="ld-kicker">CONTINUE PREPARING</span><h2>Pick up where you stopped.</h2></div></header><div>{goals.map((goal) => <Link key={goal.id} href={`/learn/exam-prep/${exams.find((exam) => exam.name === goal.exam)?.slug || ""}`}><span><GraduationCap size={18} /></span><div><strong>{goal.paper.name}</strong><small>{goal.exam} · {goal.paper.topics[0]?.name || "Practice"}</small></div><b>Continue <ArrowRight size={15} /></b></Link>)}</div></section>}</>}</div></main>;
}

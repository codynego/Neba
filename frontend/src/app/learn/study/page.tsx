"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, CircleAlert, LoaderCircle, Target } from "lucide-react";
import { api } from "@/lib/api";
import { LearnNav } from "@/components/learn-nav";

type Paper = { id: string; name: string; code: string; question_formats: string[]; topics: { id: string; name: string; syllabus_priority: number }[] };
type Exam = { id: string; name: string; category: string; papers: Paper[] };

export default function StudyPage() {
  const [exams, setExams] = useState<Exam[]>([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  useEffect(() => { api<{ exams: Exam[] }>("/exam-buddy/catalog/").then((data) => setExams(data.exams)).catch((err) => setError((err as Error).message)).finally(() => setLoading(false)); }, []);
  return <main className="learn-dashboard"><LearnNav /><div className="ld-shell ld-subpage"><section className="ld-page-hero"><span className="ld-kicker"><BookOpen size={14} /> STUDY</span><h1>Choose a topic.<br /><em>Start small.</em></h1><p>Study is where your subjects and topics live. Use it to find what you are working on, then use Exam Prep when you are ready to practise.</p></section>{loading ? <div className="ld-loading"><LoaderCircle size={22} /> Loading study materials…</div> : error ? <div className="ld-error"><CircleAlert size={17} /> {error}</div> : exams.length ? <section className="ld-study-grid">{exams.map((exam) => <article className="ld-study-exam" key={exam.id}><header><small>{exam.category.replaceAll("_", " ")}</small><h2>{exam.name}</h2></header>{exam.papers.map((paper) => <div className="ld-study-paper" key={paper.id}><div><strong>{paper.name}</strong><span>{paper.topics.length} topics · {paper.question_formats.map((format) => format.replaceAll("_", " ")).join(", ") || "Study materials"}</span><div className="ld-topic-chips">{paper.topics.slice(0, 4).map((topic) => <span key={topic.id}>{topic.name}</span>)}</div></div><Link href="/learn/exam-prep">Practise <ArrowRight size={15} /></Link></div>)}</article>)}</section> : <section className="ld-empty-panel"><Target size={23} /><h2>Your subjects will appear here.</h2><p>Study materials become available when a verified syllabus and paper have been added.</p><Link href="/learn/dashboard">Return home <ArrowRight size={15} /></Link></section>}</div></main>;
}

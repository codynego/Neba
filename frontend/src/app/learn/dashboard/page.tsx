"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpenCheck, CalendarDays, Check, ChevronRight, CircleAlert, Clock3, GraduationCap, LoaderCircle, Play, Sparkles, Target, Trophy } from "lucide-react";
import { api } from "@/lib/api";
import { LearnNav } from "@/components/learn-nav";

type Topic = { id: string; name: string; syllabus_priority: number };
type Paper = { id: string; name: string; code: string; duration_minutes: number | null; maximum_score: number | null; question_formats: string[]; topics: Topic[] };
type Exam = { id: string; name: string; slug: string; category: string; description: string; papers: Paper[] };
type Goal = { id: number; exam: string; paper: Paper; exam_date: string | null; weekly_study_minutes: number };
type PracticeQuestion = { id: string; topic: string | null; format: string; difficulty: number; prompt: string; options: { id: string; text: string }[]; marks: number; answered: boolean; answer?: Record<string, unknown>; correct?: boolean; correct_answer?: Record<string, unknown>; explanation?: string };
type PracticeSession = { id: string; exam: string; paper: string; mode: string; status: string; questions: PracticeQuestion[]; summary: { total: number; answered: number; correct: number; accuracy: number | null; topic_focus: { topic: string; accuracy: number; attempts: number }[] } };

const categoryLabels: Record<string, string> = { school: "School / entrance", university: "University", professional: "Professional", international: "International" };

export default function LearnDashboardPage() {
  const [catalog, setCatalog] = useState<Exam[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [examId, setExamId] = useState("");
  const [paperId, setPaperId] = useState("");
  const [examDate, setExamDate] = useState("");
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [answering, setAnswering] = useState(false);

  const selectedExam = useMemo(() => catalog.find((exam) => exam.id === examId), [catalog, examId]);
  const selectedPaper = useMemo(() => selectedExam?.papers.find((paper) => paper.id === paperId), [selectedExam, paperId]);
  const todayGoal = goals[0];
  const todayTopic = todayGoal?.paper.topics.slice().sort((a, b) => b.syllabus_priority - a.syllabus_priority)[0];

  const load = async () => {
    setLoading(true); setError("");
    try {
      const [catalogResponse, goalsResponse] = await Promise.all([api<{ exams: Exam[] }>("/exam-buddy/catalog/"), api<{ goals: Goal[] }>("/exam-buddy/goals/")]);
      setCatalog(catalogResponse.exams); setGoals(goalsResponse.goals);
      const firstExam = catalogResponse.exams[0];
      if (firstExam) { setExamId(firstExam.id); setPaperId(firstExam.papers[0]?.id || ""); }
    } catch (err) { setError((err as Error).message || "We could not load your study space."); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const chooseExam = (value: string) => { const exam = catalog.find((item) => item.id === value); setExamId(value); setPaperId(exam?.papers[0]?.id || ""); };
  const saveGoal = async () => {
    if (!paperId) return;
    setSaving(true); setError("");
    try {
      await api<Goal>("/exam-buddy/goals/", { method: "POST", body: JSON.stringify({ paper_id: paperId, exam_date: examDate || null, weekly_study_minutes: 180 }) });
      await load();
    } catch (err) { setError((err as Error).message || "We could not add that exam."); }
    finally { setSaving(false); }
  };
  const startPractice = async (goal: Goal, topic?: Topic) => {
    setStarting(goal.paper.id); setError("");
    try {
      const result = await api<PracticeSession>("/exam-buddy/practice/", { method: "POST", body: JSON.stringify({ paper_id: goal.paper.id, mode: topic ? "revision" : "practice", question_count: 5, ...(topic ? { topic_ids: [topic.id] } : {}) }) });
      setSession(result);
    } catch (err) { setError((err as Error).message || "No practice session could be created yet."); }
    finally { setStarting(null); }
  };
  const answer = async (question: PracticeQuestion, optionId: string) => {
    if (!session || answering || question.answered) return;
    setAnswering(true);
    try {
      await api(`/exam-buddy/practice/${session.id}/answer/`, { method: "POST", body: JSON.stringify({ question_id: question.id, answer: { option_id: optionId } }) });
      const refreshed = await api<PracticeSession>(`/exam-buddy/practice/${session.id}/`);
      setSession(refreshed);
    } catch (err) { setError((err as Error).message || "Your answer was not saved."); }
    finally { setAnswering(false); }
  };

  if (loading) return <main className="learn-dashboard"><div className="ld-loading"><LoaderCircle size={23} /><span>Opening your study space…</span></div></main>;

  return <main className="learn-dashboard">
    <LearnNav />
    <div className="ld-shell">
      <section className="ld-welcome"><div><span className="ld-kicker"><Sparkles size={14} /> YOUR NEXT STUDY STEP</span><h1>Make this session<br /><em>count.</em></h1><p>{todayGoal ? `Your plan is set for ${todayGoal.exam}. Start with one focused session rather than trying to cover everything at once.` : "Choose an exam paper and Neba will start shaping your study space around it."}</p></div><div className="ld-date"><CalendarDays size={18} /><span>{new Intl.DateTimeFormat("en-NG", { weekday: "long", month: "long", day: "numeric" }).format(new Date())}</span></div></section>

      {error && <div className="ld-error" role="alert"><CircleAlert size={17} /><span>{error}</span><button type="button" onClick={() => setError("")}>Dismiss</button></div>}

      {todayGoal ? <section className="ld-focus-ribbon" aria-labelledby="today-focus-title"><div className="ld-ribbon-path" aria-hidden="true"><i /><i /><i /></div><div className="ld-focus-copy"><span className="ld-kicker">TODAY’S FOCUS</span><h2 id="today-focus-title">{todayTopic?.name || todayGoal.paper.name}</h2><p>{todayTopic ? `${todayGoal.paper.name} · High syllabus priority` : `${todayGoal.paper.name} · Start with a short baseline session`}</p></div><div className="ld-focus-meta"><span><Clock3 size={15} /> 15 min</span><span><Target size={15} /> {todayGoal.paper.question_formats[0]?.replaceAll("_", " ") || "Practice"}</span></div><button type="button" className="ld-start" onClick={() => void startPractice(todayGoal, todayTopic)} disabled={starting === todayGoal.paper.id}>{starting === todayGoal.paper.id ? <LoaderCircle size={17} /> : <Play size={17} fill="currentColor" />} {starting === todayGoal.paper.id ? "Preparing…" : "Start focus"}</button></section> : <section className="ld-empty-focus"><Target size={23} /><div><strong>Your first focus starts with an exam.</strong><span>Add a paper below. You can change it any time.</span></div><a href="#add-exam">Choose an exam <ArrowDown /></a></section>}

      <section className="ld-grid">
        <div className="ld-main-column"><section className="ld-panel" id="exam-buddy"><header><div><span className="ld-kicker">EXAM BUDDY</span><h2>Your exams, ready for practice.</h2></div><BookOpenCheck size={22} /></header>{goals.length ? <div className="ld-goal-list">{goals.map((goal) => <article key={goal.id} className="ld-goal"><div className="ld-goal-mark"><GraduationCap size={20} /></div><div><small>{goal.exam}</small><h3>{goal.paper.name}</h3><p>{goal.exam_date ? `Exam date: ${new Intl.DateTimeFormat("en-NG", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${goal.exam_date}T00:00:00`))}` : `${goal.weekly_study_minutes} minutes planned each week`}</p></div><button type="button" onClick={() => void startPractice(goal)} disabled={starting === goal.paper.id}>{starting === goal.paper.id ? <LoaderCircle size={16} /> : <>Practice <ChevronRight size={16} /></>}</button></article>)}</div> : <p className="ld-panel-empty">Your selected exam papers will appear here with targeted practice and mock sessions.</p>}</section>
        {session && <PracticeCard session={session} answering={answering} onAnswer={answer} onClose={() => setSession(null)} />}</div>
        <aside className="ld-side-column"><section className="ld-panel ld-exam-picker" id="add-exam"><header><div><span className="ld-kicker">BUILD YOUR PLAN</span><h2>Add an exam paper.</h2></div></header>{catalog.length ? <><label>Exam<select value={examId} onChange={(event) => chooseExam(event.target.value)}>{catalog.map((exam) => <option key={exam.id} value={exam.id}>{exam.name}</option>)}</select></label><span className="ld-category">{selectedExam ? categoryLabels[selectedExam.category] || selectedExam.category : ""}</span><label>Paper or subject<select value={paperId} onChange={(event) => setPaperId(event.target.value)}>{selectedExam?.papers.map((paper) => <option key={paper.id} value={paper.id}>{paper.name}</option>)}</select></label><label>Exam date <small>Optional</small><input type="date" value={examDate} onChange={(event) => setExamDate(event.target.value)} /></label>{selectedPaper && <p className="ld-picker-note"><Check size={15} /> {selectedPaper.topics.length} syllabus topic{selectedPaper.topics.length === 1 ? "" : "s"} available</p>}<button type="button" className="ld-add-goal" disabled={!paperId || saving} onClick={() => void saveGoal()}>{saving ? <LoaderCircle size={16} /> : <ArrowRight size={16} />} {saving ? "Adding…" : "Add to my study plan"}</button></> : <div className="ld-no-catalog"><CircleAlert size={18} /><p>Exam content is being prepared. Return when a verified paper has been added.</p></div>}</section>
        <section className="ld-panel ld-principle"><span><Trophy size={20} /></span><h2>Progress is built in sessions.</h2><p>Exam Buddy will use your verified attempts to show the topics that deserve your time next.</p></section></aside>
      </section>
    </div>
  </main>;
}

function ArrowDown() { return <ArrowRight size={15} />; }

function PracticeCard({ session, answering, onAnswer, onClose }: { session: PracticeSession; answering: boolean; onAnswer: (question: PracticeQuestion, optionId: string) => void; onClose: () => void }) {
  const question = session.questions.find((item) => !item.answered) || session.questions.at(-1);
  if (!question) return null;
  return <section className="ld-practice-card" aria-live="polite"><header><div><span className="ld-kicker">PRACTICE IN PROGRESS</span><h2>{session.paper}</h2></div><button type="button" onClick={onClose}>Close</button></header><div className="ld-practice-progress"><span>{session.summary.answered} of {session.summary.total} answered</span><i><b style={{ width: `${(session.summary.answered / session.summary.total) * 100}%` }} /></i></div><small>{question.topic || "Practice question"} · {question.format.replaceAll("_", " ")}</small><h3>{question.prompt}</h3>{question.options.length ? <div className="ld-options">{question.options.map((option) => <button key={option.id} type="button" disabled={answering || question.answered} className={question.answered && (question.correct_answer as { option_id?: string })?.option_id === option.id ? "correct" : ""} onClick={() => onAnswer(question, option.id)}><b>{option.id.toUpperCase()}</b><span>{option.text}</span></button>)}</div> : <p className="ld-panel-empty">This question needs a written response workflow, which will be added with marking rubrics.</p>}{question.answered && <div className={question.correct ? "ld-feedback good" : "ld-feedback"}><strong>{question.correct ? "Correct." : "Review this one."}</strong><p>{question.explanation || "Your answer has been recorded."}</p></div>}</section>;
}

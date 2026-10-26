"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BarChart3, BookOpenCheck, CalendarDays, Check, ChevronLeft, ChevronRight, CircleAlert, Clock3, GraduationCap, LoaderCircle, Play, Sparkles, Target, Trophy } from "lucide-react";
import { api } from "@/lib/api";
import { LearnNav } from "@/components/learn-nav";

type Topic = { id: string; name: string; syllabus_priority: number };
type Paper = { id: string; name: string; code: string; duration_minutes: number | null; maximum_score: number | null; question_formats: string[]; topics: Topic[] };
type Exam = { id: string; name: string; slug: string; category: string; description: string; papers: Paper[] };
type Goal = { id: number; exam: string; paper: Paper; exam_date: string | null; weekly_study_minutes: number; target_score: number; preferred_session_minutes: number; study_days: string[] };
type Plan = Goal & { days_to_exam: number | null; weekly_progress_minutes: number; recommended_sessions: number; needs_diagnostic: boolean; topics: { id: string; name: string; mastery: number | null; attempts: number; priority_score: number; reason: string }[]; next_action: { topic_id: string; topic: string; reason: string; minutes: number; question_count: number } | null };
type PracticeQuestion = { id: string; position: number; topic: string | null; format: string; difficulty: number; prompt: string; options: { id: string; text: string }[]; marks: number; answered: boolean; answer?: Record<string, unknown>; correct?: boolean; correct_answer?: Record<string, unknown>; explanation?: string };
type PracticeSession = { id: string; exam: string; paper: string; mode: string; status: string; timer_seconds: number | null; time_remaining_seconds: number | null; questions: PracticeQuestion[]; summary: { total: number; answered: number; correct: number; accuracy: number | null; topic_focus: { topic: string; accuracy: number; attempts: number }[] } };
type LearnAccess = { tier: "free" | "plus"; limits: { daily_answers: number; weekly_mocks: number; daily_tutor_messages: number } | null; usage: { answers_today: number; mocks_this_week: number; tutor_messages_today: number } };

const categoryLabels: Record<string, string> = { school: "School / entrance", university: "University", professional: "Professional", international: "International" };
const studyDayOptions = [["mon", "M"], ["tue", "T"], ["wed", "W"], ["thu", "T"], ["fri", "F"], ["sat", "S"], ["sun", "S"]];

export default function LearnDashboardPage() {
  const [catalog, setCatalog] = useState<Exam[]>([]); const [goals, setGoals] = useState<Goal[]>([]); const [plans, setPlans] = useState<Plan[]>([]);
  const [access, setAccess] = useState<LearnAccess | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [saving, setSaving] = useState(false); const [starting, setStarting] = useState(false);
  const [examId, setExamId] = useState(""); const [paperId, setPaperId] = useState(""); const [examDate, setExamDate] = useState(""); const [weeklyMinutes, setWeeklyMinutes] = useState(180); const [targetScore, setTargetScore] = useState(75); const [sessionMinutes, setSessionMinutes] = useState(25); const [studyDays, setStudyDays] = useState<string[]>(["mon", "wed", "sat"]);
  const [session, setSession] = useState<PracticeSession | null>(null); const [questionIndex, setQuestionIndex] = useState(0); const [answering, setAnswering] = useState(false); const [remaining, setRemaining] = useState<number | null>(null); const [questionStartedAt, setQuestionStartedAt] = useState(Date.now());

  const selectedExam = useMemo(() => catalog.find((exam) => exam.id === examId), [catalog, examId]);
  const selectedPaper = useMemo(() => selectedExam?.papers.find((paper) => paper.id === paperId), [selectedExam, paperId]);
  const primaryPlan = plans[0];

  async function load() {
    setLoading(true); setError("");
    try {
      const [catalogResponse, goalsResponse, planResponse, accessResponse] = await Promise.all([api<{ exams: Exam[] }>("/exam-buddy/catalog/"), api<{ goals: Goal[] }>("/exam-buddy/goals/"), api<{ plans: Plan[] }>("/exam-buddy/plan/"), api<LearnAccess>("/exam-buddy/access/")]);
      setCatalog(catalogResponse.exams); setGoals(goalsResponse.goals); setPlans(planResponse.plans); setAccess(accessResponse);
      const firstExam = catalogResponse.exams[0]; if (firstExam && !examId) { setExamId(firstExam.id); setPaperId(firstExam.papers[0]?.id || ""); }
    } catch (err) { setError((err as Error).message || "Your study space could not be loaded."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (!session || session.status === "complete" || remaining === null) return; const timer = window.setInterval(() => setRemaining((value) => value === null ? null : Math.max(0, value - 1)), 1000); return () => window.clearInterval(timer); }, [session, remaining === null]);
  useEffect(() => { if (session?.mode === "mock" && remaining === 0 && session.status === "active") void completeSession(); }, [remaining]);

  function chooseExam(value: string) { const exam = catalog.find((item) => item.id === value); setExamId(value); setPaperId(exam?.papers[0]?.id || ""); }
  function toggleDay(day: string) { setStudyDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day]); }
  async function saveGoal() {
    if (!paperId) return; setSaving(true); setError("");
    try { await api<Goal>("/exam-buddy/goals/", { method: "POST", body: JSON.stringify({ paper_id: paperId, exam_date: examDate || null, weekly_study_minutes: weeklyMinutes, target_score: targetScore, preferred_session_minutes: sessionMinutes, study_days: studyDays }) }); await load(); }
    catch (err) { setError((err as Error).message || "That exam could not be added."); }
    finally { setSaving(false); }
  }
  async function startPractice(goal: Goal | Plan, mode = "practice", topicId?: string, questionCount?: number) {
    setStarting(true); setError("");
    try {
      const result = await api<PracticeSession>("/exam-buddy/practice/", { method: "POST", body: JSON.stringify({ paper_id: goal.paper.id, mode, ...(questionCount ? { question_count: questionCount } : {}), ...(topicId ? { topic_ids: [topicId] } : {}) }) });
      setSession(result); setQuestionIndex(0); setRemaining(result.time_remaining_seconds); setQuestionStartedAt(Date.now());
    } catch (err) { setError((err as Error).message || "No verified questions are available for this session yet."); }
    finally { setStarting(false); }
  }
  async function answer(question: PracticeQuestion, optionId: string) {
    if (!session || answering || question.answered) return; setAnswering(true);
    try {
      await api(`/exam-buddy/practice/${session.id}/answer/`, { method: "POST", body: JSON.stringify({ question_id: question.id, answer: { option_id: optionId }, response_seconds: Math.max(1, Math.round((Date.now() - questionStartedAt) / 1000)) }) });
      const refreshed = await api<PracticeSession>(`/exam-buddy/practice/${session.id}/`); setSession(refreshed);
      if (refreshed.mode === "mock" && questionIndex < refreshed.questions.length - 1) { setQuestionIndex(questionIndex + 1); setQuestionStartedAt(Date.now()); }
    } catch (err) { setError((err as Error).message || "Your answer was not saved."); }
    finally { setAnswering(false); }
  }
  async function completeSession() {
    if (!session) return; setAnswering(true);
    try { const result = await api<PracticeSession>(`/exam-buddy/practice/${session.id}/complete/`, { method: "POST" }); setSession(result); setRemaining(0); await load(); }
    catch (err) { setError((err as Error).message || "The session could not be completed."); }
    finally { setAnswering(false); }
  }

  if (loading) return <main className="learn-dashboard"><LearnNav /><div className="ld-loading"><LoaderCircle size={23} /><span>Opening your study space…</span></div></main>;
  const focus = primaryPlan?.next_action;
  return <main className="learn-dashboard"><LearnNav /><div className="ld-shell">
    <section className="ld-welcome"><div><span className="ld-kicker"><Sparkles size={14} /> YOUR NEXT STUDY STEP</span><h1>Make this session<br /><em>count.</em></h1><p>{primaryPlan ? `Your ${primaryPlan.exam} plan now responds to your syllabus coverage and every completed attempt.` : "Choose an exam paper and Neba will build a plan around your date, target, and available time."}</p></div><div className="ld-welcome-meta"><div className="ld-date"><CalendarDays size={18} /><span>{new Intl.DateTimeFormat("en-NG", { weekday: "long", month: "long", day: "numeric" }).format(new Date())}</span></div>{access && <a className="ld-tier" href="/pricing"><strong>{access.tier === "plus" ? "Learn Plus" : "Free plan"}</strong><span>{access.tier === "plus" ? "Unlimited practice" : `${Math.max(0, (access.limits?.daily_answers || 0) - access.usage.answers_today)} questions left today`}</span></a>}</div></section>
    {error && <div className="ld-error" role="alert"><CircleAlert size={17} /><span>{error}</span><button type="button" onClick={() => setError("")}>Dismiss</button></div>}
    {primaryPlan && focus ? <section className="ld-focus-ribbon"><div className="ld-ribbon-path" aria-hidden="true"><i /><i /><i /></div><div className="ld-focus-copy"><span className="ld-kicker">{primaryPlan.needs_diagnostic ? "START WITH A DIAGNOSTIC" : "TODAY’S FOCUS"}</span><h2>{primaryPlan.needs_diagnostic ? primaryPlan.paper.name : focus.topic}</h2><p>{primaryPlan.needs_diagnostic ? "A short baseline will replace guesswork with your own evidence." : focus.reason}</p></div><div className="ld-focus-meta"><span><Clock3 size={15} /> {focus.minutes} min</span><span><Target size={15} /> {primaryPlan.target_score}% target</span></div><button type="button" className="ld-start" onClick={() => void startPractice(primaryPlan, primaryPlan.needs_diagnostic ? "diagnostic" : "revision", primaryPlan.needs_diagnostic ? undefined : focus.topic_id, focus.question_count)} disabled={starting}>{starting ? <LoaderCircle size={17} /> : <Play size={17} fill="currentColor" />} {starting ? "Preparing…" : primaryPlan.needs_diagnostic ? "Start diagnostic" : "Start focus"}</button></section> : <section className="ld-empty-focus"><Target size={23} /><div><strong>Your first focus starts with an exam.</strong><span>Add a paper below. Neba will turn it into a weekly plan.</span></div><a href="#add-exam">Build my plan <ArrowRight size={15} /></a></section>}

    <section className="ld-grid"><div className="ld-main-column">
      {primaryPlan && <section className="ld-plan-board"><header><div><span className="ld-kicker">THIS WEEK</span><h2>Your plan has a reason.</h2></div><div className="ld-plan-progress"><strong>{Math.min(primaryPlan.weekly_progress_minutes, primaryPlan.weekly_study_minutes)}</strong><span>/ {primaryPlan.weekly_study_minutes} min</span></div></header><div className="ld-plan-line"><i><b style={{ width: `${Math.min(100, primaryPlan.weekly_progress_minutes / primaryPlan.weekly_study_minutes * 100)}%` }} /></i><small>{primaryPlan.recommended_sessions} focused sessions · {primaryPlan.days_to_exam === null ? "Add an exam date" : `${primaryPlan.days_to_exam} days to go`}</small></div><div className="ld-priority-list">{primaryPlan.topics.slice(0, 3).map((topic, index) => <button type="button" key={topic.id} onClick={() => void startPractice(primaryPlan, topic.attempts ? "revision" : "diagnostic", topic.id, Math.max(5, Math.floor(primaryPlan.preferred_session_minutes / 2)))}><b>0{index + 1}</b><span><strong>{topic.name}</strong><small>{topic.reason}</small></span><em>{topic.mastery === null ? "Check" : `${topic.mastery}%`}</em><ChevronRight size={16} /></button>)}</div></section>}
      <section className="ld-panel" id="exam-buddy"><header><div><span className="ld-kicker">EXAM BUDDY</span><h2>Your exams, ready for practice.</h2></div><BookOpenCheck size={22} /></header>{goals.length ? <div className="ld-goal-list">{goals.map((goal) => <article key={goal.id} className="ld-goal"><div className="ld-goal-mark"><GraduationCap size={20} /></div><div><small>{goal.exam}</small><h3>{goal.paper.name}</h3><p>{goal.exam_date ? `Exam: ${new Intl.DateTimeFormat("en-NG", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${goal.exam_date}T00:00:00`))}` : `${goal.weekly_study_minutes} minutes each week`}</p></div><div className="ld-goal-actions"><button type="button" onClick={() => void startPractice(goal, "practice", undefined, 10)} disabled={starting}>Practice</button><button type="button" className="quiet" onClick={() => void startPractice(goal, "mock")} disabled={starting}><Clock3 size={14} /> Mock</button></div></article>)}</div> : <p className="ld-panel-empty">Add your first exam to unlock a diagnostic, daily focus, practice, and mocks.</p>}</section>
      {session && <PracticeWorkspace session={session} index={questionIndex} remaining={remaining} answering={answering} onIndex={(index) => { setQuestionIndex(index); setQuestionStartedAt(Date.now()); }} onAnswer={answer} onComplete={completeSession} onClose={() => setSession(null)} />}
    </div><aside className="ld-side-column">
      <section className="ld-panel ld-exam-picker" id="add-exam"><header><div><span className="ld-kicker">BUILD YOUR PLAN</span><h2>Add an exam paper.</h2></div></header>{catalog.length ? <><label>Exam<select value={examId} onChange={(event) => chooseExam(event.target.value)}>{catalog.map((exam) => <option key={exam.id} value={exam.id}>{exam.name}</option>)}</select></label><span className="ld-category">{selectedExam ? categoryLabels[selectedExam.category] || selectedExam.category : ""}</span><label>Paper or subject<select value={paperId} onChange={(event) => setPaperId(event.target.value)}>{selectedExam?.papers.map((paper) => <option key={paper.id} value={paper.id}>{paper.name}</option>)}</select></label><label>Exam date <small>Optional</small><input type="date" value={examDate} onChange={(event) => setExamDate(event.target.value)} /></label><div className="ld-compact-fields"><label>Weekly minutes<input type="number" min="30" max="10080" value={weeklyMinutes} onChange={(event) => setWeeklyMinutes(Number(event.target.value))} /></label><label>Target score<input type="number" min="40" max="100" value={targetScore} onChange={(event) => setTargetScore(Number(event.target.value))} /></label></div><label>Session length<select value={sessionMinutes} onChange={(event) => setSessionMinutes(Number(event.target.value))}><option value="15">15 minutes</option><option value="25">25 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option></select></label><fieldset className="ld-study-days"><legend>Study days</legend>{studyDayOptions.map(([value, label], index) => <button type="button" key={`${value}-${index}`} className={studyDays.includes(value) ? "active" : ""} onClick={() => toggleDay(value)}>{label}</button>)}</fieldset>{selectedPaper && <p className="ld-picker-note"><Check size={15} /> {selectedPaper.topics.length} verified syllabus topic{selectedPaper.topics.length === 1 ? "" : "s"}</p>}<button type="button" className="ld-add-goal" disabled={!paperId || saving || !studyDays.length} onClick={() => void saveGoal()}>{saving ? <LoaderCircle size={16} /> : <ArrowRight size={16} />} {saving ? "Building…" : "Build my study plan"}</button></> : <div className="ld-no-catalog"><CircleAlert size={18} /><p>Exam content is being prepared. Add a verified paper in the content workspace first.</p></div>}</section>
      <section className="ld-panel ld-principle"><span><Trophy size={20} /></span><h2>Scores become next steps.</h2><p>Neba weighs your accuracy, attempts, target, and syllabus importance. Every recommendation tells you why it appeared.</p></section>
    </aside></section>
  </div></main>;
}

function PracticeWorkspace({ session, index, remaining, answering, onIndex, onAnswer, onComplete, onClose }: { session: PracticeSession; index: number; remaining: number | null; answering: boolean; onIndex: (index: number) => void; onAnswer: (question: PracticeQuestion, optionId: string) => void; onComplete: () => void; onClose: () => void }) {
  const question = session.questions[index]; if (!question) return null; const complete = session.status === "complete"; const minutes = remaining === null ? null : `${Math.floor(remaining / 60).toString().padStart(2, "0")}:${(remaining % 60).toString().padStart(2, "0")}`;
  return <section className={`ld-practice-card ${session.mode === "mock" ? "mock" : ""}`} aria-live="polite"><header><div><span className="ld-kicker">{complete ? "SESSION COMPLETE" : session.mode.replaceAll("_", " ").toUpperCase()}</span><h2>{session.paper}</h2></div><div className="ld-session-head-actions">{minutes && !complete && <strong className={remaining !== null && remaining < 300 ? "urgent" : ""}><Clock3 size={15} /> {minutes}</strong>}<button type="button" onClick={onClose}>Close</button></div></header>
    {complete ? <div className="ld-result"><span><Trophy size={24} /></span><div><small>YOUR RESULT</small><strong>{session.summary.accuracy ?? 0}%</strong><p>{session.summary.correct} correct from {session.summary.total} questions. Review the explanations, then let your updated plan choose the next topic.</p></div></div> : <div className="ld-question-map">{session.questions.map((item, itemIndex) => <button type="button" key={item.id} className={`${itemIndex === index ? "active" : ""} ${item.answered ? "answered" : ""}`} onClick={() => onIndex(itemIndex)}>{itemIndex + 1}</button>)}</div>}
    <div className="ld-practice-progress"><span>Question {index + 1} of {session.summary.total} · {session.summary.answered} answered</span><i><b style={{ width: `${session.summary.answered / session.summary.total * 100}%` }} /></i></div><small>{question.topic || "Practice question"} · {question.format.replaceAll("_", " ")}</small><h3>{question.prompt}</h3>{question.options.length ? <div className="ld-options">{question.options.map((option) => { const selected = (question.answer as { option_id?: string })?.option_id === option.id; const correctOption = (question.correct_answer as { option_id?: string })?.option_id === option.id; return <button key={option.id} type="button" disabled={answering || question.answered || complete} className={`${selected ? "selected" : ""} ${complete && correctOption ? "correct" : ""}`} onClick={() => onAnswer(question, option.id)}><b>{option.id.toUpperCase()}</b><span>{option.text}</span></button>; })}</div> : <p className="ld-panel-empty">Written-response marking will open when this paper has a reviewed rubric.</p>}{question.answered && question.explanation && session.mode !== "mock" && <div className={question.correct ? "ld-feedback good" : "ld-feedback"}><strong>{question.correct ? "Correct." : "Review this one."}</strong><p>{question.explanation}</p></div>}
    <footer className="ld-session-footer"><button type="button" disabled={index === 0} onClick={() => onIndex(index - 1)}><ChevronLeft size={15} /> Previous</button>{index < session.questions.length - 1 ? <button type="button" onClick={() => onIndex(index + 1)}>Next <ChevronRight size={15} /></button> : !complete && <button type="button" className="finish" disabled={answering} onClick={onComplete}><BarChart3 size={15} /> Finish and score</button>}</footer>
  </section>;
}

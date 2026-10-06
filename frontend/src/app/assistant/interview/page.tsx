"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Clock3, Mic, MicOff, RotateCcw, Sparkles, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Opportunity } from "@/lib/types";

type Phase = "setup" | "live" | "report";
type InterviewReport = {
  overall_score: number;
  summary: string;
  dimensions: { name: string; score: number; note: string }[];
  strengths: { name: string; score: number; note: string }[];
  improvements: { name: string; score: number; note: string; practice_question: string }[];
  readiness: { score: number; before_score: number; ready_signals: string[]; gaps: string[]; note: string };
  moments: { label: string; question: string; answer_excerpt: string; assessment: string }[];
  question_reviews: { question: string; score: number; label: string; analysis: string; better_approach: string }[];
  next_steps: { title: string; description: string }[];
};

const questions = [
  "Tell me about yourself and what you have been building recently.",
  "What is a difficult problem you have solved, and how did you decide what to do?",
  "Tell me about a time something did not go to plan. What did you learn?",
  "What would you want to accomplish in your first few months in this opportunity?",
];

const focusLabels: Record<string, string> = { general: "General", behavioral: "Behavioral", experience: "Experience", technical: "Technical", role: "Role-specific" };

function formatSeconds(seconds: number) { return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }

export default function InterviewPracticePage() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [focus, setFocus] = useState("role");
  const [difficulty, setDifficulty] = useState("realistic");
  const [duration, setDuration] = useState("10");
  const [targetRole, setTargetRole] = useState("");
  const [targetCompany, setTargetCompany] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [answers, setAnswers] = useState<string[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const [aiMessage, setAiMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(questions[0]);
  const [answerQuestions, setAnswerQuestions] = useState<string[]>([]);
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("opportunity");
    if (id) api<Opportunity>(`/opportunities/${id}/`).then(setOpportunity).catch(() => {});
  }, []);

  useEffect(() => {
    if (phase !== "live") return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  const hasVoice = typeof window !== "undefined" && Boolean(navigator.mediaDevices) && typeof MediaRecorder !== "undefined";

  async function startInterview() {
    if (!opportunity && !targetRole.trim()) { setError("Add the role you want to practise for."); return; }
    setPhase("live"); setQuestionIndex(0); setAnswers([]); setAnswerQuestions([]); setReport(null); setAnswer(""); setSeconds(0); setError(""); setAiMessage("");
    try {
      const result = await api<{ question: string }>("/ai/interview/text/", { method: "POST", body: JSON.stringify({ action: "start", focus, difficulty, opportunity_context: opportunity ? { title: opportunity.title, provider: opportunity.provider, summary: opportunity.summary, eligibility: opportunity.eligibility_notes, benefit: opportunity.benefit } : { role: targetRole.trim(), company: targetCompany.trim() || "Not specified" } }) });
      setQuestionIndex(0); setAiMessage(""); setAnswer(""); setCurrentQuestion(result.question);
    } catch (startError) { console.error("Text interview session failed", startError); setError("We couldn’t start the interview. Please try again."); }
  }
  async function startListening() {
    if (transcribing || listening) return;
    if (!navigator.mediaDevices || typeof MediaRecorder === "undefined") { setError("Voice input is not available in this browser. Type your answer below instead."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, preferredType ? { mimeType: preferredType } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop()); recordingStreamRef.current = null; setListening(false); setTranscribing(true); setError("");
        try {
          const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
          const form = new FormData(); form.append("file", blob, recorder.mimeType.includes("mp4") ? "answer.mp4" : "answer.webm");
          const result = await api<{ text: string }>("/ai/interview/transcribe/", { method: "POST", body: form });
          setAnswer((value) => `${value}${value.trim() ? " " : ""}${result.text}`.trim());
        } catch (transcriptionError) { console.error("Voice transcription failed", transcriptionError); setError("We couldn’t transcribe that recording. You can type your answer instead."); }
        finally { setTranscribing(false); }
      };
      recordingStreamRef.current = stream; recorderRef.current = recorder; recorder.start(); setListening(true); setError("");
    } catch (voiceError) { console.error("Microphone access failed", voiceError); setError("Microphone access was not granted. You can type your answer instead."); }
  }
  function stopListening() { if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop(); }
  async function submitAnswer() {
    if (!answer.trim() || busy) { if (!answer.trim()) setError("Add an answer before continuing."); return; }
    stopListening(); setBusy(true); setError("");
    const submittedAnswer = answer.trim();
    try {
      const result = await api<{ feedback: string; question: string }>("/ai/interview/text/", { method: "POST", body: JSON.stringify({ action: "answer", answer: submittedAnswer, focus, difficulty, history: answers.map((item, index) => ({ question: index === 0 ? currentQuestion : questions[index % questions.length], answer: item })), opportunity_context: opportunity ? { title: opportunity.title, provider: opportunity.provider, summary: opportunity.summary, eligibility: opportunity.eligibility_notes, benefit: opportunity.benefit } : { role: targetRole.trim(), company: targetCompany.trim() || "Not specified" } }) });
      setAnswers((items) => [...items, submittedAnswer]); setAnswerQuestions((items) => [...items, currentQuestion]); setAnswer(""); setAiMessage(result.feedback); setCurrentQuestion(result.question); setQuestionIndex((value) => value + 1);
    } catch (submitError) { console.error("Text interview answer failed", submitError); setError("Your answer could not be evaluated. Please try again."); }
    finally { setBusy(false); }
  }
  function closeInterview() { stopListening(); recordingStreamRef.current?.getTracks().forEach((track) => track.stop()); recordingStreamRef.current = null; }
  async function endInterview() {
    if (!answers.length || reportBusy) { if (!answers.length) setError("Answer at least one question before ending the interview."); return; }
    closeInterview(); setReportBusy(true); setError("");
    try {
      const result = await api<InterviewReport>("/ai/interview/report/", { method: "POST", body: JSON.stringify({ focus, difficulty, answers: answers.map((item, index) => ({ question: answerQuestions[index] || questions[index % questions.length], answer: item })), opportunity_context: opportunity ? { title: opportunity.title, provider: opportunity.provider, summary: opportunity.summary, eligibility: opportunity.eligibility_notes, benefit: opportunity.benefit } : { role: targetRole.trim(), company: targetCompany.trim() || "Not specified" } }) });
      setReport(result); setPhase("report");
    } catch (reportError) { console.error("Interview report failed", reportError); setError("The interview ended, but its debrief could not be generated. Please try again."); }
    finally { setReportBusy(false); }
  }
  function reset() { closeInterview(); setPhase("setup"); setAnswers([]); setAnswerQuestions([]); setReport(null); setQuestionIndex(0); setCurrentQuestion(questions[0]); setSeconds(0); setAnswer(""); setAiMessage(""); }

  if (phase === "setup") return <main className="interview-page container"><Link className="back-link" href="/assistant"><ArrowLeft size={15} /> Practice workspace</Link><header className="interview-header"><div><span className="eyebrow"><Sparkles size={13} /> AI INTERVIEW PRACTICE</span><h1>Practice like<br /><em>it is the real thing.</em></h1><p>Speak naturally. Work through realistic questions, then leave with a clearer idea of what to strengthen.</p></div><div className="interview-header-mark"><span>●</span><small>TEXT<br />PRACTICE</small></div></header><section className="interview-setup-card"><div className="interview-context"><span className="eyebrow">WHAT ARE YOU PREPARING FOR?</span>{opportunity ? <><h2>{opportunity.title}</h2><p>{opportunity.provider} · {opportunity.location_label || (opportunity.is_remote ? "Remote" : "Open location")}</p><span className="interview-context-note">Your practice will use this opportunity as context.</span></> : <><h2>Build your interview target</h2><p>Give the interviewer a role and company so the questions feel like a real hiring conversation.</p><span className="interview-context-note">You can practise for a real opening or simulate one.</span><div className="interview-target-fields"><label><span>Role or position <b>*</b></span><input value={targetRole} onChange={(event) => setTargetRole(event.target.value)} placeholder="e.g. Product Designer" /></label><label><span>Company</span><input value={targetCompany} onChange={(event) => setTargetCompany(event.target.value)} placeholder="e.g. Flutterwave" /></label></div></>}</div><div className="interview-options"><label><span>Interview focus</span><select value={focus} onChange={(event) => setFocus(event.target.value)}>{Object.entries(focusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>Difficulty</span><select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="realistic">Realistic</option><option value="challenging">Challenging</option><option value="very-challenging">Very challenging</option></select></label><label><span>Duration</span><select value={duration} onChange={(event) => setDuration(event.target.value)}><option value="10">10 minutes</option><option value="20">20 minutes</option><option value="30">30 minutes</option></select></label></div><button className="button button-dark" onClick={startInterview}>Start interview <ArrowRight size={16} /></button></section><section className="interview-promise"><div><Clock3 size={18} /><span><strong>Pressure, with purpose.</strong><small>The interviewer will ask follow-ups, challenge vague answers, and probe for evidence at higher difficulties.</small></span></div><div><Mic size={18} /><span><strong>Speak or type.</strong><small>Voice input converts your answer to text in supported browsers. Nothing is streamed live.</small></span></div></section></main>;

  if (phase === "report" && report) return <main className="interview-page interview-report container"><Link className="back-link" href="/assistant"><ArrowLeft size={15} /> Practice workspace</Link><header className="report-header"><span className="eyebrow"><Check size={13} /> INTERVIEW DEBRIEF</span><h1>Make the feedback<br /><em>useful.</em></h1><p>{opportunity ? `Debrief for ${opportunity.title} at ${opportunity.provider}.` : `Debrief for ${targetRole}${targetCompany ? ` at ${targetCompany}` : ""}.`} Completed in {formatSeconds(seconds)}.</p></header><section className="report-score-card"><div className="report-score"><strong>{report.overall_score}</strong><span>/ 100<br />overall performance</span></div><div><span className="eyebrow">OVERALL PERFORMANCE</span><h2>{report.summary}</h2><p>Scored against a {difficulty.replace("-", " ")} hiring bar, based on the answers you actually gave.</p></div></section><section className="report-dimensions"><div className="interview-section-heading"><div><span className="eyebrow">PERFORMANCE DIMENSIONS</span><h2>What the interview measured</h2></div></div>{report.dimensions.map((item) => <article key={item.name}><div><strong>{item.name}</strong><p>{item.note}</p></div><b>{item.score}</b></article>)}</section><section className="report-grid"><article><span className="eyebrow">STRONGEST AREAS</span>{report.strengths.map((item) => <div className="report-insight" key={item.name}><strong>{item.name} <b>{item.score}</b></strong><p>{item.note}</p></div>)}</article><article><span className="eyebrow">AREAS TO IMPROVE</span>{report.improvements.map((item) => <div className="report-insight" key={item.name}><strong>{item.name} <b>{item.score}</b></strong><p>{item.note}</p><small>Practice: “{item.practice_question}”</small></div>)}</article></section><section className="readiness-card"><div><span className="eyebrow">OPPORTUNITY READINESS</span><h2>{report.readiness.score}% ready for this interview</h2><p>{report.readiness.note}</p></div><div className="readiness-meter"><span>Before practice <b>{report.readiness.before_score}%</b></span><i><em style={{ width: `${Math.min(100, report.readiness.score)}%` }} /></i><span>After this session <b>{report.readiness.score}%</b></span></div><div className="readiness-signals"><div><strong>Signals you showed</strong>{report.readiness.ready_signals.map((item) => <span key={item}>✓ {item}</span>)}</div><div><strong>Still to strengthen</strong>{report.readiness.gaps.map((item) => <span key={item}>△ {item}</span>)}</div></div></section><section className="report-moments"><div className="interview-section-heading"><div><span className="eyebrow">KEY MOMENTS</span><h2>Where the interview turned</h2></div></div>{report.moments.map((moment) => <article key={`${moment.label}-${moment.question}`}><span className="eyebrow">{moment.label}</span><strong>{moment.question}</strong><p>“{moment.answer_excerpt}”</p><small>{moment.assessment}</small></article>)}</section><section className="report-answers"><div className="interview-section-heading"><div><span className="eyebrow">QUESTION-BY-QUESTION</span><h2>How each answer landed</h2></div></div>{report.question_reviews.map((item, index) => <details className="report-review" key={`${item.question}-${index}`}><summary><span>0{index + 1}</span><div><strong>{item.question}</strong><small>{item.label}</small></div><b>{item.score}</b></summary><div><p>{item.analysis}</p><strong>Better approach</strong><p>{item.better_approach}</p></div></details>)}</section><section className="report-next-steps"><span className="eyebrow">RECOMMENDED NEXT STEPS</span><h2>Turn the debrief into practice.</h2><div>{report.next_steps.map((item, index) => <article key={item.title}><b>0{index + 1}</b><strong>{item.title}</strong><p>{item.description}</p></article>)}</div><button className="button button-dark" onClick={reset}>Practice again <RotateCcw size={15} /></button></section></main>;

  return <main className="interview-room"><div className="interview-room-top"><Link href="/assistant"><ArrowLeft size={15} /> Leave practice</Link><span>{opportunity?.title || "General interview"}</span><strong>{formatSeconds(seconds)}</strong></div><section className="interview-room-body"><div className="interviewer-orb"><span /><span /><span /></div><span className="eyebrow">{listening ? "LISTENING" : transcribing ? "TRANSCRIBING" : "YOUR TURN"}</span><h1>{currentQuestion}</h1><p className="interview-room-hint">{listening ? "Speak naturally. Tap Stop when you finish." : transcribing ? "Turning your answer into editable text…" : "Answer in your own words. A specific example is more useful than a perfect one."}</p>{aiMessage && <p className="interview-room-hint interview-feedback">{aiMessage}</p>}{error && <p className="error-box" role="alert">{error}</p>}<div className="interview-answer"><textarea value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Type your answer here…" rows={5} /><div className="interview-controls">{hasVoice && <button className={`voice-button${listening ? " active" : ""}`} onClick={listening ? stopListening : startListening} disabled={transcribing} aria-label={listening ? "Stop recording" : "Start voice input"}>{listening ? <MicOff size={20} /> : <Mic size={20} />}<span>{listening ? "Stop" : transcribing ? "Transcribing" : "Speak"}</span></button>}<button className="button button-dark" onClick={submitAnswer} disabled={busy || transcribing}>{busy ? "Thinking…" : "Continue"} {!busy && <ChevronRight size={16} />}</button></div></div><div className="interview-progress"><span>Question {questionIndex + 1}</span><div><i style={{ width: `${Math.min(100, ((questionIndex + 1) / questions.length) * 100)}%` }} /></div><button onClick={endInterview} disabled={reportBusy || busy || transcribing}><Square size={13} /> End interview</button></div></section></main>;
}

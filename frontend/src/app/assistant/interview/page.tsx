"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Clock3, Mic, MicOff, Pause, RotateCcw, Sparkles, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Opportunity } from "@/lib/types";

type Phase = "setup" | "live" | "report";
type RecognitionEvent = { results: { length: number; [index: number]: { [index: number]: { transcript: string } } } };
type Recognition = { continuous: boolean; interimResults: boolean; lang: string; onresult: ((event: RecognitionEvent) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void };
type RecognitionConstructor = new () => Recognition;

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
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [answers, setAnswers] = useState<string[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const recognitionRef = useRef<Recognition | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("opportunity");
    if (id) api<Opportunity>(`/opportunities/${id}/`).then(setOpportunity).catch(() => {});
  }, []);

  useEffect(() => {
    if (phase !== "live") return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  const currentQuestion = useMemo(() => questions[questionIndex % questions.length], [questionIndex]);
  const hasVoice = typeof window !== "undefined" && Boolean((window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }).SpeechRecognition || (window as Window & { webkitSpeechRecognition?: RecognitionConstructor }).webkitSpeechRecognition);

  function startInterview() { setPhase("live"); setQuestionIndex(0); setAnswers([]); setAnswer(""); setSeconds(0); setError(""); }
  function startListening() {
    const browserWindow = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
    const Constructor = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
    if (!Constructor) { setError("Voice input is not available in this browser. Type your answer below instead."); return; }
    const recognition = new Constructor(); recognition.continuous = true; recognition.interimResults = true; recognition.lang = "en-NG";
    recognition.onresult = (event) => { let transcript = ""; for (let index = 0; index < event.results.length; index += 1) transcript += event.results[index][0].transcript; setAnswer(transcript); };
    recognition.onend = () => setListening(false); recognitionRef.current = recognition; recognition.start(); setListening(true); setError("");
  }
  function stopListening() { recognitionRef.current?.stop(); setListening(false); }
  function submitAnswer() { if (!answer.trim()) { setError("Add an answer before continuing."); return; } stopListening(); setAnswers((items) => [...items, answer.trim()]); setAnswer(""); if (questionIndex + 1 >= questions.length) setPhase("report"); else setQuestionIndex((value) => value + 1); }
  function reset() { stopListening(); setPhase("setup"); setAnswers([]); setQuestionIndex(0); setSeconds(0); setAnswer(""); }

  if (phase === "setup") return <main className="interview-page container"><Link className="back-link" href="/assistant"><ArrowLeft size={15} /> Practice workspace</Link><header className="interview-header"><div><span className="eyebrow"><Sparkles size={13} /> AI INTERVIEW PRACTICE</span><h1>Practice like<br /><em>it is the real thing.</em></h1><p>Speak naturally. Work through realistic questions, then leave with a clearer idea of what to strengthen.</p></div><div className="interview-header-mark"><span>●</span><small>LIVE<br />PRACTICE</small></div></header><section className="interview-setup-card"><div className="interview-context"><span className="eyebrow">WHAT ARE YOU PREPARING FOR?</span>{opportunity ? <><h2>{opportunity.title}</h2><p>{opportunity.provider} · {opportunity.location_label || (opportunity.is_remote ? "Remote" : "Open location")}</p><span className="interview-context-note">Your practice will use this opportunity as context.</span></> : <><h2>A general opportunity interview</h2><p>Build confidence before your next application or conversation.</p><span className="interview-context-note">Start from an application to make practice opportunity-specific.</span></>}</div><div className="interview-options"><label><span>Interview focus</span><select value={focus} onChange={(event) => setFocus(event.target.value)}>{Object.entries(focusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>Difficulty</span><select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="realistic">Realistic</option><option value="challenging">Challenging</option><option value="very-challenging">Very challenging</option></select></label><label><span>Duration</span><select value={duration} onChange={(event) => setDuration(event.target.value)}><option value="10">10 minutes</option><option value="20">20 minutes</option><option value="30">30 minutes</option></select></label></div><button className="button button-dark" onClick={startInterview}>Start interview <ArrowRight size={16} /></button></section><section className="interview-promise"><div><Clock3 size={18} /><span><strong>No performance theatre.</strong><small>The interviewer asks follow-ups so you can practise thinking clearly, not memorising perfect answers.</small></span></div><div><Mic size={18} /><span><strong>Speak or type.</strong><small>Voice input works in supported browsers, with a text fallback whenever you need it.</small></span></div></section></main>;

  if (phase === "report") { const answered = answers.length; const clarity = Math.min(92, 52 + answered * 9); return <main className="interview-page interview-report container"><Link className="back-link" href="/assistant"><ArrowLeft size={15} /> Practice workspace</Link><header className="report-header"><span className="eyebrow"><Check size={13} /> INTERVIEW COMPLETE</span><h1>Good work. Now<br /><em>make it useful.</em></h1><p>Here is a first read on this practice session. Strong interviews get clearer with repetition.</p></header><section className="report-score-card"><div className="report-score"><strong>{clarity}</strong><span>/ 100<br />practice signal</span></div><div><span className="eyebrow">SESSION READOUT</span><h2>{answered >= 3 ? "You gave yourself enough room to think." : "You have a useful starting point."}</h2><p>{opportunity ? `Prepared for ${opportunity.title}.` : "Prepared for a general opportunity interview."} You answered {answered} of {questions.length} questions in {formatSeconds(seconds)}.</p></div></section><section className="report-grid"><article><span className="eyebrow">KEEP DOING</span><h2>Specific examples</h2><p>Grounding an answer in what you personally did makes your contribution easier to understand.</p></article><article><span className="eyebrow">PRACTICE NEXT</span><h2>Go one layer deeper</h2><p>After describing the action, explain the trade-off, decision, or result that followed.</p><button className="section-link" onClick={reset}>Practice again <RotateCcw size={15} /></button></article></section><section className="report-answers"><div className="interview-section-heading"><div><span className="eyebrow">YOUR ANSWERS</span><h2>What you said</h2></div><span>{answers.length} responses</span></div>{answers.map((item, index) => <div className="report-answer" key={`${item}-${index}`}><span>0{index + 1}</span><div><strong>{questions[index]}</strong><p>{item}</p></div></div>)}</section></main>; }

  return <main className="interview-room"><div className="interview-room-top"><Link href="/assistant"><ArrowLeft size={15} /> Leave practice</Link><span>{opportunity?.title || "General interview"}</span><strong>{formatSeconds(seconds)}</strong></div><section className="interview-room-body"><div className="interviewer-orb"><span /><span /><span /></div><span className="eyebrow">{listening ? "LISTENING" : "YOUR TURN"}</span><h1>{currentQuestion}</h1><p className="interview-room-hint">{listening ? "Take your time. I am listening for the detail behind your answer." : "Answer in your own words. A specific example is more useful than a perfect one."}</p>{error && <p className="error-box" role="alert">{error}</p>}<div className="interview-answer"><textarea value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Speak, or type your answer here…" rows={5} /><div className="interview-controls">{hasVoice && <button className={`voice-button${listening ? " active" : ""}`} onClick={listening ? stopListening : startListening} aria-label={listening ? "Stop listening" : "Start voice input"}>{listening ? <MicOff size={20} /> : <Mic size={20} />}<span>{listening ? "Stop" : "Speak"}</span></button>}<button className="button button-dark" onClick={submitAnswer}>Continue <ChevronRight size={16} /></button></div></div><div className="interview-progress"><span>Question {questionIndex + 1} of {questions.length}</span><div><i style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }} /></div><button onClick={() => setPhase("report")}><Square size={13} /> End interview</button></div></section></main>;
}

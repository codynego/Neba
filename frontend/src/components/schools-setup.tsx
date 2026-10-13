"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, CircleAlert, GraduationCap } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

const splitItems = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

export function SchoolsSetup() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [session, setSession] = useState("2026/2027");
  const [classes, setClasses] = useState("JSS 1");
  const [subjects, setSubjects] = useState("Mathematics, English");

  async function createSchool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      await api("/schools/setup/", { method: "POST", body: JSON.stringify({ name: schoolName, academic_session: session, classes: splitItems(classes), subjects: splitItems(subjects) }) });
      setStep(3);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not create your school. Try again.");
    } finally { setBusy(false); }
  }

  return <main className="school-setup-page"><header className="school-setup-header"><Link href="/schools"><GraduationCap size={22} /><strong>neba</strong><span>FOR SCHOOLS</span></Link><p>School setup</p></header><section className="school-setup-shell"><div className="school-setup-intro"><span>CREATE YOUR WORKSPACE</span><h1>Start with the school you know best.</h1><p>Neba will create a private school workspace and make you its first administrator. You can invite your academic team after this setup.</p><ol aria-label="School setup progress"><li className={step >= 1 ? "done" : ""}><b>{step > 1 ? <Check size={14} /> : "1"}</b><div><strong>School details</strong><small>Name the workspace and session.</small></div></li><li className={step >= 2 ? "done" : ""}><b>{step > 2 ? <Check size={14} /> : "2"}</b><div><strong>First learning context</strong><small>Add a class and subjects to begin.</small></div></li><li className={step >= 3 ? "done" : ""}><b>3</b><div><strong>Workspace ready</strong><small>Move into your school dashboard.</small></div></li></ol></div>
    <div className="school-setup-card">{step === 1 && <form onSubmit={(event) => { event.preventDefault(); setStep(2); }}><div className="school-setup-card-heading"><span>STEP 1 OF 2</span><h2>Name your school workspace.</h2><p>This is the name your team will see when they are invited.</p></div><label><span>School name</span><input value={schoolName} onChange={(event) => setSchoolName(event.target.value)} required autoFocus maxLength={180} placeholder="e.g. Bright Future College" /></label><label><span>Current academic session</span><input value={session} onChange={(event) => setSession(event.target.value)} required maxLength={40} placeholder="e.g. 2026/2027" /></label><button className="school-setup-button" type="submit">Continue <ArrowRight size={17} /></button></form>}{step === 2 && <form onSubmit={createSchool}><button className="school-setup-back" type="button" onClick={() => setStep(1)}><ArrowLeft size={16} /> Back</button><div className="school-setup-card-heading"><span>STEP 2 OF 2</span><h2>Add your first teaching context.</h2><p>Start small. You can add every other class and subject from your school settings later.</p></div><label><span>First class</span><input value={classes} onChange={(event) => setClasses(event.target.value)} maxLength={100} placeholder="e.g. JSS 1" /><small>Use commas to add more than one class.</small></label><label><span>Subjects taught in this class</span><input value={subjects} onChange={(event) => setSubjects(event.target.value)} maxLength={300} placeholder="e.g. Mathematics, English" /><small>Use commas to separate subjects.</small></label>{error && <p className="school-setup-error"><CircleAlert size={16} />{error}</p>}<button className="school-setup-button" disabled={busy} type="submit">{busy ? "Creating workspace..." : "Create school workspace"}<ArrowRight size={17} /></button></form>}{step === 3 && <div className="school-setup-complete"><span><Check size={25} /></span><div><small>YOUR WORKSPACE IS READY</small><h2>{schoolName} is set up.</h2><p>You are the first school administrator. Next, bring in the result sheet or invite the academic colleagues who will work with you.</p></div><button className="school-setup-button" onClick={() => router.push("/schools/dashboard")}>Open your workspace <ArrowRight size={17} /></button><Link href="/schools">Return to Neba for Schools</Link></div>}</div></section></main>;
}

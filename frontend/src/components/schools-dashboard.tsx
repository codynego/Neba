"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  ChevronRight,
  ClipboardCheck,
  FileSpreadsheet,
  FileText,
  FolderCog,
  GraduationCap,
  LayoutDashboard,
  Menu,
  Settings2,
  Sparkles,
  Upload,
  UsersRound,
  X,
} from "lucide-react";
import { api } from "@/lib/api";

type Page = "overview" | "intelligence" | "assessments" | "assistant" | "students" | "reports" | "staff" | "settings";
type SchoolWorkspace = { id: number; name: string; slug: string; role: string; classes_count: number; subjects_count: number; students_count: number };
type SchoolClass = { id: number; name: string; academic_session: string };
type Subject = { id: number; name: string; code: string };
type Student = { id: number; first_name: string; last_name: string; full_name: string; admission_number: string; school_class: number; class_name: string };
type Member = { id: number; name: string; email: string; role: string };
type Roster = { classes: SchoolClass[]; subjects: Subject[]; students: Student[]; members: Member[] };

const navigation: Array<{ id: Page; label: string; icon: typeof LayoutDashboard; group: "core" | "setup" }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, group: "core" },
  { id: "intelligence", label: "Academic intelligence", icon: BarChart3, group: "core" },
  { id: "assessments", label: "Assessments & results", icon: ClipboardCheck, group: "core" },
  { id: "assistant", label: "Teaching assistant", icon: Sparkles, group: "core" },
  { id: "students", label: "Students & classes", icon: UsersRound, group: "core" },
  { id: "reports", label: "Reports", icon: FileText, group: "core" },
  { id: "staff", label: "Staff & access", icon: UsersRound, group: "setup" },
  { id: "settings", label: "School settings", icon: Settings2, group: "setup" },
];

function EmptyPanel({ icon: Icon, eyebrow, title, copy, action, onAction }: { icon: typeof FileSpreadsheet; eyebrow: string; title: string; copy: string; action: string; onAction: () => void }) {
  return <article className="school-app-panel school-app-empty-panel"><span className="school-app-empty-icon"><Icon size={25} /></span><span>{eyebrow}</span><h3>{title}</h3><p>{copy}</p><button type="button" className="school-app-button primary" onClick={onAction}>{action}<ArrowRight size={16} /></button></article>;
}

function SetupStep({ number, icon: Icon, title, copy, action, onAction }: { number: string; icon: typeof FileSpreadsheet; title: string; copy: string; action: string; onAction: () => void }) {
  return <article className="school-app-setup-step"><span>{number}</span><Icon size={20} /><div><h3>{title}</h3><p>{copy}</p></div><button type="button" onClick={onAction}>{action}<ArrowRight size={15} /></button></article>;
}

export function SchoolsDashboard() {
  const [page, setPage] = useState<Page>("overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [workspace, setWorkspace] = useState<SchoolWorkspace | null | undefined>(undefined);
  const [roster, setRoster] = useState<Roster | undefined>(undefined);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([api<{ workspace: SchoolWorkspace | null }>("/schools/workspace/"), api<Roster>("/schools/roster/")])
      .then(([workspaceResult, rosterResult]) => { if (active) { setWorkspace(workspaceResult.workspace); setRoster(rosterResult); } })
      .catch(() => { if (active) setLoadError("We could not load your school workspace. Refresh the page to try again."); });
    return () => { active = false; };
  }, []);

  const selectPage = (next: Page) => { setPage(next); setMobileOpen(false); setNotice(""); };
  const pageName = navigation.find((item) => item.id === page)?.label || "Overview";
  const startImport = () => { selectPage("assessments"); setNotice("Assessment import is being prepared for your workspace. You can set up classes and subjects while it becomes available."); };

  const createRecord = async (payload: Record<string, string | number>) => {
    setSaving(true);
    try {
      await api("/schools/roster/", { method: "POST", body: JSON.stringify(payload) });
      const [workspaceResult, rosterResult] = await Promise.all([api<{ workspace: SchoolWorkspace | null }>("/schools/workspace/"), api<Roster>("/schools/roster/")]);
      setWorkspace(workspaceResult.workspace);
      setRoster(rosterResult);
      setNotice(payload.action === "student" ? "Student added to your school workspace." : `${payload.action === "class" ? "Class" : "Subject"} saved to your school workspace.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "That record could not be saved.");
    } finally { setSaving(false); }
  };

  if (workspace === undefined || roster === undefined) return <main className="school-app school-app-loading" aria-live="polite"><p>Loading your school workspace…</p></main>;
  if (loadError) return <main className="school-app school-app-loading"><div><h1>Your workspace could not be loaded.</h1><p>{loadError}</p><button className="school-app-button primary" type="button" onClick={() => window.location.reload()}>Try again</button></div></main>;
  if (workspace === null) return <main className="school-app school-app-loading"><div><span>NO SCHOOL WORKSPACE</span><h1>Set up your school to continue.</h1><p>Your Neba account is protected, but it is not connected to a school workspace yet.</p><Link className="school-app-button primary" href="/schools/setup">Set up your school <ArrowRight size={16} /></Link></div></main>;

  return <div className="school-app school-app-empty-workspace">
    <aside className={`school-app-sidebar${mobileOpen ? " open" : ""}`}>
      <div className="school-app-brand"><Link href="/schools" aria-label="Neba for Schools home"><GraduationCap size={24} /><span>neba</span></Link><b>FOR SCHOOLS</b><button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={19} /></button></div>
      <div className="school-app-school-switch"><span>SCHOOL WORKSPACE</span><strong>{workspace.name}</strong><ChevronRight size={15} /></div>
      <nav aria-label="Schools workspace navigation">
        <span className="school-app-nav-label">ACADEMIC WORKSPACE</span>
        {navigation.filter((item) => item.group === "core").map(({ id, label, icon: Icon }) => <button type="button" key={id} className={page === id ? "active" : ""} onClick={() => selectPage(id)}><Icon size={18} /><span>{label}</span></button>)}
        <span className="school-app-nav-label setup">SETUP</span>
        {navigation.filter((item) => item.group === "setup").map(({ id, label, icon: Icon }) => <button type="button" key={id} className={page === id ? "active" : ""} onClick={() => selectPage(id)}><Icon size={18} /><span>{label}</span></button>)}
      </nav>
      <div className="school-app-sidebar-bottom"><div><span>{workspace.role.replace("_", " ").toUpperCase()}</span><p>Your school workspace is private to approved members.</p></div><Link href="/schools">About Neba for Schools <ArrowUpRight size={14} /></Link></div>
    </aside>

    <section className="school-app-main">
      <header className="school-app-topbar"><button className="school-app-menu" type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={21} /></button><div><span>{workspace.name.toUpperCase()} <ChevronRight size={13} /> {pageName.toUpperCase()}</span><h1>{page === "overview" ? "Your academic workspace." : pageName}</h1></div><div className="school-app-top-actions"><Link href="/schools" className="school-app-top-link">Neba for Schools <ArrowUpRight size={14} /></Link></div></header>
      <div className="school-app-context"><span><i /> PRIVATE SCHOOL WORKSPACE</span><p>Only approved members of {workspace.name} can access this workspace.</p></div>
      <main className="school-app-content">{notice && <div className="school-app-notice" role="status">{notice}<button type="button" onClick={() => setNotice("")} aria-label="Dismiss"><X size={15} /></button></div>}{renderPage(workspace, roster)}</main>
    </section>
    {mobileOpen && <button className="school-app-backdrop" type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
  </div>;

  function renderPage(school: SchoolWorkspace, schoolRoster: Roster) {
    const roster = schoolRoster;
    if (page === "overview") return <>
      <section className="school-app-page-heading"><div><span>GET STARTED</span><h2>Start your school&apos;s academic workflow.</h2><p>{school.name} is ready. Begin with one assessment spreadsheet when your academic team is ready to review it.</p></div><button type="button" className="school-app-button primary" onClick={startImport}><Upload size={16} /> Prepare import</button></section>
      <section className="school-app-empty-stats" aria-label="School workspace setup summary"><article><span>CLASSES</span><strong>{school.classes_count}</strong><small>Managed in school settings</small></article><article><span>STUDENTS</span><strong>{school.students_count}</strong><small>Stored in this private workspace</small></article><article><span>SUBJECTS</span><strong>{school.subjects_count}</strong><small>Used to organise assessment results</small></article><article><span>LEARNING GAPS</span><strong>-</strong><small>Shown after topic mapping</small></article></section>
      <section className="school-app-first-steps"><header><div><span>YOUR FIRST WORKFLOW</span><h3>From result sheet to a better next lesson.</h3></div><FileSpreadsheet size={20} /></header><div><SetupStep number="01" icon={FolderCog} title="Review your school setup" copy="Your classes and subjects are private to this workspace. Add to them as your academic workflow grows." action="Open settings" onAction={() => selectPage("settings")} /><SetupStep number="02" icon={Upload} title="Prepare an assessment import" copy="Bring a current CSV or Excel result sheet for a class your academic team wants to review." action="Prepare import" onAction={startImport} /><SetupStep number="03" icon={BarChart3} title="Review the evidence" copy="Map scores to topics, let teachers check the signals, and plan a measured intervention." action="Explore intelligence" onAction={() => selectPage("intelligence")} /></div></section>
    </>;
    if (page === "intelligence") return <section className="school-app-page"><div className="school-app-page-heading"><div><span>ACADEMIC INTELLIGENCE</span><h2>Find the signal inside your own results.</h2><p>Learning gaps appear only after your school imports and reviews assessment data.</p></div></div><EmptyPanel icon={BarChart3} eyebrow="NO ASSESSMENT DATA" title="There are no learning gaps to review yet." copy="Import an assessment, map questions to topics, and confirm the results before Neba surfaces evidence for teachers to review." action="Import assessment results" onAction={startImport} /></section>;
    if (page === "assessments") return <section className="school-app-page"><div className="school-app-page-heading"><div><span>ASSESSMENTS & RESULTS</span><h2>Start with the result sheets you already use.</h2><p>Import, review, and map assessment results before they inform any teaching decision.</p></div></div><article className="school-app-panel school-app-import"><FileSpreadsheet size={26} /><h3>Prepare an assessment import</h3><p>Connect a school workspace first. Then you will be able to upload a CSV or Excel file, review missing marks, and map questions to learning topics.</p><button type="button" className="school-app-button primary" onClick={() => setNotice("School setup is required before an assessment file can be imported.")}>Set up school first <ArrowRight size={16} /></button><small>Assessment files are not uploaded from this screen yet.</small></article></section>;
    if (page === "assistant") return <section className="school-app-page"><div className="school-app-page-heading"><div><span>TEACHING ASSISTANT</span><h2>Prepare resources from reviewed learning evidence.</h2><p>Teaching materials will be created from a teacher&apos;s topic, class, and learning goal, then reviewed before classroom use.</p></div></div><EmptyPanel icon={Bot} eyebrow="NO REVIEWED LEARNING GAP" title="Choose an assessment topic first." copy="Once a teacher has reviewed a learning gap, they can create a targeted revision exercise, quiz, or lesson draft from that context." action="Go to assessments" onAction={() => selectPage("assessments")} /></section>;
    if (page === "students") return <section className="school-app-page"><div className="school-app-page-heading"><div><span>STUDENTS & CLASSES</span><h2>Keep each student&apos;s academic context together.</h2><p>Add student records to a class. These records stay within {school.name}.</p></div></div><section className="school-app-record-grid"><article className="school-app-panel school-app-record-form"><span>ADD A STUDENT</span><h3>Create a student record</h3>{roster.classes.length ? <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void createRecord({ action: "student", first_name: String(data.get("first_name") || ""), last_name: String(data.get("last_name") || ""), admission_number: String(data.get("admission_number") || ""), school_class: Number(data.get("school_class")) }); event.currentTarget.reset(); }}><label>First name<input name="first_name" required /></label><label>Last name<input name="last_name" required /></label><label>Admission number <small>Optional</small><input name="admission_number" /></label><label>Class<select name="school_class" required>{roster.classes.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.academic_session}</option>)}</select></label><button className="school-app-button primary" disabled={saving}>{saving ? "Saving…" : "Add student"}<ArrowRight size={15} /></button></form> : <p>Add a class in School settings before creating students.</p>}</article><article className="school-app-panel school-app-record-list"><header><div><span>STUDENT RECORDS</span><h3>{roster.students.length} active student{roster.students.length === 1 ? "" : "s"}</h3></div></header>{roster.students.length ? <div className="school-app-table student-table"><div className="table-head"><span>STUDENT</span><span>CLASS</span><span>ADMISSION NO.</span><span /></div>{roster.students.map((student) => <div className="school-app-table-row" key={student.id}><strong>{student.full_name}</strong><span>{student.class_name}</span><span>{student.admission_number || "—"}</span></div>)}</div> : <div className="school-app-empty"><UsersRound size={28} /><p>No student records yet. Add the first student using the form.</p></div>}</article></section></section>;
    if (page === "reports") return <section className="school-app-page"><div className="school-app-page-heading"><div><span>REPORTS</span><h2>Review the story behind a term&apos;s results.</h2><p>Report cards and class summaries will only be available after your team reviews the underlying assessment records.</p></div></div><EmptyPanel icon={FileText} eyebrow="NO REPORTS READY" title="Reports will appear after results are reviewed." copy="Neba will keep formal reporting separate from learning recommendations, so school leaders can review both before anything is published." action="Review assessments" onAction={() => selectPage("assessments")} /></section>;
    if (page === "staff") return <section className="school-app-page"><div className="school-app-page-heading"><div><span>STAFF & ACCESS</span><h2>Give each person the access their work needs.</h2><p>Add an existing Neba member to {school.name} and set their role. School data remains scoped to membership.</p></div></div><section className="school-app-record-grid"><article className="school-app-panel school-app-record-form"><span>ADD STAFF</span><h3>Add a Neba member</h3><form onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); void createRecord({ action: "member", email: String(data.get("email") || ""), role: String(data.get("role") || "teacher") }); event.currentTarget.reset(); }}><label>Neba account email<input type="email" name="email" required placeholder="teacher@school.edu" /></label><label>School role<select name="role"><option value="teacher">Teacher</option><option value="academic_head">Academic head</option><option value="admin">School admin</option></select></label><button className="school-app-button primary" disabled={saving}>{saving ? "Saving…" : "Add staff member"}<ArrowRight size={15} /></button></form><p>The person must already have a Neba account with this email address.</p></article><article className="school-app-panel school-app-record-list"><header><div><span>ACTIVE MEMBERS</span><h3>{roster.members.length} school member{roster.members.length === 1 ? "" : "s"}</h3></div></header>{roster.members.length ? <div className="school-app-table"><div className="table-head"><span>MEMBER</span><span>EMAIL</span><span>ROLE</span></div>{roster.members.map((member) => <div className="school-app-table-row" key={member.id}><strong>{member.name}</strong><span>{member.email || "—"}</span><span>{member.role.replace("_", " ")}</span></div>)}</div> : <div className="school-app-empty"><UsersRound size={28} /><p>No active school members yet.</p></div>}</article></section><section className="school-app-assignment-rule"><Settings2 size={20} /><div><h3>Teacher access is class and subject specific.</h3><p>Teacher assignments will be added when assessment workflows are enabled. School-wide record access remains protected by active membership today.</p></div></section></section>;
    return <section className="school-app-page"><div className="school-app-page-heading"><div><span>SCHOOL SETTINGS</span><h2>Set the foundation for your school workspace.</h2><p>Classes and subjects are available only to approved members of {school.name}.</p></div></div><section className="school-app-record-grid"><article className="school-app-panel school-app-record-form"><span>ACADEMIC STRUCTURE</span><h3>Add a class</h3><form onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); void createRecord({ action: "class", name: String(data.get("name") || ""), academic_session: String(data.get("academic_session") || "") }); event.currentTarget.reset(); }}><label>Class name<input name="name" placeholder="JSS 1" required /></label><label>Academic session<input name="academic_session" placeholder="2026/2027" required /></label><button className="school-app-button primary" disabled={saving}>{saving ? "Saving…" : "Save class"}<ArrowRight size={15} /></button></form><div className="school-app-chip-list">{roster.classes.map((item) => <span key={item.id}>{item.name} <small>{item.academic_session}</small></span>) || <p>No classes yet.</p>}</div></article><article className="school-app-panel school-app-record-form"><span>CURRICULUM</span><h3>Add a subject</h3><form onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); void createRecord({ action: "subject", name: String(data.get("name") || ""), code: String(data.get("code") || "") }); event.currentTarget.reset(); }}><label>Subject name<input name="name" placeholder="Mathematics" required /></label><label>Subject code <small>Optional</small><input name="code" placeholder="MTH" /></label><button className="school-app-button primary" disabled={saving}>{saving ? "Saving…" : "Save subject"}<ArrowRight size={15} /></button></form><div className="school-app-chip-list">{roster.subjects.map((item) => <span key={item.id}>{item.name}{item.code ? <small>{item.code}</small> : null}</span>) || <p>No subjects yet.</p>}</div></article></section></section>;
  }
}

"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  ChevronRight,
  ChevronDown,
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
type Student = { id: number; public_id?: string; student_id?: string; first_name: string; last_name: string; full_name: string; admission_number: string; school_class: number; class_name: string; address_line?: string; city?: string; state?: string; guardian_name?: string; guardian_phone?: string; guardian_email?: string };
type Member = { id: number; public_id?: string; name: string; email: string; role: string };
type Roster = { classes: SchoolClass[]; subjects: Subject[]; students: Student[]; members: Member[] };
type WorkspaceResponse = { workspace: SchoolWorkspace | null; workspaces: SchoolWorkspace[] };

const navigation: Array<{ id: Page; label: string; icon: typeof LayoutDashboard; group: "core" | "setup" }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, group: "core" },
  { id: "intelligence", label: "Academic intelligence", icon: BarChart3, group: "core" },
  { id: "assessments", label: "Assessments & results", icon: ClipboardCheck, group: "core" },
  { id: "assistant", label: "My classes", icon: Sparkles, group: "core" },
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
  const searchParams = useSearchParams();
  const pageFromSearch = (value: string | null): Page => navigation.some((item) => item.id === value) ? value as Page : "overview";
  const [page, setPage] = useState<Page>(() => pageFromSearch(searchParams.get("section")));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [workspace, setWorkspace] = useState<SchoolWorkspace | null | undefined>(undefined);
  const [workspaces, setWorkspaces] = useState<SchoolWorkspace[]>([]);
  const [roster, setRoster] = useState<Roster | undefined>(undefined);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  const workspacePath = (schoolId?: number) => `/schools/workspace/${schoolId ? `?school_id=${schoolId}` : ""}`;
  const rosterPath = (schoolId?: number) => `/schools/roster/${schoolId ? `?school_id=${schoolId}` : ""}`;
  const loadWorkspace = async (schoolId?: number) => {
    const [workspaceResult, rosterResult] = await Promise.all([api<WorkspaceResponse>(workspacePath(schoolId)), api<Roster>(rosterPath(schoolId))]);
    setWorkspace(workspaceResult.workspace);
    setWorkspaces(workspaceResult.workspaces);
    setRoster(rosterResult);
  };

  useEffect(() => {
    let active = true;
    const savedSchoolId = Number(window.localStorage.getItem("neba_school_workspace")) || undefined;
    Promise.all([api<WorkspaceResponse>(workspacePath(savedSchoolId)), api<Roster>(rosterPath(savedSchoolId))])
      .then(([workspaceResult, rosterResult]) => { if (active) { setWorkspace(workspaceResult.workspace); setWorkspaces(workspaceResult.workspaces); setRoster(rosterResult); } })
      .catch(() => { if (active) setLoadError("We could not load your school workspace. Refresh the page to try again."); });
    return () => { active = false; };
  }, []);

  useEffect(() => { setPage(pageFromSearch(searchParams.get("section"))); }, [searchParams]);

  const selectPage = (next: Page) => { setSelectedStudent(null); setSelectedMember(null); setPage(next); setMobileOpen(false); setNotice(""); };
  const pageName = navigation.find((item) => item.id === page)?.label || "Overview";
  const startImport = () => { selectPage("assessments"); setNotice("Assessment import is being prepared for your workspace. You can set up classes and subjects while it becomes available."); };

  const switchWorkspace = async (schoolId: number) => {
    setSwitchOpen(false);
    setRoster(undefined);
    try {
      await loadWorkspace(schoolId);
      window.localStorage.setItem("neba_school_workspace", String(schoolId));
      setPage("overview");
      setNotice("School workspace switched.");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "We could not switch school workspaces.");
    }
  };

  const createRecord = async (payload: Record<string, string | number>) => {
    setSaving(true);
    try {
      const activeSchoolId = workspace?.id;
      await api(activeSchoolId ? rosterPath(activeSchoolId) : "/schools/roster/", { method: "POST", body: JSON.stringify(payload) });
      await loadWorkspace(activeSchoolId);
      setNotice(payload.action === "student" ? "Student added to your school workspace." : `${payload.action === "class" ? "Class" : "Subject"} saved to your school workspace.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "That record could not be saved.");
    } finally { setSaving(false); }
  };

  const openStudent = async (student: Student) => {
    setSelectedMember(null); setSelectedStudent(student);
    if (!student.public_id || !workspace) return;
    try { setSelectedStudent(await api<Student>(`/schools/students/${student.public_id}/?school_id=${workspace.id}`)); }
    catch { setNotice("This student record could not be loaded."); }
  };
  const openMember = async (member: Member) => {
    setSelectedStudent(null); setSelectedMember(member);
    if (!member.public_id || !workspace) return;
    try { setSelectedMember(await api<Member>(`/schools/members/${member.public_id}/?school_id=${workspace.id}`)); }
    catch { setNotice("This staff record could not be loaded."); }
  };

  if (workspace === undefined || roster === undefined) return <main className="school-app school-app-loading" aria-live="polite"><p>Loading your school workspace…</p></main>;
  if (loadError) return <main className="school-app school-app-loading"><div><h1>Your workspace could not be loaded.</h1><p>{loadError}</p><button className="school-app-button primary" type="button" onClick={() => window.location.reload()}>Try again</button></div></main>;
  if (workspace === null) return <main className="school-app school-app-loading"><div><span>NO SCHOOL WORKSPACE</span><h1>Set up your school to continue.</h1><p>Your Neba account is protected, but it is not connected to a school workspace yet.</p><Link className="school-app-button primary" href="/schools/setup">Set up your school <ArrowRight size={16} /></Link></div></main>;

  return <div className="school-app school-app-empty-workspace">
    <aside className={`school-app-sidebar${mobileOpen ? " open" : ""}`}>
      <div className="school-app-brand"><Link href="/schools" aria-label="Neba for Schools home"><GraduationCap size={24} /><span>neba</span></Link><b>FOR SCHOOLS</b><button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={19} /></button></div>
      <div className="school-app-school-switch"><button type="button" onClick={() => setSwitchOpen((open) => !open)} aria-expanded={switchOpen}><span>SCHOOL WORKSPACE</span><strong>{workspace.name}</strong><ChevronDown size={15} /></button>{switchOpen && <div className="school-app-workspace-menu"><span>YOUR SCHOOLS</span>{workspaces.map((item) => <button type="button" key={item.id} className={item.id === workspace.id ? "active" : ""} onClick={() => void switchWorkspace(item.id)}><strong>{item.name}</strong><small>{item.role.replace("_", " ")}</small></button>)}<Link href="/schools/setup">Add another school <ArrowRight size={14} /></Link></div>}</div>
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
      <main className="school-app-content">{notice && <div className="school-app-notice" role="status">{notice}<button type="button" onClick={() => setNotice("")} aria-label="Dismiss"><X size={15} /></button></div>}{selectedStudent ? <StudentRecord student={selectedStudent} onBack={() => setSelectedStudent(null)} /> : selectedMember ? <StaffRecord member={selectedMember} onBack={() => setSelectedMember(null)} /> : renderPage(workspace, roster)}</main>
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
    if (page === "assessments") return <section className="school-app-page"><div className="school-app-page-heading"><div><span>ASSESSMENTS & RESULTS</span><h2>Start with the result sheets you already use.</h2><p>Import, review, and map assessment results before they inform any teaching decision.</p></div></div><article className="school-app-panel school-app-import"><FileSpreadsheet size={26} /><h3>{school.name} is ready for results.</h3><p>Your school workspace is set up. Assessment file upload and question-to-topic mapping are the next academic workflow being introduced.</p><button type="button" className="school-app-button quiet" onClick={() => selectPage("settings")}>Review classes and subjects <ArrowRight size={16} /></button><small>Assessment files are not uploaded from this screen yet.</small></article></section>;
    if (page === "assistant") return <TeacherClasses school={school} classes={roster.classes} subjects={roster.subjects} />;
    if (page === "students") return <section className="school-app-page"><div className="school-app-page-heading"><div><span>STUDENTS & CLASSES</span><h2>Students in {school.name}.</h2><p>Each student receives a permanent school ID automatically when registered.</p></div><button className="school-app-button primary" onClick={() => setShowStudentForm((show) => !show)}>Add student <ArrowRight size={15} /></button></div>{showStudentForm && <article className="school-app-panel school-app-record-form school-app-inline-form"><span>NEW STUDENT</span><h3>Create a student record</h3>{roster.classes.length ? <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void createRecord({ action: "student", first_name: String(data.get("first_name") || ""), last_name: String(data.get("last_name") || ""), admission_year: Number(data.get("admission_year")), school_class: Number(data.get("school_class")) }); event.currentTarget.reset(); setShowStudentForm(false); }}><label>First name<input name="first_name" required /></label><label>Last name<input name="last_name" required /></label><label>Admission year<input name="admission_year" type="number" defaultValue={new Date().getFullYear()} min="2000" required /></label><label>Class<select name="school_class" required>{roster.classes.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.academic_session}</option>)}</select></label><button className="school-app-button primary" disabled={saving}>{saving ? "Saving…" : "Create student"}<ArrowRight size={15} /></button></form> : <p>Add a class in School settings before creating students.</p>}</article>}<article className="school-app-panel school-app-record-list"><header><div><span>STUDENT RECORDS</span><h3>{roster.students.length} active student{roster.students.length === 1 ? "" : "s"}</h3></div></header>{roster.students.length ? <div className="school-app-table student-table"><div className="table-head"><span>STUDENT</span><span>CLASS</span><span>STUDENT ID</span></div>{roster.students.map((student) => <button type="button" className="school-app-table-row school-app-row-link" onClick={() => void openStudent(student)} key={student.id}><strong>{student.full_name}</strong><span>{student.class_name}</span><span>{student.student_id || "Preparing ID…"}</span></button>)}</div> : <div className="school-app-empty"><UsersRound size={28} /><p>No student records yet. Select Add student to create the first one.</p></div>}</article></section>;
    if (page === "reports") return <section className="school-app-page"><div className="school-app-page-heading"><div><span>REPORTS</span><h2>Review the story behind a term&apos;s results.</h2><p>Report cards and class summaries will only be available after your team reviews the underlying assessment records.</p></div></div><EmptyPanel icon={FileText} eyebrow="NO REPORTS READY" title="Reports will appear after results are reviewed." copy="Neba will keep formal reporting separate from learning recommendations, so school leaders can review both before anything is published." action="Review assessments" onAction={() => selectPage("assessments")} /></section>;
    if (page === "staff") return <section className="school-app-page"><div className="school-app-page-heading"><div><span>STAFF & ACCESS</span><h2>Staff in {school.name}.</h2><p>Select a staff member to review or update their school role without leaving this workspace.</p></div><button className="school-app-button primary" onClick={() => setShowStaffForm((show) => !show)}>Add staff <ArrowRight size={15} /></button></div>{showStaffForm && <article className="school-app-panel school-app-record-form school-app-inline-form"><span>ADD STAFF</span><h3>Add an existing Neba member</h3><form onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); void createRecord({ action: "member", email: String(data.get("email") || ""), role: String(data.get("role") || "teacher") }); event.currentTarget.reset(); setShowStaffForm(false); }}><label>Neba account email<input type="email" name="email" required placeholder="teacher@school.edu" /></label><label>School role<select name="role"><option value="teacher">Teacher</option><option value="academic_head">Academic head</option><option value="admin">School admin</option></select></label><button className="school-app-button primary" disabled={saving}>{saving ? "Saving…" : "Add staff member"}<ArrowRight size={15} /></button></form></article>}<article className="school-app-panel school-app-record-list"><header><div><span>ACTIVE MEMBERS</span><h3>{roster.members.length} school member{roster.members.length === 1 ? "" : "s"}</h3></div></header>{roster.members.length ? <div className="school-app-table"><div className="table-head"><span>MEMBER</span><span>EMAIL</span><span>ROLE</span></div>{roster.members.map((member) => <button type="button" className="school-app-table-row school-app-row-link" onClick={() => void openMember(member)} key={member.id}><strong>{member.name}</strong><span>{member.email || "—"}</span><span>{member.role.replace("_", " ")}</span></button>)}</div> : <div className="school-app-empty"><UsersRound size={28} /><p>No active school members yet. Select Add staff to add the first one.</p></div>}</article><section className="school-app-assignment-rule"><Settings2 size={20} /><div><h3>Teacher access is class and subject specific.</h3><p>Teacher assignments will be added when assessment workflows are enabled. School-wide record access remains protected by active membership today.</p></div></section></section>;
    return <section className="school-app-page"><div className="school-app-page-heading"><div><span>SCHOOL SETTINGS</span><h2>Set the foundation for your school workspace.</h2><p>Classes and subjects are available only to approved members of {school.name}.</p></div></div><section className="school-app-record-grid"><article className="school-app-panel school-app-record-form"><span>ACADEMIC STRUCTURE</span><h3>Add a class</h3><form onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); void createRecord({ action: "class", name: String(data.get("name") || ""), academic_session: String(data.get("academic_session") || "") }); event.currentTarget.reset(); }}><label>Class name<input name="name" placeholder="JSS 1" required /></label><label>Academic session<input name="academic_session" placeholder="2026/2027" required /></label><button className="school-app-button primary" disabled={saving}>{saving ? "Saving…" : "Save class"}<ArrowRight size={15} /></button></form><div className="school-app-chip-list">{roster.classes.map((item) => <span key={item.id}>{item.name} <small>{item.academic_session}</small></span>) || <p>No classes yet.</p>}</div></article><article className="school-app-panel school-app-record-form"><span>CURRICULUM</span><h3>Add a subject</h3><form onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); void createRecord({ action: "subject", name: String(data.get("name") || ""), code: String(data.get("code") || "") }); event.currentTarget.reset(); }}><label>Subject name<input name="name" placeholder="Mathematics" required /></label><label>Subject code <small>Optional</small><input name="code" placeholder="MTH" /></label><button className="school-app-button primary" disabled={saving}>{saving ? "Saving…" : "Save subject"}<ArrowRight size={15} /></button></form><div className="school-app-chip-list">{roster.subjects.map((item) => <span key={item.id}>{item.name}{item.code ? <small>{item.code}</small> : null}</span>) || <p>No subjects yet.</p>}</div></article></section></section>;
  }
}

function StudentRecord({ student, onBack }: { student: Student; onBack: () => void }) {
  const [tab, setTab] = useState<"overview" | "academics" | "insights" | "attendance" | "family">("overview");
  const address = [student.address_line, student.city, student.state].filter(Boolean).join(", ");
  return <section className="school-app-page school-app-detail-view">
    <button type="button" className="school-app-back" onClick={onBack}>← Back to students</button>
    <div className="school-app-page-heading school-app-student-title"><div><span>STUDENT PROFILE · {student.student_id || "PREPARING ID"}</span><h2>{student.full_name} <em>Active</em></h2><p>{student.class_name} · Student ID {student.student_id || "Preparing ID"}</p></div></div>
    <nav className="school-app-record-tabs" aria-label="Student record sections">{[["overview", "Overview"], ["academics", "Academics"], ["insights", "Learning insights"], ["attendance", "Attendance"], ["family", "Family & records"]].map(([id, label]) => <button type="button" className={tab === id ? "active" : ""} onClick={() => setTab(id as typeof tab)} key={id}>{label}</button>)}</nav>
    {tab === "overview" && <><section className="school-app-student-metrics"><article><span>OVERALL AVERAGE</span><strong>—</strong><small>Awaiting reviewed results</small></article><article><span>ATTENDANCE</span><strong>—</strong><small>Not recorded this term</small></article><article><span>SUBJECTS BELOW TARGET</span><strong>—</strong><small>No assessment evidence yet</small></article><article><span>ASSESSMENTS RECORDED</span><strong>0</strong><small>Import results to begin</small></article></section><section className="school-app-detail-grid"><article className="school-app-panel"><span className="school-app-detail-label">STUDENT INFORMATION</span><dl><div><dt>Student ID</dt><dd>{student.student_id || "Preparing ID…"}</dd></div><div><dt>Class</dt><dd>{student.class_name}</dd></div><div><dt>Enrollment status</dt><dd>Active</dd></div><div><dt>School reference</dt><dd>{student.admission_number || "Not recorded"}</dd></div></dl></article><article className="school-app-panel school-app-evidence-card"><span className="school-app-detail-label">ACADEMIC SNAPSHOT</span><h3>Ready for the first evidence.</h3><p>Import and review assessment results to see term performance, topic-level learning gaps, and recommended next actions here.</p></article></section></>}
    {tab === "academics" && <StudentEmpty title="No assessment results yet" copy="Subject scores, assessment history, and term comparisons will appear after your school imports and reviews results." />}
    {tab === "insights" && <StudentEmpty title="No learning insights yet" copy="Neba only identifies strengths, gaps, and recommended actions when reviewed assessment evidence supports them." />}
    {tab === "attendance" && <StudentEmpty title="Attendance has not been recorded" copy="Term attendance, late days, and teacher follow-ups will appear when your school starts recording attendance." />}
    {tab === "family" && <section className="school-app-detail-grid"><article className="school-app-panel"><span className="school-app-detail-label">FAMILY & CONTACT</span><dl><div><dt>Address</dt><dd>{address || "Not recorded"}</dd></div><div><dt>Parent or guardian</dt><dd>{student.guardian_name || "Not recorded"}</dd></div><div><dt>Phone</dt><dd>{student.guardian_phone || "Not recorded"}</dd></div><div><dt>Email</dt><dd>{student.guardian_email || "Not recorded"}</dd></div></dl></article><article className="school-app-panel school-app-evidence-card"><span className="school-app-detail-label">NOTES & RECORDS</span><h3>No notes or interventions yet.</h3><p>Important staff notes and academic support actions will be permission-controlled when this workflow is available.</p></article></section>}
  </section>;
}

type TeachingWork = { students: Array<{ id: number; student_id: string; first_name: string; last_name: string }>; assessments: Array<{ id: number; title: string; type: string; maximum_score: number; status: string; entered_scores: number }>; assignments: Array<{ id: number; title: string; due_date: string | null; status: string; counts_toward_ca: boolean }> };
function TeacherClasses({ school, classes, subjects }: { school: SchoolWorkspace; classes: SchoolClass[]; subjects: Subject[] }) {
  const [classId, setClassId] = useState(""); const [subjectId, setSubjectId] = useState(""); const [work, setWork] = useState<TeachingWork | null>(null); const [mode, setMode] = useState<"assignment" | "assessment" | "scores">("assignment"); const [message, setMessage] = useState("");
  const load = async (selectedClass = classId, selectedSubject = subjectId) => { if (!selectedClass || !selectedSubject) return; try { setWork(await api<TeachingWork>(`/schools/teaching-work/?school_id=${school.id}&class_id=${selectedClass}&subject_id=${selectedSubject}`)); } catch (error) { setMessage(error instanceof Error ? error.message : "This class workspace could not be loaded."); } };
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!classId || !subjectId) return; const form = new FormData(event.currentTarget); const body = mode === "assignment" ? { action: "assignment", title: String(form.get("title") || ""), instructions: String(form.get("instructions") || ""), due_date: String(form.get("due_date") || ""), maximum_score: String(form.get("maximum_score") || "") || null, counts_toward_ca: form.get("counts_toward_ca") === "on" } : { action: "assessment", title: String(form.get("title") || ""), assessment_type: String(form.get("assessment_type") || "ca"), maximum_score: String(form.get("maximum_score") || ""), term: String(form.get("term") || "First term"), academic_session: String(form.get("academic_session") || "") }; try { await api(`/schools/teaching-work/?school_id=${school.id}&class_id=${classId}&subject_id=${subjectId}`, { method: "POST", body: JSON.stringify(body) }); event.currentTarget.reset(); setMessage(mode === "assignment" ? "Assignment saved as a draft." : "Assessment created as a draft."); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save this teaching record."); } };
  return <section className="school-app-page"><div className="school-app-page-heading"><div><span>MY CLASSES</span><h2>Teach, assess, and follow up from one place.</h2><p>Choose a class and subject to create homework, enter draft scores, and keep the academic record connected.</p></div></div><div className="school-app-teaching-picker"><label>Class<select value={classId} onChange={(e) => { setClassId(e.target.value); setWork(null); }}><option value="">Choose a class</option>{classes.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.academic_session}</option>)}</select></label><label>Subject<select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setWork(null); }}><option value="">Choose a subject</option>{subjects.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><button className="school-app-button primary" type="button" onClick={() => void load()}>Open class</button></div>{message && <p className="school-app-notice">{message}</p>}{work && <><nav className="school-app-record-tabs"><button className={mode === "assignment" ? "active" : ""} onClick={() => setMode("assignment")}>Assignments</button><button className={mode === "assessment" ? "active" : ""} onClick={() => setMode("assessment")}>Assessments</button><button className={mode === "scores" ? "active" : ""} onClick={() => setMode("scores")}>Score entry</button></nav>{mode !== "scores" ? <article className="school-app-panel school-app-teaching-form"><h3>{mode === "assignment" ? "New take-home assignment" : "New assessment"}</h3><form onSubmit={(e) => void submit(e)}><label>Title<input name="title" required placeholder={mode === "assignment" ? "Fractions — Exercise 4" : "Mathematics CA 1"} /></label>{mode === "assignment" ? <><label>Instructions<textarea name="instructions" placeholder="What should students complete?" /></label><label>Due date<input name="due_date" type="date" /></label><label>Maximum marks <input name="maximum_score" type="number" min="1" step="0.5" /></label><label className="school-app-check"><input name="counts_toward_ca" type="checkbox" /> Include marks in continuous assessment</label></> : <><label>Assessment type<select name="assessment_type"><option value="ca">Continuous assessment</option><option value="quiz">Quiz or test</option><option value="exam">Examination</option></select></label><label>Maximum score<input name="maximum_score" type="number" min="1" step="0.5" required /></label><label>Term<input name="term" defaultValue="First term" required /></label><input type="hidden" name="academic_session" value={classes.find((item) => String(item.id) === classId)?.academic_session || ""} /></>}<button className="school-app-button primary">Save draft</button></form></article> : <article className="school-app-panel school-app-score-grid"><h3>Draft score entry</h3><p>Scores remain drafts until an authorized review and publication workflow is added.</p>{work.assessments.length ? work.assessments.map((assessment) => <ScoreEntry key={assessment.id} assessment={assessment} students={work.students} url={`/schools/teaching-work/?school_id=${school.id}&class_id=${classId}&subject_id=${subjectId}`} onSaved={() => void load()} />) : <p>No draft assessments yet.</p>}</article>}<section className="school-app-detail-grid"><article className="school-app-panel"><span className="school-app-detail-label">ASSIGNMENTS</span><p>{work.assignments.length ? `${work.assignments.length} assignment record${work.assignments.length === 1 ? "" : "s"} in this class.` : "No assignments yet."}</p></article><article className="school-app-panel"><span className="school-app-detail-label">ASSESSMENTS</span><p>{work.assessments.length ? `${work.assessments.length} assessment record${work.assessments.length === 1 ? "" : "s"} ready for score entry.` : "No assessments yet."}</p></article></section></>}</section>;
}

function ScoreEntry({ assessment, students, url, onSaved }: { assessment: TeachingWork["assessments"][number]; students: TeachingWork["students"]; url: string; onSaved: () => void }) { const [notice, setNotice] = useState(""); return <form className="school-app-score-form" onSubmit={async (e) => { e.preventDefault(); const data = new FormData(e.currentTarget); const scores = students.map((student) => ({ student_id: student.id, score: data.get(`score-${student.id}`), status: data.get(`score-${student.id}`) === "" ? "missing" : "entered" })); try { const result = await api<{ saved: number }>(url, { method: "POST", body: JSON.stringify({ action: "scores", assessment_id: assessment.id, scores }) }); setNotice(`${result.saved} scores saved.`); onSaved(); } catch (error) { setNotice(error instanceof Error ? error.message : "Scores could not be saved."); } }}><div><strong>{assessment.title}</strong><span>{assessment.entered_scores} entered · out of {assessment.maximum_score}</span></div>{students.map((student) => <label key={student.id}>{student.first_name} {student.last_name} <small>{student.student_id}</small><input name={`score-${student.id}`} type="number" min="0" max={assessment.maximum_score} step="0.5" /></label>)}<button className="school-app-button primary">Save scores</button>{notice && <p>{notice}</p>}</form>; }

function StudentEmpty({ title, copy }: { title: string; copy: string }) { return <article className="school-app-panel school-app-student-empty"><span className="school-app-detail-label">STUDENT ACADEMIC RECORD</span><h3>{title}</h3><p>{copy}</p></article>; }

function StaffRecord({ member, onBack }: { member: Member; onBack: () => void }) {
  return <section className="school-app-page school-app-detail-view">
    <button type="button" className="school-app-back" onClick={onBack}>← Back to staff</button>
    <div className="school-app-page-heading"><div><span>STAFF ACCESS</span><h2>{member.name}</h2><p>{member.email || "No email on record"} · This record stays inside the current school workspace.</p></div></div>
    <section className="school-app-detail-grid"><article className="school-app-panel"><span className="school-app-detail-label">SCHOOL ACCESS</span><dl><div><dt>Role</dt><dd>{member.role.replace("_", " ")}</dd></div><div><dt>Member ID</dt><dd>{member.public_id || "Preparing access…"}</dd></div></dl></article></section>
  </section>;
}

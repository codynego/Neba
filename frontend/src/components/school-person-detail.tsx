"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BarChart3, Bot, Check, CheckCircle2, ClipboardCheck, Edit3, FileText, LayoutDashboard, Settings, Sparkles, Target, TrendingDown, TrendingUp, Users, UsersRound } from "lucide-react";
import { api } from "@/lib/api";

type Workspace = { id: number; name: string; role: string };
type Student = { public_id: string; first_name: string; last_name: string; full_name: string; admission_number: string; school_class: number; class_name: string; address_line: string; city: string; state: string; guardian_name: string; guardian_phone: string; guardian_email: string };
type Member = { public_id: string; name: string; email: string; role: string; status: string; created_at: string };
type StudentTab = "profile" | "intelligence" | "history" | "support" | "family";
type TopicSignal = { topic: string; subject: string; subject_id: number; average: number; coverage: number; assessments: number; confidence: "early" | "sufficient"; status: "needs_support" | "developing" | "strength"; change: number | null; evidence: string };
type StudentIntelligence = {
  summary: { overall_average: number | null; assessments_recorded: number; topics_needing_support: number; active_interventions: number };
  topic_signals: TopicSignal[];
  assessment_history: Array<{ id: number; title: string; subject: string; assessment_type: string; date: string; percentage: number; score: number; maximum_score: number }>;
  interventions: Array<{ id: number; title: string; topic: string; subject: string; status: "draft" | "active" | "complete"; baseline_average: number | null; follow_up_average: number | null; created_at: string; completed_at: string | null }>;
};

const workspaceId = () => typeof window === "undefined" ? "" : window.localStorage.getItem("neba_school_workspace") || "";
const workspaceSuffix = () => workspaceId() ? `?school_id=${workspaceId()}` : "";
const initials = (first?: string, last?: string) => `${first?.[0] || ""}${last?.[0] || ""}` || "S";
const shortId = (id?: string) => id?.slice(0, 8).toUpperCase() || "PREPARING";

function WorkspaceSidebar({ workspace, active }: { workspace: Workspace; active: "students" | "staff" }) {
  const navigation = [
    ["Overview", "/schools/dashboard", LayoutDashboard, false], ["Academic intelligence", "/schools/dashboard?section=intelligence", BarChart3, false], ["My classes", "/schools/dashboard?section=assistant", Bot, false], ["Students & classes", "/schools/dashboard?section=students", Users, active === "students"], ["Reports", "/schools/dashboard?section=reports", FileText, false], ["Staff & access", "/schools/dashboard?section=staff", UsersRound, active === "staff"], ["School settings", "/schools/dashboard?section=settings", Settings, false],
  ] as const;
  return <aside className="school-detail-sidebar">
    <Link className="school-detail-brand" href="/schools/dashboard"><span>N</span><strong>neba</strong></Link>
    <div className="school-detail-workspace"><small>SCHOOL WORKSPACE</small><strong>{workspace.name}</strong><span>{workspace.role.replace("_", " ")}</span></div>
    <nav aria-label="School workspace navigation">{navigation.map(([label, href, Icon, selected]) => <Link className={selected ? "active" : ""} href={href} key={label}><Icon size={16} /> {label}</Link>)}</nav>
  </aside>;
}

export function StudentDetail({ studentId }: { studentId: string }) {
  const [student, setStudent] = useState<Student | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [intelligence, setIntelligence] = useState<StudentIntelligence | null>(null);
  const [tab, setTab] = useState<StudentTab>("intelligence");
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const load = async () => {
    const suffix = workspaceSuffix();
    const [workspaceResult, studentResult, intelligenceResult] = await Promise.all([api<{ workspace: Workspace }>(`/schools/workspace/${suffix}`), api<Student>(`/schools/students/${studentId}/${suffix}`), api<StudentIntelligence>(`/schools/students/${studentId}/intelligence/${suffix}`)]);
    setWorkspace(workspaceResult.workspace); setStudent(studentResult); setIntelligence(intelligenceResult);
  };
  useEffect(() => { void load().catch(() => setNotice("This student could not be found in the selected school workspace.")); }, [studentId]);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const fields = ["first_name", "last_name", "admission_number", "address_line", "city", "state", "guardian_name", "guardian_phone", "guardian_email"];
    const payload = Object.fromEntries(fields.map((field) => [field, String(form.get(field) || "").trim()]));
    const result = await api<Student>(`/schools/students/${studentId}/${workspaceSuffix()}`, { method: "PATCH", body: JSON.stringify(payload) });
    setStudent(result); setEditing(false); setNotice("Student record updated.");
  };
  if (!student || !workspace) return <main className="school-detail-loading">{notice || "Loading student record…"}</main>;
  return <div className="school-detail-layout"><WorkspaceSidebar workspace={workspace} active="students" /><main className="school-detail">
    <header><Link href="/schools/dashboard?section=students"><ArrowLeft size={16} /> Back to students</Link><span>{workspace.name.toUpperCase()} · STUDENT RECORD</span></header>
    <section className="school-detail-hero"><div className="school-detail-avatar">{initials(student.first_name, student.last_name)}</div><div><span>STUDENT ID · {shortId(student.public_id)}</span><h1>{student.full_name}</h1><p>{student.class_name} · Private record in {workspace.name}</p></div><button className="school-app-button quiet" onClick={() => setEditing((value) => !value)}><Edit3 size={15} /> {editing ? "Cancel" : "Edit student"}</button></section>
    {notice && <p className="school-detail-notice"><Check size={15} /> {notice}</p>}
    <nav className="school-detail-tabs" aria-label="Student detail sections">{(["intelligence", "history", "support", "profile", "family"] as StudentTab[]).map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item === "history" ? "Assessment history" : item === "support" ? "Support plans" : item === "family" ? "Family & contact" : item}</button>)}</nav>
    {editing ? <StudentEditForm student={student} save={save} /> : <StudentContent student={student} intelligence={intelligence} tab={tab} onRefresh={() => void load()} onNotice={setNotice} />}
  </main></div>;
}

function StudentEditForm({ student, save }: { student: Student; save: (event: FormEvent<HTMLFormElement>) => Promise<void> }) {
  return <section className="school-detail-card"><form className="school-detail-form school-detail-form-wide" onSubmit={(event) => void save(event)}>
    <h2>Student information</h2><label>First name<input name="first_name" defaultValue={student.first_name} required /></label><label>Last name<input name="last_name" defaultValue={student.last_name} required /></label><label>School reference <small>Optional</small><input name="admission_number" defaultValue={student.admission_number} /></label>
    <h2>Home address</h2><label className="school-detail-field-full">Street address<input name="address_line" defaultValue={student.address_line} /></label><label>City<input name="city" defaultValue={student.city} /></label><label>State<input name="state" defaultValue={student.state} /></label>
    <h2>Parent or guardian</h2><label>Full name<input name="guardian_name" defaultValue={student.guardian_name} /></label><label>Phone number<input name="guardian_phone" type="tel" defaultValue={student.guardian_phone} /></label><label className="school-detail-field-full">Email address<input name="guardian_email" type="email" defaultValue={student.guardian_email} /></label><button className="school-app-button primary">Save student record</button>
  </form></section>;
}

function StudentContent({ student, intelligence, tab, onRefresh, onNotice }: { student: Student; intelligence: StudentIntelligence | null; tab: StudentTab; onRefresh: () => void; onNotice: (message: string) => void }) {
  if (tab === "profile") return <section className="school-detail-card"><dl><DetailItem label="Student ID" value={student.public_id || "Preparing ID…"} /><DetailItem label="Class" value={student.class_name} /><DetailItem label="School reference" value={student.admission_number || "Not recorded"} /></dl></section>;
  if (tab === "family") return <section className="school-detail-card"><dl className="school-detail-contact-grid"><DetailItem label="Home address" value={[student.address_line, student.city, student.state].filter(Boolean).join(", ") || "Not recorded"} /><DetailItem label="Parent or guardian" value={student.guardian_name || "Not recorded"} /><DetailItem label="Guardian phone" value={student.guardian_phone || "Not recorded"} /><DetailItem label="Guardian email" value={student.guardian_email || "Not recorded"} /></dl></section>;
  if (!intelligence) return <EmptyState icon={<BarChart3 size={25} />} title="Student intelligence is loading" copy="The private profile will show only recorded assessment evidence available to your role." />;
  if (tab === "intelligence") return <StudentIntelligencePanel student={student} data={intelligence} onRefresh={onRefresh} onNotice={onNotice} />;
  if (tab === "history") return <AssessmentHistory history={intelligence.assessment_history} />;
  return <StudentSupportPlans student={student} data={intelligence} onRefresh={onRefresh} onNotice={onNotice} />;
}

function StudentIntelligencePanel({ student, data, onRefresh, onNotice }: { student: Student; data: StudentIntelligence; onRefresh: () => void; onNotice: (message: string) => void }) {
  const [saving, setSaving] = useState(false);
  const createPlan = async (signal: TopicSignal) => {
    setSaving(true);
    try {
      const result = await api<{ title: string }>(`/schools/students/${student.public_id}/intelligence/${workspaceSuffix()}`, { method: "POST", body: JSON.stringify({ subject_id: signal.subject_id, topic: signal.topic, baseline_average: signal.average, rationale: `${signal.evidence} Teacher review is required before choosing reteaching, practice, or another response.` }) });
      onNotice(`Draft support plan created: ${result.title}.`); onRefresh();
    } catch (error) { onNotice(error instanceof Error ? error.message : "The support plan could not be created."); }
    finally { setSaving(false); }
  };
  const summary = data.summary;
  if (!data.topic_signals.length) return <section className="school-detail-card school-detail-empty"><BarChart3 size={25} /><h2>Build this profile from evidence.</h2><p>Record this learner&apos;s assessment scores and map the topics assessed. Neba will then show strengths, areas to review, and the evidence behind each signal.</p><Link className="school-app-button primary" href="/schools/dashboard?section=assistant">Open teaching work <ArrowRight size={15} /></Link></section>;
  const priority = data.topic_signals.find((signal) => signal.status === "needs_support") || data.topic_signals[0];
  return <section className="student-intelligence">
    <div className="student-intelligence-intro"><div><span>PRIVATE ACADEMIC PROFILE</span><h2>Evidence for {student.first_name}&apos;s next step.</h2><p>Use recorded work to decide where support will help. These signals support teacher judgment; they do not diagnose the learner.</p></div><div className={`student-intelligence-verdict ${priority.status}`}><small>PRIORITY FOR REVIEW</small><strong>{priority.topic}</strong><span>{priority.subject} · {priority.average}%</span></div></div>
    <section className="student-intelligence-stats" aria-label="Student academic summary"><article><span>OVERALL AVERAGE</span><strong>{summary.overall_average ?? "—"}{summary.overall_average !== null && <em>%</em>}</strong><small>Across entered scores</small></article><article><span>ASSESSMENTS</span><strong>{summary.assessments_recorded || "—"}</strong><small>Recorded for this learner</small></article><article><span>TOPICS TO REVIEW</span><strong>{summary.topics_needing_support || "—"}</strong><small>Below 60% evidence threshold</small></article><article><span>ACTIVE SUPPORT</span><strong>{summary.active_interventions || "—"}</strong><small>Teacher-owned plans</small></article></section>
    <section className="student-intelligence-signals"><header><div><span>TOPIC EVIDENCE</span><h3>Strengths and areas to review</h3></div><small>Each signal shows its evidence level.</small></header><div className="student-intelligence-signal-list">{data.topic_signals.map((signal) => <article key={`${signal.subject_id}-${signal.topic}`} className={`student-intelligence-signal ${signal.status}`}><div className="student-intelligence-signal-icon">{signal.status === "strength" ? <CheckCircle2 size={17} /> : signal.status === "needs_support" ? <TrendingDown size={17} /> : <TrendingUp size={17} />}</div><div className="student-intelligence-signal-body"><div><strong>{signal.topic}</strong><span>{signal.subject}</span></div><div className="student-intelligence-meter"><span style={{ width: `${signal.average}%` }} /></div><small>{signal.evidence}</small></div><div className="student-intelligence-score"><strong>{signal.average}%</strong><small>{signal.confidence === "sufficient" ? "Evidence ready" : "Early signal"}</small>{signal.change !== null && <span className={signal.change >= 0 ? "up" : "down"}>{signal.change >= 0 ? "+" : ""}{signal.change}%</span>}</div>{signal.status === "needs_support" && <button type="button" className="school-app-button quiet" disabled={saving} onClick={() => void createPlan(signal)}><Target size={14} /> Plan support</button>}</article>)}</div></section>
    <aside className="student-intelligence-boundary"><Sparkles size={18} /><p><strong>What this means:</strong> {priority.status === "needs_support" ? `${priority.topic} needs a teacher review before any action is assigned.` : `${priority.topic} is the clearest current signal; keep building comparable evidence before drawing a long-term conclusion.`}</p></aside>
  </section>;
}

function AssessmentHistory({ history }: { history: StudentIntelligence["assessment_history"] }) {
  if (!history.length) return <EmptyState icon={<ClipboardCheck size={25} />} title="No recorded assessments yet" copy="Assessment history appears after scores are entered for this learner." />;
  return <section className="student-history"><header><span>RECORDED ASSESSMENTS</span><h2>Performance over time</h2><p>These are the assessment scores entered for this learner. Missing or excused scores are not treated as zero.</p></header><div className="student-history-list">{history.map((item) => <article key={item.id}><div><span>{item.subject}</span><strong>{item.title}</strong><small>{new Date(item.date).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })} · {item.assessment_type.replace("_", " ")}</small></div><div><strong>{item.percentage}%</strong><small>{item.score} / {item.maximum_score}</small></div></article>)}</div></section>;
}

function StudentSupportPlans({ student, data, onRefresh, onNotice }: { student: Student; data: StudentIntelligence; onRefresh: () => void; onNotice: (message: string) => void }) {
  const [savingId, setSavingId] = useState<number | null>(null);
  const updateStatus = async (id: number, status: "active" | "complete") => {
    setSavingId(id);
    try { const result = await api<{ follow_up_average: number | null }>(`/schools/students/${student.public_id}/intelligence/${workspaceSuffix()}`, { method: "PATCH", body: JSON.stringify({ intervention_id: id, status }) }); onNotice(status === "complete" ? `Support plan completed${result.follow_up_average !== null ? ` with a current follow-up signal of ${result.follow_up_average}%` : ""}.` : "Support plan marked active."); onRefresh(); }
    catch (error) { onNotice(error instanceof Error ? error.message : "The support plan could not be updated."); }
    finally { setSavingId(null); }
  };
  if (!data.interventions.length) return <EmptyState icon={<Target size={25} />} title="No individual support plans yet" copy="Create a plan from a topic that needs review. Plans stay in draft until a teacher starts them." />;
  return <section className="student-support"><header><span>TEACHER-OWNED FOLLOW-UP</span><h2>Support plans for this learner</h2><p>A plan records what the school chose to do. It never becomes an automatic decision about the learner.</p></header><div className="student-support-list">{data.interventions.map((item) => <article key={item.id}><div className={`student-support-status ${item.status}`}>{item.status === "complete" ? <CheckCircle2 size={17} /> : <Target size={17} />}</div><div className="student-support-body"><span>{item.subject} · {item.topic}</span><h3>{item.title}</h3><p>Baseline: {item.baseline_average ?? "—"}%{item.follow_up_average !== null ? ` · Follow-up: ${item.follow_up_average}%` : ""}</p><small>Created {new Date(item.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</small></div><div className="student-support-actions"><span className={`student-support-pill ${item.status}`}>{item.status}</span>{item.status === "draft" && <button type="button" className="school-app-button quiet" disabled={savingId === item.id} onClick={() => void updateStatus(item.id, "active")}>Start plan</button>}{item.status === "active" && <button type="button" className="school-app-button primary" disabled={savingId === item.id} onClick={() => void updateStatus(item.id, "complete")}>Mark complete</button>}</div></article>)}</div></section>;
}

export function StaffDetail({ memberId }: { memberId: string }) {
  const [member, setMember] = useState<Member | null>(null); const [workspace, setWorkspace] = useState<Workspace | null>(null); const [editing, setEditing] = useState(false); const [notice, setNotice] = useState("");
  const load = async () => { const suffix = workspaceSuffix(); const [workspaceResult, memberResult] = await Promise.all([api<{ workspace: Workspace }>(`/schools/workspace/${suffix}`), api<Member>(`/schools/members/${memberId}/${suffix}`)]); setWorkspace(workspaceResult.workspace); setMember(memberResult); };
  useEffect(() => { void load().catch(() => setNotice("This staff record could not be found in the selected school workspace.")); }, [memberId]);
  const save = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const role = new FormData(event.currentTarget).get("role"); const result = await api<Member>(`/schools/members/${memberId}/${workspaceSuffix()}`, { method: "PATCH", body: JSON.stringify({ role }) }); setMember(result); setEditing(false); setNotice("Staff access updated."); };
  if (!member || !workspace) return <main className="school-detail-loading">{notice || "Loading staff access…"}</main>;
  return <div className="school-detail-layout"><WorkspaceSidebar workspace={workspace} active="staff" /><main className="school-detail">
    <header><Link href="/schools/dashboard?section=staff"><ArrowLeft size={16} /> Back to staff</Link><span>{workspace.name.toUpperCase()} · STAFF ACCESS</span></header>
    <section className="school-detail-hero"><div className="school-detail-avatar"><UsersRound size={24} /></div><div><span>MEMBER ID · {shortId(member.public_id)}</span><h1>{member.name}</h1><p>{member.email || "No email on record"}</p></div>{workspace.role === "admin" && <button className="school-app-button quiet" onClick={() => setEditing((value) => !value)}><Edit3 size={15} /> {editing ? "Cancel" : "Edit access"}</button>}</section>
    {notice && <p className="school-detail-notice"><Check size={15} /> {notice}</p>}
    <section className="school-detail-card">{editing ? <form className="school-detail-form" onSubmit={(event) => void save(event)}><label>School role<select name="role" defaultValue={member.role}><option value="teacher">Teacher</option><option value="academic_head">Academic head</option><option value="admin">School admin</option></select></label><button className="school-app-button primary">Save access</button></form> : <dl><DetailItem label="Access role" value={member.role.replace("_", " ")} /><DetailItem label="Membership status" value={member.status} /><DetailItem label="Member ID" value={member.public_id || "Preparing ID…"} /></dl>}</section>
  </main></div>;
}

function DetailItem({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function EmptyState({ icon, title, copy }: { icon: ReactNode; title: string; copy: string }) { return <section className="school-detail-card school-detail-empty">{icon}<h2>{title}</h2><p>{copy}</p></section>; }

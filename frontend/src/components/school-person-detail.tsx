"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3, Bot, Check, ClipboardCheck, Edit3, FileText, FileUp, LayoutDashboard, Settings, Users, UsersRound } from "lucide-react";
import { api } from "@/lib/api";

type Workspace = { id: number; name: string; role: string };
type Student = { public_id: string; first_name: string; last_name: string; full_name: string; admission_number: string; school_class: number; class_name: string; address_line: string; city: string; state: string; guardian_name: string; guardian_phone: string; guardian_email: string };
type Member = { public_id: string; name: string; email: string; role: string; status: string; created_at: string };
type StudentTab = "profile" | "family" | "performance" | "activity";

const workspaceId = () => typeof window === "undefined" ? "" : window.localStorage.getItem("neba_school_workspace") || "";
const workspaceSuffix = () => workspaceId() ? `?school_id=${workspaceId()}` : "";
const initials = (first?: string, last?: string) => `${first?.[0] || ""}${last?.[0] || ""}` || "S";
const shortId = (id?: string) => id?.slice(0, 8).toUpperCase() || "PREPARING";

function WorkspaceSidebar({ workspace, active }: { workspace: Workspace; active: "students" | "staff" }) {
  const navigation = [
    ["Overview", "/schools/dashboard", LayoutDashboard, false], ["Academic intelligence", "/schools/dashboard?section=intelligence", BarChart3, false], ["Assessments", "/schools/dashboard?section=assessments", FileUp, false], ["Teaching assistant", "/schools/dashboard?section=assistant", Bot, false], ["Students & classes", "/schools/dashboard?section=students", Users, active === "students"], ["Reports", "/schools/dashboard?section=reports", FileText, false], ["Staff & access", "/schools/dashboard?section=staff", UsersRound, active === "staff"], ["School settings", "/schools/dashboard?section=settings", Settings, false],
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
  const [tab, setTab] = useState<StudentTab>("profile");
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const load = async () => {
    const suffix = workspaceSuffix();
    const [workspaceResult, studentResult] = await Promise.all([api<{ workspace: Workspace }>(`/schools/workspace/${suffix}`), api<Student>(`/schools/students/${studentId}/${suffix}`)]);
    setWorkspace(workspaceResult.workspace); setStudent(studentResult);
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
    <nav className="school-detail-tabs" aria-label="Student detail sections">{(["profile", "family", "performance", "activity"] as StudentTab[]).map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item === "family" ? "Family & contact" : item}</button>)}</nav>
    {editing ? <StudentEditForm student={student} save={save} /> : <StudentContent student={student} tab={tab} />}
  </main></div>;
}

function StudentEditForm({ student, save }: { student: Student; save: (event: FormEvent<HTMLFormElement>) => Promise<void> }) {
  return <section className="school-detail-card"><form className="school-detail-form school-detail-form-wide" onSubmit={(event) => void save(event)}>
    <h2>Student information</h2><label>First name<input name="first_name" defaultValue={student.first_name} required /></label><label>Last name<input name="last_name" defaultValue={student.last_name} required /></label><label>School reference <small>Optional</small><input name="admission_number" defaultValue={student.admission_number} /></label>
    <h2>Home address</h2><label className="school-detail-field-full">Street address<input name="address_line" defaultValue={student.address_line} /></label><label>City<input name="city" defaultValue={student.city} /></label><label>State<input name="state" defaultValue={student.state} /></label>
    <h2>Parent or guardian</h2><label>Full name<input name="guardian_name" defaultValue={student.guardian_name} /></label><label>Phone number<input name="guardian_phone" type="tel" defaultValue={student.guardian_phone} /></label><label className="school-detail-field-full">Email address<input name="guardian_email" type="email" defaultValue={student.guardian_email} /></label><button className="school-app-button primary">Save student record</button>
  </form></section>;
}

function StudentContent({ student, tab }: { student: Student; tab: StudentTab }) {
  if (tab === "profile") return <section className="school-detail-card"><dl><DetailItem label="Student ID" value={student.public_id || "Preparing ID…"} /><DetailItem label="Class" value={student.class_name} /><DetailItem label="School reference" value={student.admission_number || "Not recorded"} /></dl></section>;
  if (tab === "family") return <section className="school-detail-card"><dl className="school-detail-contact-grid"><DetailItem label="Home address" value={[student.address_line, student.city, student.state].filter(Boolean).join(", ") || "Not recorded"} /><DetailItem label="Parent or guardian" value={student.guardian_name || "Not recorded"} /><DetailItem label="Guardian phone" value={student.guardian_phone || "Not recorded"} /><DetailItem label="Guardian email" value={student.guardian_email || "Not recorded"} /></dl></section>;
  if (tab === "performance") return <EmptyState icon={<ClipboardCheck size={25} />} title="No reviewed performance yet" copy="Assessment results will appear here after an assessment is imported and reviewed for this student." />;
  return <EmptyState icon={<FileText size={25} />} title="No student activity yet" copy="Notes, interventions, and reviewed academic actions will appear here as your school begins using assessments." />;
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

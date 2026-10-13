"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ClipboardCheck, Edit3, FileText, UsersRound } from "lucide-react";
import { api } from "@/lib/api";

type Workspace = { id: number; name: string; role: string };
type Student = { public_id: string; first_name: string; last_name: string; full_name: string; admission_number: string; school_class: number; class_name: string };
type Member = { public_id: string; name: string; email: string; role: string; status: string; created_at: string };
type Tab = "profile" | "performance" | "activity";

function workspaceId() { return typeof window === "undefined" ? "" : window.localStorage.getItem("neba_school_workspace") || ""; }

export function StudentDetail({ studentId }: { studentId: string }) {
  const [student, setStudent] = useState<Student | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [tab, setTab] = useState<Tab>("profile");
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");

  const load = async () => {
    const id = workspaceId();
    const suffix = id ? `?school_id=${id}` : "";
    const [workspaceResult, studentResult] = await Promise.all([api<{ workspace: Workspace }>(`/schools/workspace/${suffix}`), api<Student>(`/schools/students/${studentId}/${suffix}`)]);
    setWorkspace(workspaceResult.workspace); setStudent(studentResult);
  };
  useEffect(() => { void load().catch(() => setNotice("This student could not be found in the selected school workspace.")); }, [studentId]);
  if (!student || !workspace) return <main className="school-detail-loading">{notice || "Loading student record…"}</main>;
  const save = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); const suffix = workspaceId() ? `?school_id=${workspaceId()}` : ""; const result = await api<Student>(`/schools/students/${studentId}/${suffix}`, { method: "PATCH", body: JSON.stringify({ first_name: form.get("first_name"), last_name: form.get("last_name"), admission_number: form.get("admission_number") }) }); setStudent(result); setEditing(false); setNotice("Student profile updated."); };
  return <main className="school-detail"><header><Link href="/schools/dashboard"><ArrowLeft size={16} /> Back to students</Link><span>{workspace.name.toUpperCase()} · STUDENT RECORD</span></header><section className="school-detail-hero"><div className="school-detail-avatar">{student.first_name[0]}{student.last_name[0]}</div><div><span>STUDENT ID · {student.public_id.slice(0, 8).toUpperCase()}</span><h1>{student.full_name}</h1><p>{student.class_name} · Private record in {workspace.name}</p></div><button className="school-app-button quiet" onClick={() => setEditing((value) => !value)}><Edit3 size={15} /> {editing ? "Cancel" : "Edit profile"}</button></section>{notice && <p className="school-detail-notice"><Check size={15} /> {notice}</p>}<nav className="school-detail-tabs" aria-label="Student detail sections">{(["profile", "performance", "activity"] as Tab[]).map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</nav>{tab === "profile" && <section className="school-detail-card">{editing ? <form className="school-detail-form" onSubmit={save}><label>First name<input name="first_name" defaultValue={student.first_name} required /></label><label>Last name<input name="last_name" defaultValue={student.last_name} required /></label><label>School reference <small>Optional</small><input name="admission_number" defaultValue={student.admission_number} /></label><button className="school-app-button primary">Save profile</button></form> : <dl><div><dt>Student ID</dt><dd>{student.public_id}</dd></div><div><dt>Class</dt><dd>{student.class_name}</dd></div><div><dt>School reference</dt><dd>{student.admission_number || "Not recorded"}</dd></div></dl>}</section>}{tab === "performance" && <EmptyStudentState icon={<ClipboardCheck size={25} />} title="No reviewed performance yet" copy="Assessment results will appear here after an assessment is imported and reviewed for this student." />}{tab === "activity" && <EmptyStudentState icon={<FileText size={25} />} title="No student activity yet" copy="Notes, interventions, and reviewed academic actions will appear here as your school begins using assessments." />}</main>;
}

export function StaffDetail({ memberId }: { memberId: string }) {
  const [member, setMember] = useState<Member | null>(null); const [workspace, setWorkspace] = useState<Workspace | null>(null); const [editing, setEditing] = useState(false); const [notice, setNotice] = useState("");
  const load = async () => { const id = workspaceId(); const suffix = id ? `?school_id=${id}` : ""; const [workspaceResult, memberResult] = await Promise.all([api<{ workspace: Workspace }>(`/schools/workspace/${suffix}`), api<Member>(`/schools/members/${memberId}/${suffix}`)]); setWorkspace(workspaceResult.workspace); setMember(memberResult); };
  useEffect(() => { void load().catch(() => setNotice("This staff record could not be found in the selected school workspace.")); }, [memberId]);
  if (!member || !workspace) return <main className="school-detail-loading">{notice || "Loading staff access…"}</main>;
  const save = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const role = new FormData(event.currentTarget).get("role"); const suffix = workspaceId() ? `?school_id=${workspaceId()}` : ""; const result = await api<Member>(`/schools/members/${memberId}/${suffix}`, { method: "PATCH", body: JSON.stringify({ role }) }); setMember(result); setEditing(false); setNotice("Staff access updated."); };
  return <main className="school-detail"><header><Link href="/schools/dashboard"><ArrowLeft size={16} /> Back to staff</Link><span>{workspace.name.toUpperCase()} · STAFF ACCESS</span></header><section className="school-detail-hero"><div className="school-detail-avatar"><UsersRound size={24} /></div><div><span>MEMBER ID · {member.public_id.slice(0, 8).toUpperCase()}</span><h1>{member.name}</h1><p>{member.email || "No email on record"}</p></div>{workspace.role === "admin" ? <button className="school-app-button quiet" onClick={() => setEditing((value) => !value)}><Edit3 size={15} /> {editing ? "Cancel" : "Edit access"}</button> : null}</section>{notice && <p className="school-detail-notice"><Check size={15} /> {notice}</p>}<section className="school-detail-card">{editing ? <form className="school-detail-form" onSubmit={save}><label>School role<select name="role" defaultValue={member.role}><option value="teacher">Teacher</option><option value="academic_head">Academic head</option><option value="admin">School admin</option></select></label><button className="school-app-button primary">Save access</button></form> : <dl><div><dt>Access role</dt><dd>{member.role.replace("_", " ")}</dd></div><div><dt>Membership status</dt><dd>{member.status}</dd></div><div><dt>Member ID</dt><dd>{member.public_id}</dd></div></dl>}</section></main>;
}

function EmptyStudentState({ icon, title, copy }: { icon: ReactNode; title: string; copy: string }) { return <section className="school-detail-card school-detail-empty">{icon}<h2>{title}</h2><p>{copy}</p></section>; }

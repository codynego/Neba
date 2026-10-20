"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  BookOpen,
  CalendarCheck2,
  Check,
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
  Trophy,
  Trash2,
  Upload,
  UsersRound,
  X,
} from "lucide-react";
import { api } from "@/lib/api";

type Page =
  | "overview"
  | "intelligence"
  | "assistant"
  | "students"
  | "reports"
  | "staff"
  | "settings";
type SchoolWorkspace = {
  id: number;
  name: string;
  slug: string;
  role: string;
  classes_count: number;
  subjects_count: number;
  students_count: number;
};
type SchoolClass = { id: number; name: string; academic_session: string };
type Subject = { id: number; name: string; code: string };
type Student = {
  id: number;
  public_id?: string;
  student_id?: string;
  first_name: string;
  last_name: string;
  full_name: string;
  admission_number: string;
  school_class: number;
  class_name: string;
  address_line?: string;
  city?: string;
  state?: string;
  guardian_name?: string;
  guardian_phone?: string;
  guardian_email?: string;
  academic_average?: number | null;
  assessments_recorded?: number;
  attendance_rate?: number | null;
};
type StaffAssignment = {
  id: number;
  type: "class_teacher" | "subject_teacher";
  class_id: number;
  class_name: string;
  academic_session: string;
  subject_id: number | null;
  subject_name: string | null;
};
type Member = {
  id: number;
  public_id?: string;
  name: string;
  email: string;
  role: string;
  assignment_count?: number;
  assignments?: StaffAssignment[];
};
type MyAssignment = {
  type: "class_teacher" | "subject_teacher";
  class_id: number;
  subject_id: number | null;
};
type Roster = {
  classes: SchoolClass[];
  subjects: Subject[];
  students: Student[];
  members: Member[];
  my_assignments: MyAssignment[];
};
type WorkspaceResponse = {
  workspace: SchoolWorkspace | null;
  workspaces: SchoolWorkspace[];
};

const navigation: Array<{
  id: Page;
  label: string;
  icon: typeof LayoutDashboard;
  group: "core" | "setup";
}> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, group: "core" },
  {
    id: "intelligence",
    label: "Academic intelligence",
    icon: BarChart3,
    group: "core",
  },
  { id: "assistant", label: "My classes", icon: Sparkles, group: "core" },
  {
    id: "students",
    label: "Students & classes",
    icon: UsersRound,
    group: "core",
  },
  { id: "reports", label: "Reports", icon: FileText, group: "core" },
  { id: "staff", label: "Staff & access", icon: UsersRound, group: "setup" },
  { id: "settings", label: "School settings", icon: Settings2, group: "setup" },
];

function EmptyPanel({
  icon: Icon,
  eyebrow,
  title,
  copy,
  action,
  onAction,
}: {
  icon: typeof FileSpreadsheet;
  eyebrow: string;
  title: string;
  copy: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <article className="school-app-panel school-app-empty-panel">
      <span className="school-app-empty-icon">
        <Icon size={25} />
      </span>
      <span>{eyebrow}</span>
      <h3>{title}</h3>
      <p>{copy}</p>
      <button
        type="button"
        className="school-app-button primary"
        onClick={onAction}
      >
        {action}
        <ArrowRight size={16} />
      </button>
    </article>
  );
}

function SetupStep({
  number,
  icon: Icon,
  title,
  copy,
  action,
  onAction,
}: {
  number: string;
  icon: typeof FileSpreadsheet;
  title: string;
  copy: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <article className="school-app-setup-step">
      <span>{number}</span>
      <Icon size={20} />
      <div>
        <h3>{title}</h3>
        <p>{copy}</p>
      </div>
      <button type="button" onClick={onAction}>
        {action}
        <ArrowRight size={15} />
      </button>
    </article>
  );
}

export function SchoolsDashboard() {
  const searchParams = useSearchParams();
  const pageFromSearch = (value: string | null): Page =>
    value === "assessments"
      ? "assistant"
      : navigation.some((item) => item.id === value)
        ? (value as Page)
        : "overview";
  const [page, setPage] = useState<Page>(() =>
    pageFromSearch(searchParams.get("section")),
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [workspace, setWorkspace] = useState<
    SchoolWorkspace | null | undefined
  >(undefined);
  const [workspaces, setWorkspaces] = useState<SchoolWorkspace[]>([]);
  const [roster, setRoster] = useState<Roster | undefined>(undefined);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const canAccessSetup = workspace?.role === "admin" || workspace?.role === "academic_head";

  const workspacePath = (schoolId?: number) =>
    `/schools/workspace/${schoolId ? `?school_id=${schoolId}` : ""}`;
  const rosterPath = (schoolId?: number) =>
    `/schools/roster/${schoolId ? `?school_id=${schoolId}` : ""}`;
  const loadWorkspace = async (schoolId?: number) => {
    const [workspaceResult, rosterResult] = await Promise.all([
      api<WorkspaceResponse>(workspacePath(schoolId)),
      api<Roster>(rosterPath(schoolId)),
    ]);
    setWorkspace(workspaceResult.workspace);
    setWorkspaces(workspaceResult.workspaces);
    setRoster(rosterResult);
  };

  useEffect(() => {
    let active = true;
    const savedSchoolId =
      Number(window.localStorage.getItem("neba_school_workspace")) || undefined;
    Promise.all([
      api<WorkspaceResponse>(workspacePath(savedSchoolId)),
      api<Roster>(rosterPath(savedSchoolId)),
    ])
      .then(([workspaceResult, rosterResult]) => {
        if (active) {
          setWorkspace(workspaceResult.workspace);
          setWorkspaces(workspaceResult.workspaces);
          setRoster(rosterResult);
        }
      })
      .catch(() => {
        if (active)
          setLoadError(
            "We could not load your school workspace. Refresh the page to try again.",
          );
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const requestedPage = pageFromSearch(searchParams.get("section"));
    setPage(!canAccessSetup && (requestedPage === "staff" || requestedPage === "settings") ? "overview" : requestedPage);
  }, [searchParams, canAccessSetup]);

  const selectPage = (next: Page) => {
    if (!canAccessSetup && (next === "staff" || next === "settings")) {
      setPage("overview");
      setNotice("Setup is available to school heads only.");
      return;
    }
    setSelectedMember(null);
    setPage(next);
    setMobileOpen(false);
    setNotice("");
  };
  const pageName =
    navigation.find((item) => item.id === page)?.label || "Overview";
  const startImport = () => {
    selectPage("assistant");
    setNotice(
      "Choose a class and subject, then use Score entry to import CSV results or record scores manually.",
    );
  };

  const switchWorkspace = async (schoolId: number) => {
    setSwitchOpen(false);
    setRoster(undefined);
    try {
      await loadWorkspace(schoolId);
      window.localStorage.setItem("neba_school_workspace", String(schoolId));
      setPage("overview");
      setNotice("School workspace switched.");
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "We could not switch school workspaces.",
      );
    }
  };

  const createRecord = async (payload: Record<string, string | number>) => {
    setSaving(true);
    try {
      const activeSchoolId = workspace?.id;
      await api(
        activeSchoolId ? rosterPath(activeSchoolId) : "/schools/roster/",
        { method: "POST", body: JSON.stringify(payload) },
      );
      await loadWorkspace(activeSchoolId);
      setNotice(
        payload.action === "student"
          ? "Student added to your school workspace."
          : payload.action === "member"
            ? "Staff member added to your school workspace."
            : `${payload.action === "class" ? "Class" : "Subject"} saved to your school workspace.`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "That record could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  const openMember = async (member: Member) => {
    setSelectedMember(member);
    if (!member.public_id || !workspace) return;
    try {
      setSelectedMember(
        await api<Member>(
          `/schools/members/${member.public_id}/?school_id=${workspace.id}`,
        ),
      );
    } catch {
      setNotice("This staff record could not be loaded.");
    }
  };

  if (workspace === undefined || roster === undefined)
    return (
      <main className="school-app school-app-loading" aria-live="polite">
        <p>Loading your school workspace…</p>
      </main>
    );
  if (loadError)
    return (
      <main className="school-app school-app-loading">
        <div>
          <h1>Your workspace could not be loaded.</h1>
          <p>{loadError}</p>
          <button
            className="school-app-button primary"
            type="button"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      </main>
    );
  if (workspace === null)
    return (
      <main className="school-app school-app-loading">
        <div>
          <span>NO SCHOOL WORKSPACE</span>
          <h1>Set up your school to continue.</h1>
          <p>
            Your Neba account is protected, but it is not connected to a school
            workspace yet.
          </p>
          <Link className="school-app-button primary" href="/schools/setup">
            Set up your school <ArrowRight size={16} />
          </Link>
        </div>
      </main>
    );

  return (
    <div className="school-app school-app-empty-workspace">
      <aside className={`school-app-sidebar${mobileOpen ? " open" : ""}`}>
        <div className="school-app-brand">
          <Link href="/schools" aria-label="Neba for Schools home">
            <GraduationCap size={24} />
            <span>neba</span>
          </Link>
          <b>FOR SCHOOLS</b>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X size={19} />
          </button>
        </div>
        <div className="school-app-school-switch">
          <button
            type="button"
            onClick={() => setSwitchOpen((open) => !open)}
            aria-expanded={switchOpen}
          >
            <span>SCHOOL WORKSPACE</span>
            <strong>{workspace.name}</strong>
            <ChevronDown size={15} />
          </button>
          {switchOpen && (
            <div className="school-app-workspace-menu">
              <span>YOUR SCHOOLS</span>
              {workspaces.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={item.id === workspace.id ? "active" : ""}
                  onClick={() => void switchWorkspace(item.id)}
                >
                  <strong>{item.name}</strong>
                  <small>{item.role.replace("_", " ")}</small>
                </button>
              ))}
              <Link href="/schools/setup">
                Add another school <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </div>
        <nav aria-label="Schools workspace navigation">
          <span className="school-app-nav-label">ACADEMIC WORKSPACE</span>
          {navigation
            .filter((item) => item.group === "core")
            .map(({ id, label, icon: Icon }) => (
              <button
                type="button"
                key={id}
                className={page === id ? "active" : ""}
                onClick={() => selectPage(id)}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            ))}
          {canAccessSetup && <>
            <span className="school-app-nav-label setup">SETUP</span>
            {navigation
              .filter((item) => item.group === "setup")
              .map(({ id, label, icon: Icon }) => (
                <button
                  type="button"
                  key={id}
                  className={page === id ? "active" : ""}
                  onClick={() => selectPage(id)}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </button>
              ))}
          </>}
        </nav>
        <div className="school-app-sidebar-bottom">
          <div>
            <span>{workspace.role.replace("_", " ").toUpperCase()}</span>
            <p>Your school workspace is private to approved members.</p>
          </div>
          <Link href="/schools">
            About Neba for Schools <ArrowUpRight size={14} />
          </Link>
        </div>
      </aside>

      <section className="school-app-main">
        <header className="school-app-topbar">
          <button
            className="school-app-menu"
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={21} />
          </button>
          <div>
            <span>
              {workspace.name.toUpperCase()} <ChevronRight size={13} />{" "}
              {pageName.toUpperCase()}
            </span>
            <h1>
              {page === "overview" ? "Your academic workspace." : pageName}
            </h1>
          </div>
          <div className="school-app-top-actions">
            <Link href="/schools" className="school-app-top-link">
              Neba for Schools <ArrowUpRight size={14} />
            </Link>
          </div>
        </header>
        <div className="school-app-context">
          <span>
            <i /> PRIVATE SCHOOL WORKSPACE
          </span>
          <p>
            Only approved members of {workspace.name} can access this workspace.
          </p>
        </div>
        <main className="school-app-content">
          {notice && (
            <div className="school-app-notice" role="status">
              {notice}
              <button
                type="button"
                onClick={() => setNotice("")}
                aria-label="Dismiss"
              >
                <X size={15} />
              </button>
            </div>
          )}
          {selectedMember ? (
            <StaffRecord
              member={selectedMember}
              schoolId={workspace.id}
              classes={roster.classes}
              subjects={roster.subjects}
              canManage={workspace.role === "admin"}
              onBack={() => setSelectedMember(null)}
              onChanged={(updated) => setSelectedMember(updated)}
            />
          ) : (
            renderPage(workspace, roster)
          )}
        </main>
      </section>
      {mobileOpen && (
        <button
          className="school-app-backdrop"
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}
    </div>
  );

  function renderPage(school: SchoolWorkspace, schoolRoster: Roster) {
    const roster = schoolRoster;
    if (page === "overview")
      return (
        <>
          <section className="school-app-page-heading">
            <div>
              <span>GET STARTED</span>
              <h2>Start your school&apos;s academic workflow.</h2>
              <p>
                {school.name} is ready. Begin with one assessment result set
                your academic team is ready to review.
              </p>
            </div>
            <button
              type="button"
              className="school-app-button primary"
              onClick={startImport}
            >
              <Upload size={16} /> Record results
            </button>
          </section>
          <section
            className="school-app-empty-stats"
            aria-label="School workspace setup summary"
          >
            <article>
              <span>CLASSES</span>
              <strong>{school.classes_count}</strong>
              <small>
                {school.role === "teacher"
                  ? "Visible through your assignments"
                  : "Managed in school settings"}
              </small>
            </article>
            <article>
              <span>STUDENTS</span>
              <strong>{school.students_count}</strong>
              <small>
                {school.role === "teacher"
                  ? "Visible in your assigned classes"
                  : "Stored in this private workspace"}
              </small>
            </article>
            <article>
              <span>SUBJECTS</span>
              <strong>{school.subjects_count}</strong>
              <small>
                {school.role === "teacher"
                  ? "Available for your teaching work"
                  : "Used to organise assessment results"}
              </small>
            </article>
            <article>
              <span>LEARNING GAPS</span>
              <strong>-</strong>
              <small>Shown after topic mapping</small>
            </article>
          </section>
          <section className="school-app-first-steps">
            <header>
              <div>
                <span>YOUR FIRST WORKFLOW</span>
                <h3>From result sheet to a better next lesson.</h3>
              </div>
              <FileSpreadsheet size={20} />
            </header>
            <div>
              <SetupStep
                number="01"
                icon={FolderCog}
                title="Review your school setup"
                copy="Your classes and subjects are private to this workspace. Add to them as your academic workflow grows."
                action="Open settings"
                onAction={() => selectPage("settings")}
              />
              <SetupStep
                number="02"
                icon={Upload}
                title="Record assessment results"
                copy="Open a class and subject, then enter scores manually or import a CSV result sheet."
                action="Open score entry"
                onAction={startImport}
              />
              <SetupStep
                number="03"
                icon={BarChart3}
                title="Review the evidence"
                copy="Map scores to topics, let teachers check the signals, and plan a measured intervention."
                action="Explore intelligence"
                onAction={() => selectPage("intelligence")}
              />
            </div>
          </section>
        </>
      );
    if (page === "intelligence")
      return (
        <AcademicCommandCentre
          schoolId={school.id}
          onOpenClasses={() => selectPage("assistant")}
        />
      );
    if (page === "assistant")
      return (
        <TeacherClasses
          school={school}
          classes={roster.classes}
          subjects={roster.subjects}
          rosterStudents={roster.students}
          assignments={roster.my_assignments}
        />
      );
    if (page === "students")
      return (
        <StudentsPage
          school={school}
          roster={roster}
          showForm={showStudentForm}
          setShowForm={setShowStudentForm}
          saving={saving}
          createRecord={createRecord}
          onImported={() => loadWorkspace(school.id)}
        />
      );
    if (page === "reports")
      return (
        <section className="school-app-page">
          <div className="school-app-page-heading">
            <div>
              <span>REPORTS</span>
              <h2>Review the story behind a term&apos;s results.</h2>
              <p>
                Report cards and class summaries will only be available after
                your team reviews the underlying assessment records.
              </p>
            </div>
          </div>
          <EmptyPanel
            icon={FileText}
            eyebrow="NO REPORTS READY"
            title="Reports will appear after results are reviewed."
            copy="Neba will keep formal reporting separate from learning recommendations, so school leaders can review both before anything is published."
            action="Open score entry"
            onAction={() => selectPage("assistant")}
          />
        </section>
      );
    if (page === "staff")
      return (
        <section className="school-app-page">
          <div className="school-app-page-heading">
            <div>
              <span>STAFF & ACCESS</span>
              <h2>Staff in {school.name}.</h2>
              <p>
                Give each teacher the classes they lead and the subjects they
                teach. These assignments provide the foundation for scoped
                access.
              </p>
            </div>
            <button
              className="school-app-button primary"
              onClick={() => setShowStaffForm((show) => !show)}
            >
              Add staff <ArrowRight size={15} />
            </button>
          </div>
          {showStaffForm && (
            <article className="school-app-panel school-app-record-form school-app-inline-form">
              <span>ADD STAFF</span>
              <h3>Add an existing Neba member</h3>
              <form
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  void createRecord({
                    action: "member",
                    email: String(data.get("email") || ""),
                    role: String(data.get("role") || "teacher"),
                  });
                  event.currentTarget.reset();
                  setShowStaffForm(false);
                }}
              >
                <label>
                  Neba account email
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="teacher@school.edu"
                  />
                </label>
                <label>
                  School role
                  <select name="role">
                    <option value="teacher">Teacher</option>
                    <option value="academic_head">Academic head</option>
                    <option value="admin">School admin</option>
                  </select>
                </label>
                <button className="school-app-button primary" disabled={saving}>
                  {saving ? "Saving…" : "Add staff member"}
                  <ArrowRight size={15} />
                </button>
              </form>
            </article>
          )}
          <article className="school-app-panel school-app-record-list">
            <header>
              <div>
                <span>ACTIVE MEMBERS</span>
                <h3>
                  {roster.members.length} school member
                  {roster.members.length === 1 ? "" : "s"}
                </h3>
              </div>
            </header>
            {roster.members.length ? (
              <div className="school-app-table staff-table">
                <div className="table-head">
                  <span>MEMBER</span>
                  <span>EMAIL</span>
                  <span>ROLE & ASSIGNMENTS</span>
                </div>
                {roster.members.map((member) => (
                  <button
                    type="button"
                    className="school-app-table-row school-app-row-link"
                    onClick={() => void openMember(member)}
                    key={member.id}
                  >
                    <strong>{member.name}</strong>
                    <span>{member.email || "—"}</span>
                    <span>
                      {member.role.replace("_", " ")} ·{" "}
                      {member.assignment_count || 0} assignment
                      {member.assignment_count === 1 ? "" : "s"}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="school-app-empty">
                <UsersRound size={28} />
                <p>
                  No active school members yet. Select Add staff to add the
                  first one.
                </p>
              </div>
            )}
          </article>
          <section className="school-app-assignment-rule">
            <Settings2 size={20} />
            <div>
              <h3>
                Roles describe authority; assignments describe responsibility.
              </h3>
              <p>
                Class teacher assignments cover a specific class. Subject
                teacher assignments pair one subject with one class, so access
                can stay precise as the workspace grows.
              </p>
            </div>
          </section>
        </section>
      );
    return (
      <section className="school-app-page">
        <div className="school-app-page-heading">
          <div>
            <span>SCHOOL SETTINGS</span>
            <h2>Set the foundation for your school workspace.</h2>
            <p>
              Classes and subjects are available only to approved members of{" "}
              {school.name}.
            </p>
          </div>
        </div>
        <section className="school-app-record-grid">
          <article className="school-app-panel school-app-record-form">
            <span>ACADEMIC STRUCTURE</span>
            <h3>Add a class</h3>
            <form
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void createRecord({
                  action: "class",
                  name: String(data.get("name") || ""),
                  academic_session: String(data.get("academic_session") || ""),
                });
                event.currentTarget.reset();
              }}
            >
              <label>
                Class name
                <input name="name" placeholder="JSS 1" required />
              </label>
              <label>
                Academic session
                <input
                  name="academic_session"
                  placeholder="2026/2027"
                  required
                />
              </label>
              <button className="school-app-button primary" disabled={saving}>
                {saving ? "Saving…" : "Save class"}
                <ArrowRight size={15} />
              </button>
            </form>
            <div className="school-app-chip-list">
              {roster.classes.map((item) => (
                <span key={item.id}>
                  {item.name} <small>{item.academic_session}</small>
                </span>
              )) || <p>No classes yet.</p>}
            </div>
          </article>
          <article className="school-app-panel school-app-record-form">
            <span>CURRICULUM</span>
            <h3>Add a subject</h3>
            <form
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void createRecord({
                  action: "subject",
                  name: String(data.get("name") || ""),
                  code: String(data.get("code") || ""),
                });
                event.currentTarget.reset();
              }}
            >
              <label>
                Subject name
                <input name="name" placeholder="Mathematics" required />
              </label>
              <label>
                Subject code <small>Optional</small>
                <input name="code" placeholder="MTH" />
              </label>
              <button className="school-app-button primary" disabled={saving}>
                {saving ? "Saving…" : "Save subject"}
                <ArrowRight size={15} />
              </button>
            </form>
            <div className="school-app-chip-list">
              {roster.subjects.map((item) => (
                <span key={item.id}>
                  {item.name}
                  {item.code ? <small>{item.code}</small> : null}
                </span>
              )) || <p>No subjects yet.</p>}
            </div>
          </article>
        </section>
      </section>
    );
  }
}

type RosterImportPreview = {
  valid: boolean;
  needs_mapping?: boolean;
  columns: string[];
  mapping: Record<string, string>;
  row_count: number;
  valid_count: number;
  errors: string[];
  rows: Array<{
    first_name: string;
    last_name: string;
    class_id: number;
    class_name: string;
    admission_number: string;
    admission_year: number;
    existing: boolean;
  }>;
  source_name?: string;
};

function RosterImport({
  school,
  roster,
  onImported,
}: {
  school: SchoolWorkspace;
  roster: Roster;
  onImported: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<RosterImportPreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({
    first_name: "",
    last_name: "",
    class_name: "",
    admission_number: "",
    admission_year: "",
  });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewFile = async (selectedFile: File, selectedMapping = mapping) => {
    const form = new FormData();
    form.append("action", "student_import_file_preview");
    form.append("file", selectedFile);
    Object.entries(selectedMapping).forEach(([key, value]) => {
      if (value) form.append(`${key}_column`, value);
    });
    setBusy(true);
    try {
      const result = await api<RosterImportPreview>(
        `/schools/roster/?school_id=${school.id}`,
        { method: "POST", body: form },
      );
      setPreview(result);
      setMapping(result.mapping);
      setMessage(
        result.valid
          ? `${result.valid_count} roster rows are ready.`
          : result.needs_mapping
            ? "Choose the required columns, then validate again."
            : `${result.errors.length} issue${result.errors.length === 1 ? "" : "s"} must be corrected before import.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The roster file could not be read.",
      );
    } finally {
      setBusy(false);
    }
  };
  const importRoster = async () => {
    if (!preview?.valid) return;
    setBusy(true);
    try {
      const result = await api<{
        created_count: number;
        matched_count: number;
      }>(`/schools/roster/?school_id=${school.id}`, {
        method: "POST",
        body: JSON.stringify({
          action: "student_import",
          rows: preview.rows,
          source_name:
            file?.name || preview.source_name || "student-roster.csv",
        }),
      });
      setMessage(
        `${result.created_count} students added and ${result.matched_count} existing records matched.`,
      );
      setPreview(null);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      await onImported();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The roster could not be imported.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="school-app-panel school-app-record-form school-app-inline-form school-roster-import">
      <div className="school-roster-import-heading">
        <div>
          <span>IMPORT EXISTING ROSTER</span>
          <h3>Bring in your current student list</h3>
          <p>
            Start with the file your school already has. Neba will preview it,
            match existing students by admission number, and create stable Neba
            IDs for new records.
          </p>
        </div>
        <span className="school-roster-import-step">
          1 <small>UPLOAD</small>
        </span>
      </div>
      <div className="school-roster-import-flow">
        <div className="school-roster-upload">
          <input
            id="roster-file"
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (selected) {
                setFile(selected);
                void previewFile(selected);
              }
            }}
          />
          <label htmlFor="roster-file">
            <span className="school-roster-upload-icon">
              <Upload size={18} />
            </span>
            <strong>
              {file ? "Replace roster file" : "Choose a roster file"}
            </strong>
            <small>CSV or XLSX · student names and class required</small>
          </label>
          {file && (
            <div className="school-roster-file">
              <FileSpreadsheet size={16} />
              <span>
                {file.name}
                <small>
                  {preview
                    ? `${preview.row_count} rows detected`
                    : "Reading file…"}
                </small>
              </span>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setPreview(null);
                  setMessage("");
                  if (inputRef.current) inputRef.current.value = "";
                }}
                aria-label="Remove selected roster file"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
        {preview && preview.columns.length > 0 && (
          <div className="school-roster-import-step-block">
            <div className="school-roster-import-step-label">
              <span>
                2 <small>CHECK COLUMNS</small>
              </span>
              <p>Tell Neba which columns contain each student detail.</p>
            </div>
            <div className="school-app-question-map">
              <label>
                First name
                <select
                  value={mapping.first_name}
                  onChange={(event) =>
                    setMapping({ ...mapping, first_name: event.target.value })
                  }
                >
                  <option value="">Choose column</option>
                  {preview.columns.map((column) => (
                    <option key={`first-${column}`} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Last name
                <select
                  value={mapping.last_name}
                  onChange={(event) =>
                    setMapping({ ...mapping, last_name: event.target.value })
                  }
                >
                  <option value="">Choose column</option>
                  {preview.columns.map((column) => (
                    <option key={`last-${column}`} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Class
                <select
                  value={mapping.class_name}
                  onChange={(event) =>
                    setMapping({ ...mapping, class_name: event.target.value })
                  }
                >
                  <option value="">Choose column</option>
                  {preview.columns.map((column) => (
                    <option key={`class-${column}`} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Admission number <small>Recommended</small>
                <select
                  value={mapping.admission_number}
                  onChange={(event) =>
                    setMapping({
                      ...mapping,
                      admission_number: event.target.value,
                    })
                  }
                >
                  <option value="">Not included</option>
                  {preview.columns.map((column) => (
                    <option key={`admission-${column}`} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Admission year <small>Optional</small>
                <select
                  value={mapping.admission_year}
                  onChange={(event) =>
                    setMapping({
                      ...mapping,
                      admission_year: event.target.value,
                    })
                  }
                >
                  <option value="">Not included</option>
                  {preview.columns.map((column) => (
                    <option key={`year-${column}`} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}
      </div>
      {preview?.row_count ? (
        <div className="school-roster-import-summary">
          <strong>
            {preview.valid_count} of {preview.row_count} rows ready
          </strong>
          <span>
            {preview.rows.filter((row) => row.existing).length} existing records
            will be matched
          </span>
        </div>
      ) : null}
      {preview && !preview.valid && (
        <div className="school-app-notice">
          {preview.errors.map((error) => (
            <span key={error}>{error}</span>
          ))}
        </div>
      )}
      <div className="school-app-evidence-actions">
        {file && (
          <button
            type="button"
            className="school-app-button quiet"
            onClick={() => void previewFile(file)}
            disabled={busy}
          >
            Validate roster
          </button>
        )}
        {preview?.valid && (
          <button
            type="button"
            className="school-app-button primary"
            onClick={() => void importRoster()}
            disabled={busy}
          >
            {busy ? "Importing…" : `Import ${preview.valid_count} students`}
            <ArrowRight size={15} />
          </button>
        )}
      </div>
      {message && (
        <p className="school-app-notice" role="status">
          {message}
        </p>
      )}
    </article>
  );
}

function StudentsPage({
  school,
  roster,
  showForm,
  setShowForm,
  saving,
  createRecord,
  onImported,
}: {
  school: SchoolWorkspace;
  roster: Roster;
  showForm: boolean;
  setShowForm: (value: boolean | ((current: boolean) => boolean)) => void;
  saving: boolean;
  createRecord: (payload: Record<string, string | number>) => Promise<void>;
  onImported: () => Promise<void>;
}) {
  const [classId, setClassId] = useState("all");
  const visibleStudents =
    classId === "all"
      ? roster.students
      : roster.students.filter(
          (student) => String(student.school_class) === classId,
        );
  const ranked = [...visibleStudents]
    .filter(
      (student) =>
        student.academic_average !== null &&
        student.academic_average !== undefined,
    )
    .sort(
      (left, right) =>
        (right.academic_average || 0) - (left.academic_average || 0),
    );
  const leader = ranked[0];
  return (
    <section className="school-app-page">
      <div className="school-app-page-heading">
        <div>
          <span>STUDENTS & CLASSES</span>
          <h2>Students in {school.name}.</h2>
          <p>
            Filter the roster by class, compare recorded performance, and open a
            learner&apos;s evidence-backed profile.
          </p>
        </div>
        <button
          className="school-app-button primary"
          onClick={() => setShowForm((show) => !show)}
        >
          Add student <ArrowRight size={15} />
        </button>
      </div>
      <RosterImport school={school} roster={roster} onImported={onImported} />
      {showForm && (
        <article className="school-app-panel school-app-record-form school-app-inline-form">
          <span>NEW STUDENT</span>
          <h3>Create a student record</h3>
          {roster.classes.length ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void createRecord({
                  action: "student",
                  first_name: String(data.get("first_name") || ""),
                  last_name: String(data.get("last_name") || ""),
                  admission_year: Number(data.get("admission_year")),
                  school_class: Number(data.get("school_class")),
                });
                event.currentTarget.reset();
                setShowForm(false);
              }}
            >
              <label>
                First name
                <input name="first_name" required />
              </label>
              <label>
                Last name
                <input name="last_name" required />
              </label>
              <label>
                Admission year
                <input
                  name="admission_year"
                  type="number"
                  defaultValue={new Date().getFullYear()}
                  min="2000"
                  required
                />
              </label>
              <label>
                Class
                <select name="school_class" required>
                  {roster.classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.academic_session}
                    </option>
                  ))}
                </select>
              </label>
              <button className="school-app-button primary" disabled={saving}>
                {saving ? "Saving…" : "Create student"}
                <ArrowRight size={15} />
              </button>
            </form>
          ) : (
            <p>Add a class in School settings before creating students.</p>
          )}
        </article>
      )}
      <section className="school-student-overview">
        <article className="school-student-leader">
          <div>
            <span>TOP RECORDED PERFORMANCE</span>
            <Trophy size={22} />
          </div>
          {leader ? (
            <>
              <strong>{leader.full_name}</strong>
              <p>
                {leader.class_name} · {leader.academic_average}% across{" "}
                {leader.assessments_recorded} assessment
                {leader.assessments_recorded === 1 ? "" : "s"}
              </p>
              <Link href={`/schools/dashboard/students/${leader.public_id}`}>
                View academic profile <ArrowRight size={14} />
              </Link>
            </>
          ) : (
            <>
              <strong>No ranking yet</strong>
              <p>
                Enter assessment results to compare students with recorded
                evidence.
              </p>
            </>
          )}
        </article>
        <article className="school-student-filter">
          <label htmlFor="student-class-filter">CLASS ROSTER</label>
          <select
            id="student-class-filter"
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
          >
            <option value="all">All classes</option>
            {roster.classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.academic_session}
              </option>
            ))}
          </select>
          <p>
            {visibleStudents.length} active student
            {visibleStudents.length === 1 ? "" : "s"}
            {classId === "all" ? " across the school" : " in this class"}.
          </p>
        </article>
      </section>
      <article className="school-app-panel school-app-record-list">
        <header>
          <div>
            <span>STUDENT RECORDS</span>
            <h3>
              {visibleStudents.length} active student
              {visibleStudents.length === 1 ? "" : "s"}
            </h3>
          </div>
          <small>Academic averages use entered scores only.</small>
        </header>
        {visibleStudents.length ? (
          <div className="school-app-table student-table">
            <div className="table-head">
              <span>STUDENT</span>
              <span>CLASS</span>
              <span>ACADEMICS</span>
              <span>ATTENDANCE</span>
            </div>
            {visibleStudents.map((student) => (
              <Link
                className="school-app-table-row school-app-row-link"
                href={`/schools/dashboard/students/${student.public_id}`}
                key={student.id}
              >
                <strong>
                  {student.full_name}
                  <small>{student.student_id || "Preparing ID…"}</small>
                </strong>
                <span>{student.class_name}</span>
                <span>
                  {student.academic_average === null ||
                  student.academic_average === undefined
                    ? "No scores"
                    : `${student.academic_average}% · ${student.assessments_recorded} recorded`}
                </span>
                <span>
                  {student.attendance_rate === null ||
                  student.attendance_rate === undefined
                    ? "Not marked"
                    : `${student.attendance_rate}%`}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="school-app-empty">
            <UsersRound size={28} />
            <p>No students match this class filter.</p>
          </div>
        )}
      </article>
    </section>
  );
}

type IntelligenceSignal = {
  topic: string;
  class_id: number;
  class_name: string;
  subject_id: number;
  subject_name: string;
  average: number;
  assessed_students: number;
  assessments: number;
  coverage: number;
  confidence: "insufficient" | "early" | "sufficient";
  evidence: string;
  evidence_sources: Array<{
    id: number;
    title: string;
    date: string;
    evidence_type: "question-level" | "topic-tagged";
  }>;
};
type IntelligenceData = {
  summary: {
    overall_average: number | null;
    students_assessed: number;
    topics_needing_attention: number;
    active_interventions: number;
  };
  topic_signals: IntelligenceSignal[];
  interventions: Array<{
    id: number;
    topic: string;
    title: string;
    status: string;
    class_name: string;
    subject_name: string;
    baseline_average: number | null;
  }>;
};

function AcademicIntelligence({
  schoolId,
  onOpenAssessments,
}: {
  schoolId: number;
  onOpenAssessments: () => void;
}) {
  const [data, setData] = useState<IntelligenceData | null>(null);
  const [selected, setSelected] = useState<IntelligenceSignal | null>(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    try {
      const result = await api<IntelligenceData>(
        `/schools/intelligence/?school_id=${schoolId}`,
      );
      setData(result);
      setSelected(
        (current) =>
          (current &&
            result.topic_signals.find(
              (item) =>
                item.topic === current.topic &&
                item.class_id === current.class_id &&
                item.subject_id === current.subject_id,
            )) ||
          result.topic_signals[0] ||
          null,
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Academic intelligence could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [schoolId]);
  const createIntervention = async () => {
    if (!selected) return;
    try {
      const result = await api<{ title: string }>(
        `/schools/intelligence/?school_id=${schoolId}`,
        {
          method: "POST",
          body: JSON.stringify({
            class_id: selected.class_id,
            subject_id: selected.subject_id,
            topic: selected.topic,
            baseline_average: selected.average,
            rationale: `${selected.evidence} The teacher should review the assessment items before selecting practice or reteaching.`,
          }),
        },
      );
      setNotice(
        `Draft intervention created: ${result.title}. Review and edit it before using it with learners.`,
      );
      await load();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "The intervention draft could not be created.",
      );
    }
  };
  if (loading)
    return (
      <section className="school-app-page">
        <div className="school-app-page-heading">
          <div>
            <span>ACADEMIC INTELLIGENCE</span>
            <h2>Reading the evidence…</h2>
          </div>
        </div>
      </section>
    );
  const summary = data?.summary;
  if (!data || !data.topic_signals.length)
    return (
      <section className="school-app-page">
        <div className="school-app-page-heading">
          <div>
            <span>ACADEMIC INTELLIGENCE</span>
            <h2>Start with evidence you can explain.</h2>
            <p>
              Tag an assessment with the topics it covers, enter scores, and
              Neba will surface topic signals for teacher review.
            </p>
          </div>
        </div>
        <EmptyPanel
          icon={BarChart3}
          eyebrow="NO TOPIC-TAGGED RESULTS"
          title="There are no topic signals to review yet."
          copy="Create an assessment in My classes, add the topics assessed, and enter scores. Neba will show the coverage behind every finding—never a confident diagnosis from an unsupported mark."
          action="Open My classes"
          onAction={onOpenAssessments}
        />
      </section>
    );
  return (
    <section className="school-app-page">
      <div className="school-app-page-heading">
        <div>
          <span>ACADEMIC INTELLIGENCE</span>
          <h2>
            Start with the evidence. <em>Then choose the response.</em>
          </h2>
          <p>
            Signals are calculated from recorded scores in topic-tagged
            assessments. They support teacher judgment; they do not diagnose
            learners automatically.
          </p>
        </div>
      </div>
      {notice && (
        <div className="school-app-notice" role="status">
          {notice}
          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      )}
      <section
        className="school-app-stats"
        aria-label="Academic intelligence summary"
      >
        <article>
          <span>OVERALL AVERAGE</span>
          <strong>
            {summary?.overall_average ?? "—"}
            {summary?.overall_average !== null && <em>%</em>}
          </strong>
          <small>Across recorded scores</small>
        </article>
        <article>
          <span>STUDENTS ASSESSED</span>
          <strong>{summary?.students_assessed || "—"}</strong>
          <small>In the current evidence set</small>
        </article>
        <article>
          <span>TOPICS TO REVIEW</span>
          <strong>{summary?.topics_needing_attention || "—"}</strong>
          <small>Below the 60% attention threshold</small>
        </article>
        <article>
          <span>INTERVENTIONS</span>
          <strong>{summary?.active_interventions || "—"}</strong>
          <small>Draft or active teacher follow-up</small>
        </article>
      </section>
      <section className="school-app-intelligence-layout">
        <article className="school-app-panel school-app-priorities">
          <header>
            <div>
              <span>TOPIC SIGNALS</span>
              <h3>Where a closer look may help</h3>
            </div>
            <BarChart3 size={20} />
          </header>
          {data.topic_signals.map((signal) => (
            <button
              type="button"
              className={`school-app-topic-card${selected === signal ? " selected" : ""}`}
              key={`${signal.class_id}-${signal.subject_id}-${signal.topic}`}
              onClick={() => setSelected(signal)}
            >
              <span>{signal.average < 60 ? "!" : "•"}</span>
              <div>
                <strong>{signal.topic}</strong>
                <small>
                  {signal.class_name} · {signal.subject_name}
                </small>
                <div className="school-app-track">
                  <span
                    style={{ width: `${Math.min(signal.average, 100)}%` }}
                  />
                </div>
              </div>
              <b>
                {signal.average}%
                <small>
                  {signal.confidence === "sufficient"
                    ? "Evidence ready"
                    : "Early signal"}
                </small>
              </b>
              <ChevronRight size={16} />
            </button>
          ))}
        </article>
        {selected && (
          <article className="school-app-panel school-app-performance">
            <header>
              <div>
                <span>TEACHER REVIEW</span>
                <h3>
                  {selected.topic} · {selected.class_name}
                </h3>
              </div>
              <Bot size={20} />
            </header>
            <div className="school-app-detail-score">
              <div>
                <small>TOPIC AVERAGE</small>
                <strong>{selected.average}%</strong>
              </div>
              <div>
                <small>STUDENTS COVERED</small>
                <strong>{selected.assessed_students}</strong>
              </div>
              <div>
                <small>ASSESSMENTS</small>
                <strong>{selected.assessments}</strong>
              </div>
            </div>
            <div className="school-app-hypothesis">
              <Bot size={19} />
              <div>
                <strong>
                  {selected.average < 60
                    ? "This topic needs a teacher review."
                    : "This topic is currently on track."}
                </strong>
                <p>
                  {selected.average < 60
                    ? `Results are below the 60% attention threshold. Review the assessment items and learners' work before deciding whether to reteach, practise, or run a diagnostic.`
                    : "Keep monitoring this topic with a comparable follow-up assessment before drawing a longer-term conclusion."}
                </p>
              </div>
            </div>
            <div className="school-app-detail-actions">
              <button
                type="button"
                className="school-app-button primary"
                onClick={() => void createIntervention()}
              >
                Create intervention draft <ArrowRight size={15} />
              </button>
            </div>
            <small className="school-app-disclaimer">
              {selected.evidence}{" "}
              {selected.confidence === "early"
                ? "This is an early signal, not a learning diagnosis. Add more tagged assessment evidence before making a high-confidence conclusion."
                : "Review the evidence before assigning a response."}
            </small>
          </article>
        )}
      </section>
      {!!data.interventions.length && (
        <section className="school-app-panel school-app-activity">
          <header>
            <div>
              <span>TEACHER FOLLOW-UP</span>
              <h3>Interventions to review</h3>
            </div>
            <ClipboardCheck size={20} />
          </header>
          <ol>
            {data.interventions.map((item) => (
              <li key={item.id}>
                <span className="resource">
                  <ClipboardCheck size={15} />
                </span>
                <p>
                  <strong>{item.title}</strong>
                  <small>
                    {item.class_name} · {item.subject_name} · Baseline{" "}
                    {item.baseline_average ?? "—"}% · {item.status}
                  </small>
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </section>
  );
}

function AcademicCommandCentre({
  schoolId,
  onOpenClasses,
}: {
  schoolId: number;
  onOpenClasses: () => void;
}) {
  const [data, setData] = useState<IntelligenceData | null>(null);
  const [selected, setSelected] = useState<IntelligenceSignal | null>(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const result = await api<IntelligenceData>(
        `/schools/intelligence/?school_id=${schoolId}`,
      );
      setData(result);
      setSelected(
        (current) =>
          (current &&
            result.topic_signals.find(
              (item) =>
                item.topic === current.topic &&
                item.class_id === current.class_id &&
                item.subject_id === current.subject_id,
            )) ||
          result.topic_signals[0] ||
          null,
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Academic intelligence could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [schoolId]);

  const createIntervention = async () => {
    if (!selected) return;
    try {
      const result = await api<{ title: string }>(
        `/schools/intelligence/?school_id=${schoolId}`,
        {
          method: "POST",
          body: JSON.stringify({
            class_id: selected.class_id,
            subject_id: selected.subject_id,
            topic: selected.topic,
            baseline_average: selected.average,
            rationale: `${selected.evidence} Review the assessment items before choosing reteaching, practice, or a diagnostic exercise.`,
          }),
        },
      );
      setNotice(
        `Intervention draft created: ${result.title}. Review it before using it with learners.`,
      );
      await load();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "The intervention draft could not be created.",
      );
    }
  };

  if (loading)
    return (
      <section className="school-app-page">
        <div className="school-app-page-heading">
          <div>
            <span>ACADEMIC INTELLIGENCE</span>
            <h2>Reading the academic record…</h2>
          </div>
        </div>
      </section>
    );
  if (!data || !data.topic_signals.length)
    return (
      <section className="school-app-page">
        <div className="school-app-page-heading">
          <div>
            <span>ACADEMIC INTELLIGENCE</span>
            <h2>Build the evidence base first.</h2>
            <p>
              Map assessment questions to topics and record scores. Neba will
              then surface learning patterns with their coverage and limits.
            </p>
          </div>
        </div>
        <EmptyPanel
          icon={BarChart3}
          eyebrow="NO REVIEWABLE EVIDENCE"
          title="There are no topic signals to review yet."
          copy="Academic Intelligence only makes a finding when recorded assessment evidence supports it. Create an assessment in My Classes, map its questions, and enter the results."
          action="Open My classes"
          onAction={onOpenClasses}
        />
      </section>
    );

  const summary = data.summary;
  const gaps = data.topic_signals.filter((item) => item.average < 60);
  const focus = selected || data.topic_signals[0];
  const briefing = gaps.length
    ? `${gaps.length} topic${gaps.length === 1 ? " is" : "s are"} below the current 60% review threshold. The lowest current signal is ${focus.topic} in ${focus.class_name} (${focus.average}%). Review the linked question evidence before choosing a response.`
    : "No recorded topic is below the current 60% review threshold. Continue gathering comparable evidence before treating the current pattern as a longer-term result.";

  return (
    <section className="school-app-page school-command-centre">
      <div className="school-app-page-heading school-command-heading">
        <div>
          <span>ACADEMIC INTELLIGENCE</span>
          <h2>
            Understand the pattern. <em>Choose the next response.</em>
          </h2>
          <p>
            School-wide evidence for leaders and authorized teachers—built from
            recorded assessment results, never assumed causes.
          </p>
        </div>
        <div className="school-command-scope">
          <span>EVIDENCE SCOPE</span>
          <strong>All recorded assessments</strong>
          <small>Topic-tagged results only</small>
        </div>
      </div>
      {notice && (
        <div className="school-app-notice" role="status">
          {notice}
          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      )}
      <section
        className="school-command-metrics"
        aria-label="Academic intelligence overview"
      >
        <article>
          <span>OVERALL AVERAGE</span>
          <strong>
            {summary.overall_average ?? "—"}
            {summary.overall_average !== null && <em>%</em>}
          </strong>
          <small>
            {summary.students_assessed} student
            {summary.students_assessed === 1 ? "" : "s"} represented
          </small>
        </article>
        <article>
          <span>TOPICS TO REVIEW</span>
          <strong>{summary.topics_needing_attention}</strong>
          <small>Below the 60% review threshold</small>
        </article>
        <article>
          <span>TOPIC EVIDENCE</span>
          <strong>{data.topic_signals.length}</strong>
          <small>Class, subject, and topic signals</small>
        </article>
        <article>
          <span>FOLLOW-UP DUE</span>
          <strong>{summary.active_interventions}</strong>
          <small>Draft or active interventions</small>
        </article>
      </section>
      <section className="school-command-grid">
        <article className="school-command-gaps">
          <header>
            <div>
              <span>LEARNING GAPS DETECTED</span>
              <h3>Where a closer look may help</h3>
              <p>
                Signals are ranked by recorded performance, not by assumptions
                about learners.
              </p>
            </div>
            <BarChart3 size={21} />
          </header>
          <div>
            {(gaps.length ? gaps : data.topic_signals)
              .slice(0, 6)
              .map((signal) => (
                <button
                  type="button"
                  key={`${signal.class_id}-${signal.subject_id}-${signal.topic}`}
                  className={focus === signal ? "active" : ""}
                  onClick={() => setSelected(signal)}
                >
                  <i>{signal.average < 60 ? "!" : "•"}</i>
                  <div>
                    <strong>{signal.topic}</strong>
                    <small>
                      {signal.class_name} · {signal.subject_name}
                    </small>
                    <span>
                      <b
                        style={{ width: `${Math.min(signal.average, 100)}%` }}
                      />
                    </span>
                  </div>
                  <em>
                    {signal.average}%
                    <small>
                      {signal.confidence === "sufficient"
                        ? "Evidence ready"
                        : "Early signal"}
                    </small>
                  </em>
                  <ChevronRight size={15} />
                </button>
              ))}
          </div>
        </article>
        <article className="school-command-focus">
          <header>
            <span>REVIEW THE EVIDENCE</span>
            <h3>{focus.topic}</h3>
            <p>
              {focus.class_name} · {focus.subject_name}
            </p>
          </header>
          <div className="school-command-evidence">
            <div>
              <small>TOPIC AVERAGE</small>
              <strong>{focus.average}%</strong>
            </div>
            <div>
              <small>STUDENTS COVERED</small>
              <strong>{focus.assessed_students}</strong>
            </div>
            <div>
              <small>ASSESSMENTS</small>
              <strong>{focus.assessments}</strong>
            </div>
          </div>
          <p className="school-command-explanation">
            {focus.evidence}{" "}
            {focus.average < 60
              ? "This result needs teacher review; it is not a diagnosis of why learners found it difficult."
              : "Continue with a comparable follow-up before drawing a longer-term conclusion."}
          </p>
          <button
            type="button"
            className="school-app-button primary"
            onClick={() => void createIntervention()}
          >
            Create intervention draft <ArrowRight size={15} />
          </button>
        </article>
      </section>
      <section className="school-command-performance">
        <header>
          <div>
            <span>CLASS & SUBJECT PERFORMANCE</span>
            <h3>Compare the evidence behind each signal.</h3>
          </div>
          <small>
            Coverage is shown so a low-volume result is not mistaken for a
            school-wide conclusion.
          </small>
        </header>
        <div className="school-command-performance-list">
          <div className="school-command-performance-head">
            <span>CLASS & SUBJECT</span>
            <span>TOPIC</span>
            <span>AVERAGE</span>
            <span>COVERAGE</span>
            <span>STATUS</span>
          </div>
          {data.topic_signals.map((signal) => (
            <button
              type="button"
              key={`performance-${signal.class_id}-${signal.subject_id}-${signal.topic}`}
              onClick={() => setSelected(signal)}
            >
              <span>
                {signal.class_name} · {signal.subject_name}
              </span>
              <strong>{signal.topic}</strong>
              <b>{signal.average}%</b>
              <small>
                {signal.coverage} score{signal.coverage === 1 ? "" : "s"} ·{" "}
                {signal.assessments} assessment
                {signal.assessments === 1 ? "" : "s"}
              </small>
              <em className={signal.confidence}>
                {signal.confidence === "sufficient"
                  ? "Evidence ready"
                  : "Early signal"}
              </em>
            </button>
          ))}
        </div>
      </section>
      <section className="school-command-lower">
        <article className="school-command-student-review">
          <span>STUDENTS NEEDING SUPPORT</span>
          <h3>Prioritize support with individual evidence.</h3>
          <p>
            Neba does not turn a class-level signal into a student label.
            Individual review is appropriate only when repeated, comparable
            results support it; teachers should then review the learner&apos;s
            full record before acting.
          </p>
          <button
            type="button"
            className="school-app-button quiet"
            onClick={onOpenClasses}
          >
            Review class records <ArrowRight size={15} />
          </button>
        </article>
        <article className="school-command-brief">
          <header>
            <Bot size={19} />
            <span>AI ACADEMIC BRIEFING</span>
          </header>
          <p>{briefing}</p>
          <small>
            Generated from currently recorded results. It distinguishes observed
            performance from explanations that still require teacher review.
          </small>
        </article>
      </section>
      <section className="school-command-interventions">
        <header>
          <div>
            <span>INTERVENTION TRACKING</span>
            <h3>Connect insight to follow-up.</h3>
          </div>
          <small>
            Record what was planned, then compare later evidence before deciding
            what changed.
          </small>
        </header>
        {data.interventions.length ? (
          <ol>
            {data.interventions.map((item) => (
              <li key={item.id}>
                <span>
                  <ClipboardCheck size={15} />
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <small>
                    {item.class_name} · {item.subject_name} · Baseline{" "}
                    {item.baseline_average ?? "—"}%
                  </small>
                </div>
                <em>{item.status.replace("_", " ")}</em>
              </li>
            ))}
          </ol>
        ) : (
          <div className="school-command-intervention-empty">
            <ClipboardCheck size={20} />
            <p>
              No interventions are being tracked yet. Select a topic signal
              above to create a teacher-review draft.
            </p>
          </div>
        )}
      </section>
    </section>
  );
}

type TeachingAssessment = {
  id: number;
  title: string;
  type: string;
  term: string;
  academic_session: string;
  maximum_score: number;
  status: string;
  topics: string;
  entered_scores: number;
  scores: Array<{ student_id: number; score: number | null; status: string }>;
  questions: Array<{
    id: number;
    number: number;
    topic: string;
    learning_objective: string;
    maximum_score: number | null;
    scores: Array<{ student_id: number; score: number | null; status: string }>;
  }>;
};
type TeachingWork = {
  students: Array<{
    id: number;
    student_id: string;
    first_name: string;
    last_name: string;
  }>;
  assessments: TeachingAssessment[];
  assignments: Array<{
    id: number;
    title: string;
    due_date: string | null;
    status: string;
    counts_toward_ca: boolean;
  }>;
};
type TeachingAssistantDraft = {
  title: string;
  teacher_note: string;
  evidence: {
    topic: string;
    average: number | null;
    coverage: number;
    assessments: number;
    students: number;
    confidence: "insufficient" | "early" | "sufficient";
    assessment_sources?: Array<{
      id: number;
      title: string;
      date: string;
      evidence_type: string;
    }>;
  };
  sections: Array<{ heading: string; items: string[] }>;
  review_checks: string[];
  source: "ai_draft" | "structured_fallback";
};

function TeacherClasses({
  school,
  classes,
  subjects,
  rosterStudents,
  assignments,
}: {
  school: SchoolWorkspace;
  classes: SchoolClass[];
  subjects: Subject[];
  rosterStudents: Student[];
  assignments: MyAssignment[];
}) {
  const [selectedClass, setSelectedClass] = useState<SchoolClass | null>(null);
  const [selectedTab, setSelectedTab] = useState<
    | "overview"
    | "students"
    | "performance"
    | "attendance"
    | "classwork"
    | "assessments"
    | "results"
    | "assistant"
  >("overview");
  const classSubjects = (schoolClass: SchoolClass) =>
    school.role !== "teacher" ||
    assignments.some(
      (item) =>
        item.type === "class_teacher" && item.class_id === schoolClass.id,
    )
      ? subjects
      : subjects.filter((subject) =>
          assignments.some(
            (item) =>
              item.class_id === schoolClass.id &&
              item.subject_id === subject.id,
          ),
        );
  const classRole = (schoolClass: SchoolClass) =>
    school.role !== "teacher"
      ? "Academic team"
      : assignments.some(
            (item) =>
              item.type === "class_teacher" && item.class_id === schoolClass.id,
          )
        ? "Class teacher"
        : "Subject teacher";
  const openClass = (
    schoolClass: SchoolClass | undefined,
    tab: typeof selectedTab = "overview",
  ) => {
    if (!schoolClass) return;
    setSelectedTab(tab);
    setSelectedClass(schoolClass);
  };
  if (selectedClass)
    return (
      <ClassWorkspace
        school={school}
        schoolClass={selectedClass}
        subjects={classSubjects(selectedClass)}
        rosterStudents={rosterStudents.filter(
          (student) => student.school_class === selectedClass.id,
        )}
        mode={
          classRole(selectedClass) === "Subject teacher"
            ? "subject_teacher"
            : "class_teacher"
        }
        initialTab={selectedTab}
        onBack={() => setSelectedClass(null)}
      />
    );
  const classTeacherCount = classes.filter(
    (item) => classRole(item) === "Class teacher",
  ).length;
  return (
    <section className="school-app-page school-classes-index">
      <div className="school-app-page-heading school-classes-heading">
        <div>
          <span>MY CLASSES</span>
          <h2>Your teaching desk.</h2>
          <p>
            Start with what needs your attention today, then open a class when
            you are ready to work.
          </p>
        </div>
        <div className="school-classes-role">
          <span>
            {school.role === "teacher" ? "YOUR ACCESS" : "SCHOOL VIEW"}
          </span>
          <strong>
            {school.role === "teacher"
              ? classTeacherCount
                ? "Class and subject responsibilities"
                : "Subject responsibilities"
              : "Academic team workspace"}
          </strong>
          <small>
            Records stay limited to the classes and subjects assigned to you.
          </small>
        </div>
      </div>
      <section className="school-classes-today">
        <div>
          <span className="school-classes-kicker">TODAY&apos;S DESK</span>
          <h3>Keep the academic record moving.</h3>
          <p>
            {classTeacherCount
              ? "Start with attendance, then review the evidence behind the next teaching response."
              : "Open one of your assigned subjects to record work and build useful evidence."}
          </p>
        </div>
        <div className="school-classes-today-actions">
          {classTeacherCount ? (
            <button
              type="button"
              onClick={() => openClass(classes[0], "attendance")}
              disabled={!classes.length}
            >
              <CalendarCheck2 size={17} />
              <span>
                Take attendance<small>Choose a class register</small>
              </span>
              <ArrowRight size={15} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openClass(classes[0])}
              disabled={!classes.length}
            >
              <BookOpen size={17} />
              <span>
                Open subject work<small>Continue your assigned teaching</small>
              </span>
              <ArrowRight size={15} />
            </button>
          )}
          <button
            type="button"
            onClick={() => openClass(classes[0])}
            disabled={!classes.length}
          >
            <ClipboardCheck size={17} />
            <span>
              Open teaching records<small>Continue assessment evidence</small>
            </span>
            <ArrowRight size={15} />
          </button>
        </div>
      </section>
      <section className="school-classes-summary">
        <article>
          <span>ASSIGNED CLASSES</span>
          <strong>{classes.length}</strong>
          <small>Current academic session</small>
        </article>
        <article>
          <span>STUDENTS</span>
          <strong>{rosterStudents.length}</strong>
          <small>Across available classes</small>
        </article>
        <article>
          <span>CLASS TEACHER DUTIES</span>
          <strong>{classTeacherCount}</strong>
          <small>Whole-class responsibility</small>
        </article>
        <article>
          <span>SUBJECT AREAS</span>
          <strong>
            {new Set(assignments.map((item) => item.subject_id).filter(Boolean))
              .size || subjects.length}
          </strong>
          <small>Available in your workspace</small>
        </article>
      </section>
      <section className="school-class-cards">
        <header>
          <div>
            <span>YOUR TEACHING CLASSES</span>
            <h3>Open the class or subject you need.</h3>
          </div>
          <small>
            {school.role === "teacher"
              ? "Your role is shown on every card so the scope is clear."
              : "Select a class to work with its academic records."}
          </small>
        </header>
        {classes.length ? (
          <div>
            {classes.map((item) => {
              const count = rosterStudents.filter(
                (student) => student.school_class === item.id,
              ).length;
              const availableSubjects = classSubjects(item);
              const isClassTeacher = classRole(item) === "Class teacher";
              return (
                <article className="school-class-card" key={item.id}>
                  <span className="school-class-card-mark">
                    {item.name
                      .replace(/[^A-Za-z0-9]/g, "")
                      .slice(0, 2)
                      .toUpperCase() || "C"}
                  </span>
                  <div className="school-class-card-copy">
                    <div className="school-class-card-meta">
                      <small>{item.academic_session} SESSION</small>
                      <em
                        className={
                          isClassTeacher ? "class-role" : "subject-role"
                        }
                      >
                        {classRole(item)}
                      </em>
                    </div>
                    <h4>{item.name}</h4>
                    <p>
                      {count} student{count === 1 ? "" : "s"} ·{" "}
                      {isClassTeacher
                        ? "All subjects"
                        : availableSubjects
                            .map((subject) => subject.name)
                            .join(", ") || "Assigned subject"}
                    </p>
                    <div className="school-class-card-actions">
                      <button
                        type="button"
                        className="school-app-button quiet"
                        onClick={() => openClass(item)}
                      >
                        Open class <ArrowRight size={15} />
                      </button>
                      {isClassTeacher && (
                        <button
                          type="button"
                          className="school-app-button attendance-action"
                          onClick={() => openClass(item, "attendance")}
                        >
                          Attendance <CalendarCheck2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyPanel
            icon={UsersRound}
            eyebrow="NO CLASSES AVAILABLE"
            title="There are no classes in this workspace yet."
            copy="A school admin can add classes in School settings, then assign teachers to their class and subject."
            action="Open school settings"
            onAction={() =>
              window.location.assign("/schools/dashboard?section=settings")
            }
          />
        )}
      </section>
    </section>
  );
}

type ClassIntelligenceData = {
  summary: { overall_average: number | null; students_assessed: number; topics_needing_attention: number; active_interventions: number; benchmarks: { review_threshold: number; strength_threshold: number } };
  topic_signals: Array<{ topic: string; subject: string; subject_id: number; average: number; assessed_students: number; assessments: number; coverage: number; confidence: "insufficient" | "early" | "sufficient"; evidence: string }>;
  filters: { terms: string[]; selected_term: string };
};

function ClassPerformancePanel({ work }: { work: TeachingWork }) {
  const learnerAverages = work.students.map((student) => {
    const percentages = work.assessments.flatMap((assessment) => {
      if (assessment.questions.length) {
        const scores = assessment.questions.flatMap((question) => question.scores.filter((score) => score.student_id === student.id && score.status === "entered" && score.score !== null).map((score) => ({ score: Number(score.score), maximum: question.maximum_score || 0 })));
        const maximum = scores.reduce((total, item) => total + item.maximum, 0);
        return maximum ? [scores.reduce((total, item) => total + item.score, 0) / maximum * 100] : [];
      }
      const score = assessment.scores.find((item) => item.student_id === student.id && item.status === "entered" && item.score !== null);
      return score && assessment.maximum_score ? [Number(score.score) / assessment.maximum_score * 100] : [];
    });
    return { ...student, average: percentages.length ? Math.round(percentages.reduce((total, value) => total + value, 0) / percentages.length * 10) / 10 : null, entries: percentages.length };
  }).filter((student) => student.average !== null).sort((left, right) => (right.average || 0) - (left.average || 0));
  const overall = learnerAverages.length ? Math.round(learnerAverages.reduce((total, student) => total + (student.average || 0), 0) / learnerAverages.length * 10) / 10 : null;
  const needsReview = learnerAverages.filter((student) => (student.average || 0) < 60);
  return <section className="school-class-performance"><header><div><span>RECORDED PERFORMANCE</span><h3>How learners are performing in this subject.</h3><p>Calculated from entered scores in the current teaching record, including draft assessments.</p></div><BarChart3 size={22} /></header><div className="school-class-performance-metrics"><article><span>CLASS AVERAGE</span><strong>{overall ?? "—"}{overall !== null && <em>%</em>}</strong><small>{learnerAverages.length} of {work.students.length} students covered</small></article><article><span>ASSESSMENTS</span><strong>{work.assessments.filter((assessment) => assessment.entered_scores > 0 || assessment.questions.some((question) => question.scores.some((score) => score.status === "entered"))).length}</strong><small>With recorded evidence</small></article><article><span>NEEDS REVIEW</span><strong>{needsReview.length}</strong><small>Below 60% current signal</small></article></div>{learnerAverages.length ? <div className="school-class-performance-list"><header><span>LEARNER PERFORMANCE</span><small>Use this as a prompt for review, not a label.</small></header>{learnerAverages.map((student) => <div key={student.id}><div><strong>{student.first_name} {student.last_name}</strong><small>{student.student_id} · {student.entries} recorded assessment{student.entries === 1 ? "" : "s"}</small></div><span><i><b className={(student.average || 0) < 60 ? "needs-review" : ""} style={{ width: `${student.average || 0}%` }} /></i><strong>{student.average}%</strong></span></div>)}</div> : <div className="school-class-performance-empty"><ClipboardCheck size={22} /><p>Enter scores in Results to build the class performance picture.</p></div>}</section>;
}

function ClassIntelligenceOverview({ schoolId, classId, subjects, mode, rosterCount, onOpenSubject }: { schoolId: number; classId: number; subjects: Subject[]; mode: "class_teacher" | "subject_teacher"; rosterCount: number; onOpenSubject: (subjectId: string) => void }) {
  const [subjectId, setSubjectId] = useState(mode === "subject_teacher" && subjects[0] ? String(subjects[0].id) : "all");
  const [term, setTerm] = useState("all");
  const [data, setData] = useState<ClassIntelligenceData | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const load = async () => {
    if (mode === "subject_teacher" && subjectId === "all") return;
    setLoading(true); setMessage("");
    const params = new URLSearchParams({ school_id: String(schoolId), class_id: String(classId), include_current: "1" });
    if (subjectId !== "all") params.set("subject_id", subjectId);
    if (term !== "all") params.set("term", term);
    try { setData(await api<ClassIntelligenceData>(`/schools/intelligence/?${params.toString()}`)); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Class intelligence could not be loaded."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [schoolId, classId, subjectId, term]);
  const reviewThreshold = data?.summary.benchmarks.review_threshold ?? 60;
  const weaknesses = data?.topic_signals.filter((signal) => signal.average < reviewThreshold).slice(0, 4) || [];
  const strengths = data?.topic_signals.filter((signal) => signal.average >= (data?.summary.benchmarks.strength_threshold ?? 80)).sort((left, right) => right.average - left.average).slice(0, 3) || [];
  return <section className="school-class-intelligence"><header className="school-class-intelligence-header"><div><span>CLASS INTELLIGENCE</span><h3>What the recorded evidence says so far.</h3><p>Use this as a review signal, not a final judgment about any learner or topic.</p></div><div className="school-class-intelligence-filters"><label>Subject<select value={subjectId} onChange={(event) => setSubjectId(event.target.value)} disabled={mode === "subject_teacher"}><option value="all">All subjects</option>{subjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}</select></label><label>Term<select value={term} onChange={(event) => setTerm(event.target.value)}><option value="all">All terms</option>{(data?.filters.terms || []).map((item) => <option value={item} key={item}>{item}</option>)}</select></label></div></header>{message && <p className="school-app-notice">{message}</p>}{loading ? <div className="school-class-intelligence-empty"><p>Reading recorded assessment evidence…</p></div> : data && <><div className="school-class-intelligence-metrics"><article><span>OVERALL AVERAGE</span><strong>{data.summary.overall_average ?? "—"}{data.summary.overall_average !== null && <em>%</em>}</strong><small>Across entered scores</small></article><article><span>STUDENTS COVERED</span><strong>{data.summary.students_assessed}<em>/{rosterCount}</em></strong><small>With recorded evidence</small></article><article><span>TOPICS TO REVIEW</span><strong>{data.summary.topics_needing_attention}</strong><small>Below {reviewThreshold}%</small></article><article><span>FOLLOW-UP</span><strong>{data.summary.active_interventions}</strong><small>Draft or active plans</small></article></div><div className="school-class-intelligence-columns"><article><header><div><span>AREAS TO REVIEW</span><h4>Where the class may need support</h4></div></header>{weaknesses.length ? <div className="school-class-intelligence-list">{weaknesses.map((signal) => <button type="button" key={`${signal.subject_id}-${signal.topic}`} onClick={() => onOpenSubject(String(signal.subject_id))}><div><strong>{signal.topic}</strong><small>{signal.subject} · {signal.assessed_students} students · {signal.coverage} scores</small></div><b>{signal.average}%</b><ChevronRight size={15} /></button>)}</div> : <p className="school-class-intelligence-empty-copy">No topic is below the current review threshold in this view.</p>}</article><article><header><div><span>CLEARER SIGNALS</span><h4>What is holding up well</h4></div></header>{strengths.length ? <div className="school-class-intelligence-list">{strengths.map((signal) => <button type="button" key={`${signal.subject_id}-${signal.topic}`} onClick={() => onOpenSubject(String(signal.subject_id))}><div><strong>{signal.topic}</strong><small>{signal.subject} · {signal.assessed_students} students</small></div><b>{signal.average}%</b><ChevronRight size={15} /></button>)}</div> : <p className="school-class-intelligence-empty-copy">Keep recording comparable results to build stronger signals.</p>}</article></div></>}</section>;
}

function ClassWorkspace({
  school,
  schoolClass,
  subjects,
  rosterStudents,
  mode,
  initialTab = "overview",
  onBack,
}: {
  school: SchoolWorkspace;
  schoolClass: SchoolClass;
  subjects: Subject[];
  rosterStudents: Student[];
  mode: "class_teacher" | "subject_teacher";
  initialTab?:
    | "overview"
    | "students"
    | "performance"
    | "attendance"
    | "classwork"
    | "assessments"
    | "results"
    | "assistant";
  onBack: () => void;
}) {
  const [subjectId, setSubjectId] = useState(() =>
    mode === "subject_teacher" && subjects[0] ? String(subjects[0].id) : "",
  );
  const [tab, setTab] = useState<
    | "overview"
    | "students"
    | "performance"
    | "attendance"
    | "classwork"
    | "assessments"
    | "results"
    | "assistant"
  >(initialTab);
  const [work, setWork] = useState<TeachingWork | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const subject = subjects.find((item) => String(item.id) === subjectId);
  const load = async (requestedSubjectId = subjectId) => {
    if (!requestedSubjectId) return;
    try {
      setWork(
        await api<TeachingWork>(
          `/schools/teaching-work/?school_id=${school.id}&class_id=${schoolClass.id}&subject_id=${requestedSubjectId}`,
        ),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "This class could not be loaded.",
      );
    }
  };
  const save = async (
    event: FormEvent<HTMLFormElement>,
    action: "assignment" | "assessment",
  ) => {
    event.preventDefault();
    if (!subjectId) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    const body =
      action === "assignment"
        ? {
            action,
            title: String(form.get("title") || ""),
            instructions: String(form.get("instructions") || ""),
            due_date: String(form.get("due_date") || ""),
            maximum_score: String(form.get("maximum_score") || "") || null,
            counts_toward_ca: form.get("counts_toward_ca") === "on",
          }
        : {
            action,
            title: String(form.get("title") || ""),
            assessment_type: String(form.get("assessment_type") || "ca"),
            maximum_score: String(form.get("maximum_score") || ""),
            term: String(form.get("term") || "First term"),
            academic_session: schoolClass.academic_session,
            topics: String(form.get("topics") || ""),
          };
    try {
      await api(
        `/schools/teaching-work/?school_id=${school.id}&class_id=${schoolClass.id}&subject_id=${subjectId}`,
        { method: "POST", body: JSON.stringify(body) },
      );
      formElement.reset();
      setMessage(
        `${action === "assignment" ? "Assignment" : "Assessment"} saved as a draft.`,
      );
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Record could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };
  const tabs = (
    [
      ["overview", "Overview"],
      ["students", "Students"],
      ["performance", "Performance"],
      ["attendance", "Attendance"],
      ["classwork", "Classwork"],
      ["assessments", "Assessments"],
      ["results", "Results"],
      ["assistant", "Ask Neba AI"],
    ] as const
  ).filter(([id]) => mode === "class_teacher" || id !== "attendance");
  const classOverview = (
    <section className="school-workspace-overview">
      <div className="school-workspace-hero">
        <div>
          <span>
            {mode === "class_teacher"
              ? "CLASS TEACHER WORKSPACE"
              : "SUBJECT TEACHER WORKSPACE"}
          </span>
          <h3>
            {mode === "class_teacher"
              ? "Lead the whole class from one place."
              : `Teach ${subject?.name || "your subject"} with a clear evidence trail.`}
          </h3>
          <p>
            {mode === "class_teacher"
              ? "Attendance, learners, subject progress, and follow-up all belong here."
              : "Your view is limited to this class and your assigned subject."}
          </p>
        </div>
        <div className="school-workspace-role">
          {mode === "class_teacher"
            ? "Whole-class access"
            : "Subject-scoped access"}
        </div>
      </div>
      <div className="school-workspace-actions">
        {mode === "class_teacher" && (
          <button type="button" onClick={() => setTab("attendance")}>
            <CalendarCheck2 size={18} />
            <strong>
              Attendance<small>Mark today&apos;s register</small>
            </strong>
            <ArrowRight size={15} />
          </button>
        )}
        <button type="button" onClick={() => setTab("students")}>
          <UsersRound size={18} />
          <strong>
            Review students<small>Open the class roster</small>
          </strong>
          <ArrowRight size={15} />
        </button>
        <button
          type="button"
          onClick={() =>
            mode === "class_teacher"
              ? window.location.assign(
                  "/schools/dashboard?section=intelligence",
                )
              : setTab("results")
          }
        >
          <BarChart3 size={18} />
          <strong>
            {mode === "class_teacher" ? "Class intelligence" : "Record results"}
            <small>
              {mode === "class_teacher"
                ? "See subjects needing review"
                : "Build subject evidence"}
            </small>
          </strong>
          <ArrowRight size={15} />
        </button>
      </div>
      <div className="school-workspace-scope">
        <span>
          {mode === "class_teacher"
            ? "SUBJECTS IN THIS CLASS"
            : "ASSIGNED SUBJECT"}
        </span>
        <div>
          {subjects.length ? (
            subjects.map((item) => (
              <button
                type="button"
                key={item.id}
                className={String(item.id) === subjectId ? "active" : ""}
                onClick={() => {
                  setSubjectId(String(item.id));
                  setTab("results");
                  void load(String(item.id));
                }}
              >
                {item.name}
                <ChevronRight size={14} />
              </button>
            ))
          ) : (
            <p>No subject assignment is available for this class yet.</p>
          )}
        </div>
      </div>
      <ClassIntelligenceOverview
        schoolId={school.id}
        classId={schoolClass.id}
        subjects={subjects}
        mode={mode}
        rosterCount={rosterStudents.length}
        onOpenSubject={(nextSubjectId) => {
          setSubjectId(nextSubjectId);
          setTab("results");
          void load(nextSubjectId);
        }}
      />
      {work && <section className="school-class-metrics"><article><span>ENROLLED STUDENTS</span><strong>{work.students.length}</strong><small>In this class</small></article><article><span>ATTENDANCE</span><strong>Open</strong><small>Use the Attendance tab</small></article><article><span>ASSIGNMENTS</span><strong>{work.assignments.length}</strong><small>Saved for this subject</small></article><article><span>ASSESSMENTS</span><strong>{work.assessments.length}</strong><small>Ready for score entry</small></article></section>}
    </section>
  );
  return (
    <section className="school-app-page school-class-workspace">
      <button type="button" className="school-app-back" onClick={onBack}>
        ← All my classes
      </button>
      <div className="school-class-heading school-workspace-heading">
        <div>
          <span>
            {mode === "class_teacher" ? "CLASS WORKSPACE" : "SUBJECT WORKSPACE"}
          </span>
          <h2>{schoolClass.name}</h2>
          <p>
            {schoolClass.academic_session} session ·{" "}
            {mode === "class_teacher"
              ? "Whole-class responsibility"
              : `${subject?.name || "Assigned subject"} responsibility`}
          </p>
        </div>
        {mode === "subject_teacher" && (
          <label>
            Subject
            <select
              value={subjectId}
              onChange={(event) => {
                setSubjectId(event.target.value);
                setWork(null);
              }}
            >
              <option value="">Choose a subject</option>
              {subjects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {mode === "subject_teacher" && (
          <button
            type="button"
            className="school-app-button primary"
            disabled={!subjectId}
            onClick={() => void load()}
          >
            Open records <ArrowRight size={15} />
          </button>
        )}
      </div>
      <nav className="school-class-tabs">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      {message && <p className="school-app-notice">{message}</p>}
      {tab === "performance" ? (
        work ? <ClassPerformancePanel work={work} /> : <section className="school-class-empty"><p>Open a subject record to view performance.</p></section>
      ) : tab === "attendance" ? (
        <AttendanceRegister schoolId={school.id} schoolClass={schoolClass} />
      ) : tab === "students" ? (
        <section className="school-class-list">
          <header>
            <span>CLASS ROSTER</span>
            <h3>{rosterStudents.length} enrolled students</h3>
            <p className="school-class-list-intro">
              {mode === "class_teacher"
                ? "Every learner in your class is visible here."
                : `Learners enrolled in ${schoolClass.name}.`}
            </p>
          </header>
          {rosterStudents.length ? (
            rosterStudents.map((student) => (
              <div key={student.id}>
                <span>
                  {student.first_name[0]}
                  {student.last_name[0]}
                </span>
                <strong>
                  {student.first_name} {student.last_name}
                </strong>
                <small>{student.student_id}</small>
              </div>
            ))
          ) : (
            <p>No active students are recorded for this class.</p>
          )}
        </section>
      ) : tab === "overview" ? (
        classOverview
      ) : !work ? (
        <section className="school-class-empty">
          <ClipboardCheck size={24} />
          <h3>Open a subject record to continue.</h3>
          <p>
            Choose the assigned subject above, then open its assessments,
            results, classwork, or AI teaching support.
          </p>
          <div className="school-class-empty-actions">
            {subjects.map((item) => (
              <button
                type="button"
                className="school-app-button quiet"
                key={item.id}
                onClick={() => {
                  setSubjectId(String(item.id));
                  setTab("results");
                  void load(String(item.id));
                }}
              >
                Open {item.name}
                <ArrowRight size={15} />
              </button>
            ))}
          </div>
        </section>
      ) : (
        <>
          {tab === "classwork" && (
            <section className="school-class-form">
              <span>CLASSWORK</span>
              <h3>Create an assignment</h3>
              <form onSubmit={(event) => void save(event, "assignment")}>
                <label>
                  Title
                  <input
                    name="title"
                    required
                    placeholder="Fractions — Exercise 4"
                  />
                </label>
                <label>
                  Instructions
                  <textarea
                    name="instructions"
                    placeholder="What should students complete?"
                  />
                </label>
                <label>
                  Due date
                  <input name="due_date" type="date" />
                </label>
                <label>
                  Maximum marks
                  <input
                    name="maximum_score"
                    type="number"
                    min="1"
                    step="0.5"
                  />
                </label>
                <button className="school-app-button primary" disabled={saving}>
                  {saving ? "Saving…" : "Save assignment draft"}
                </button>
              </form>
            </section>
          )}
          {tab === "assessments" && (
            <section className="school-class-form">
              <span>ASSESSMENTS</span>
              <h3>Create an assessment</h3>
              <form onSubmit={(event) => void save(event, "assessment")}>
                <label>
                  Title
                  <input name="title" required placeholder="Mathematics CA 1" />
                </label>
                <label>
                  Assessment type
                  <select name="assessment_type">
                    <option value="ca">Continuous assessment</option>
                    <option value="quiz">Quiz or test</option>
                    <option value="exam">Examination</option>
                  </select>
                </label>
                <label>
                  Maximum score
                  <input
                    name="maximum_score"
                    type="number"
                    min="1"
                    step="0.5"
                    required
                  />
                </label>
                <label>
                  Topics assessed <small>Separate topics with commas</small>
                  <input name="topics" placeholder="Fractions, word problems" />
                </label>
                <label>
                  Term
                  <select name="term" defaultValue="First term" required>
                    <option value="First term">First term</option>
                    <option value="Second term">Second term</option>
                    <option value="Third term">Third term</option>
                  </select>
                </label>
                <button className="school-app-button primary" disabled={saving}>
                  {saving ? "Saving…" : "Save assessment draft"}
                </button>
              </form>
            </section>
          )}
          {tab === "results" && (
            <section className="school-class-results">
              <span>RESULTS</span>
              <h3>Map questions and record evidence</h3>
              {work.assessments.length ? (
                <AssessmentBoard
                  assessments={work.assessments}
                  students={work.students}
                  role={school.role}
                  url={`/schools/teaching-work/?school_id=${school.id}&class_id=${schoolClass.id}&subject_id=${subjectId}`}
                  onSaved={() => void load()}
                />
              ) : (
                <EmptyPanel
                  icon={ClipboardCheck}
                  eyebrow="NO ASSESSMENTS"
                  title="Create an assessment before entering scores."
                  copy="The assessment needs a maximum score and topic tags before Neba can turn results into evidence."
                  action="Create assessment"
                  onAction={() => setTab("assessments")}
                />
              )}
            </section>
          )}
          {tab === "assistant" && (
            <TeachingAssistant
              schoolId={school.id}
              classId={String(schoolClass.id)}
              subjectId={subjectId}
              suggestedTopics={work.assessments
                .flatMap((assessment) =>
                  assessment.questions
                    .map((question) => question.topic)
                    .concat(
                      assessment.topics.split(",").map((topic) => topic.trim()),
                    ),
                )
                .filter(Boolean)}
            />
          )}
        </>
      )}
    </section>
  );
}

type AttendanceStatus = "present" | "late" | "absent" | "excused" | "unmarked";
type AttendanceRegisterData = {
  date: string;
  class_id: number;
  class_name: string;
  rows: Array<{
    student_id: number;
    student_public_id: string;
    student_number: string;
    name: string;
    status: AttendanceStatus;
    note: string;
  }>;
  summary: Record<AttendanceStatus, number>;
};

function localDateValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function AttendanceRegister({
  schoolId,
  schoolClass,
}: {
  schoolId: number;
  schoolClass: SchoolClass;
}) {
  const [date, setDate] = useState(localDateValue);
  const [register, setRegister] = useState<AttendanceRegisterData | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const load = async (selectedDate = date) => {
    setMessage("");
    try {
      setRegister(
        await api<AttendanceRegisterData>(
          `/schools/attendance/?school_id=${schoolId}&class_id=${schoolClass.id}&date=${selectedDate}`,
        ),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The class register could not be loaded.",
      );
    }
  };
  useEffect(() => {
    void load(date);
  }, [date, schoolClass.id]);
  const setStatus = (studentId: number, status: AttendanceStatus) =>
    setRegister((current) =>
      current
        ? {
            ...current,
            rows: current.rows.map((row) =>
              row.student_id === studentId ? { ...row, status } : row,
            ),
          }
        : current,
    );
  const markAllPresent = () =>
    setRegister((current) =>
      current
        ? {
            ...current,
            rows: current.rows.map((row) => ({ ...row, status: "present" })),
          }
        : current,
    );
  const save = async () => {
    if (!register || register.rows.some((row) => row.status === "unmarked")) {
      setMessage("Mark every student before saving the register.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const result = await api<{ saved: number }>(
        `/schools/attendance/?school_id=${schoolId}`,
        {
          method: "POST",
          body: JSON.stringify({
            class_id: schoolClass.id,
            date,
            rows: register.rows.map(({ student_id, status, note }) => ({
              student_id,
              status,
              note,
            })),
          }),
        },
      );
      setMessage(
        `${result.saved} attendance records saved for ${schoolClass.name}.`,
      );
      await load(date);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Attendance could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="school-attendance-register">
      <header>
        <div>
          <span>DAILY REGISTER</span>
          <h3>Mark attendance for {schoolClass.name}</h3>
          <p>
            Choose a date, mark every learner, then save the register. Late
            counts as attended; excused days are excluded from attendance-rate
            calculations.
          </p>
        </div>
        <CalendarCheck2 size={24} />
      </header>
      <div className="school-attendance-controls">
        <label>
          Date
          <input
            type="date"
            max={localDateValue()}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="school-app-button quiet"
          onClick={markAllPresent}
          disabled={!register?.rows.length}
        >
          Mark all present
        </button>
        <button
          type="button"
          className="school-app-button primary"
          onClick={() => void save()}
          disabled={saving || !register?.rows.length}
        >
          {saving ? "Saving…" : "Save attendance"}
        </button>
      </div>
      {message && (
        <p className="school-app-notice" role="status">
          {message}
        </p>
      )}
      {!register ? (
        <div className="school-class-empty">
          <p>Loading the class register…</p>
        </div>
      ) : register.rows.length ? (
        <div className="school-attendance-table">
          <div className="school-attendance-head">
            <span>STUDENT</span>
            <span>STATUS</span>
            <span>NOTE</span>
          </div>
          {register.rows.map((row) => (
            <div className="school-attendance-row" key={row.student_id}>
              <div>
                <strong>{row.name}</strong>
                <small>{row.student_number}</small>
              </div>
              <select
                aria-label={`Attendance status for ${row.name}`}
                value={row.status}
                onChange={(event) =>
                  setStatus(
                    row.student_id,
                    event.target.value as AttendanceStatus,
                  )
                }
              >
                <option value="unmarked">Choose status</option>
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="absent">Absent</option>
                <option value="excused">Excused</option>
              </select>
              <input
                aria-label={`Attendance note for ${row.name}`}
                value={row.note}
                maxLength={240}
                placeholder="Optional note"
                onChange={(event) =>
                  setRegister({
                    ...register,
                    rows: register.rows.map((item) =>
                      item.student_id === row.student_id
                        ? { ...item, note: event.target.value }
                        : item,
                    ),
                  })
                }
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="school-class-empty">
          <p>No active students are enrolled in this class.</p>
        </div>
      )}
    </section>
  );
}

function LegacyTeacherClasses({
  school,
  classes,
  subjects,
}: {
  school: SchoolWorkspace;
  classes: SchoolClass[];
  subjects: Subject[];
}) {
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [work, setWork] = useState<TeachingWork | null>(null);
  const [mode, setMode] = useState<"assignment" | "assessment" | "scores">(
    "assignment",
  );
  const [message, setMessage] = useState("");
  const load = async (selectedClass = classId, selectedSubject = subjectId) => {
    if (!selectedClass || !selectedSubject) return;
    try {
      setWork(
        await api<TeachingWork>(
          `/schools/teaching-work/?school_id=${school.id}&class_id=${selectedClass}&subject_id=${selectedSubject}`,
        ),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "This class workspace could not be loaded.",
      );
    }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!classId || !subjectId) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const body =
      mode === "assignment"
        ? {
            action: "assignment",
            title: String(form.get("title") || ""),
            instructions: String(form.get("instructions") || ""),
            due_date: String(form.get("due_date") || ""),
            maximum_score: String(form.get("maximum_score") || "") || null,
            counts_toward_ca: form.get("counts_toward_ca") === "on",
          }
        : {
            action: "assessment",
            title: String(form.get("title") || ""),
            assessment_type: String(form.get("assessment_type") || "ca"),
            maximum_score: String(form.get("maximum_score") || ""),
            term: String(form.get("term") || "First term"),
            academic_session: String(form.get("academic_session") || ""),
            topics: String(form.get("topics") || ""),
          };
    try {
      await api(
        `/schools/teaching-work/?school_id=${school.id}&class_id=${classId}&subject_id=${subjectId}`,
        { method: "POST", body: JSON.stringify(body) },
      );
      formElement.reset();
      setMessage(
        mode === "assignment"
          ? "Assignment saved as a draft."
          : "Assessment created as a draft.",
      );
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save this teaching record.",
      );
    }
  };
  return (
    <section className="school-app-page">
      <div className="school-app-page-heading">
        <div>
          <span>MY CLASSES</span>
          <h2>Teach, assess, and follow up from one place.</h2>
          <p>
            Choose a class and subject to create homework, enter draft scores,
            and keep the academic record connected.
          </p>
        </div>
      </div>
      <div className="school-app-teaching-picker">
        <label>
          Class
          <select
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setWork(null);
            }}
          >
            <option value="">Choose a class</option>
            {classes.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name} · {item.academic_session}
              </option>
            ))}
          </select>
        </label>
        <label>
          Subject
          <select
            value={subjectId}
            onChange={(e) => {
              setSubjectId(e.target.value);
              setWork(null);
            }}
          >
            <option value="">Choose a subject</option>
            {subjects.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="school-app-button primary"
          type="button"
          onClick={() => void load()}
        >
          Open class
        </button>
      </div>
      {message && <p className="school-app-notice">{message}</p>}
      {work && (
        <>
          <nav className="school-app-record-tabs">
            <button
              className={mode === "assignment" ? "active" : ""}
              onClick={() => setMode("assignment")}
            >
              Assignments
            </button>
            <button
              className={mode === "assessment" ? "active" : ""}
              onClick={() => setMode("assessment")}
            >
              Assessments
            </button>
            <button
              className={mode === "scores" ? "active" : ""}
              onClick={() => setMode("scores")}
            >
              Score entry
            </button>
          </nav>
          {mode !== "scores" ? (
            <article className="school-app-panel school-app-teaching-form">
              <h3>
                {mode === "assignment"
                  ? "New take-home assignment"
                  : "New assessment"}
              </h3>
              <form onSubmit={(e) => void submit(e)}>
                <label>
                  Title
                  <input
                    name="title"
                    required
                    placeholder={
                      mode === "assignment"
                        ? "Fractions — Exercise 4"
                        : "Mathematics CA 1"
                    }
                  />
                </label>
                {mode === "assignment" ? (
                  <>
                    <label>
                      Instructions
                      <textarea
                        name="instructions"
                        placeholder="What should students complete?"
                      />
                    </label>
                    <label>
                      Due date
                      <input name="due_date" type="date" />
                    </label>
                    <label>
                      Maximum marks{" "}
                      <input
                        name="maximum_score"
                        type="number"
                        min="1"
                        step="0.5"
                      />
                    </label>
                    <label className="school-app-check">
                      <input name="counts_toward_ca" type="checkbox" /> Include
                      marks in continuous assessment
                    </label>
                  </>
                ) : (
                  <>
                    <label>
                      Assessment type
                      <select name="assessment_type">
                        <option value="ca">Continuous assessment</option>
                        <option value="quiz">Quiz or test</option>
                        <option value="exam">Examination</option>
                      </select>
                    </label>
                    <label>
                      Maximum score
                      <input
                        name="maximum_score"
                        type="number"
                        min="1"
                        step="0.5"
                        required
                      />
                    </label>
                    <label>
                      Topics assessed <small>Separate topics with commas</small>
                      <input
                        name="topics"
                        placeholder="Fractions, word problems"
                      />
                    </label>
                    <label>
                      Term
                      <input name="term" defaultValue="First term" required />
                    </label>
                    <input
                      type="hidden"
                      name="academic_session"
                      value={
                        classes.find((item) => String(item.id) === classId)
                          ?.academic_session || ""
                      }
                    />
                  </>
                )}
                <button className="school-app-button primary">
                  Save draft
                </button>
              </form>
            </article>
          ) : (
            <article className="school-app-panel school-app-score-grid">
              <h3>Draft score entry</h3>
              <p>
                Scores remain drafts until an authorized review and publication
                workflow is added.
              </p>
              {work.assessments.length ? (
                work.assessments.map((assessment) => (
                  <ScoreEntry
                    key={assessment.id}
                    assessment={assessment}
                    students={work.students}
                    role={school.role}
                    url={`/schools/teaching-work/?school_id=${school.id}&class_id=${classId}&subject_id=${subjectId}`}
                    onSaved={() => void load()}
                  />
                ))
              ) : (
                <p>No draft assessments yet.</p>
              )}
            </article>
          )}
          <section className="school-app-detail-grid">
            <article className="school-app-panel">
              <span className="school-app-detail-label">ASSIGNMENTS</span>
              <p>
                {work.assignments.length
                  ? `${work.assignments.length} assignment record${work.assignments.length === 1 ? "" : "s"} in this class.`
                  : "No assignments yet."}
              </p>
            </article>
            <article className="school-app-panel">
              <span className="school-app-detail-label">ASSESSMENTS</span>
              <p>
                {work.assessments.length
                  ? `${work.assessments.length} assessment record${work.assessments.length === 1 ? "" : "s"} ready for score entry.`
                  : "No assessments yet."}
              </p>
            </article>
          </section>
          <TeachingAssistant
            schoolId={school.id}
            classId={classId}
            subjectId={subjectId}
            suggestedTopics={work.assessments
              .flatMap((assessment) =>
                assessment.questions
                  .map((question) => question.topic)
                  .concat(
                    assessment.topics.split(",").map((topic) => topic.trim()),
                  ),
              )
              .filter(Boolean)}
          />
        </>
      )}
    </section>
  );
}

function TeachingAssistant({
  schoolId,
  classId,
  subjectId,
  suggestedTopics,
}: {
  schoolId: number;
  classId: string;
  subjectId: string;
  suggestedTopics: string[];
}) {
  const [topic, setTopic] = useState("");
  const [kind, setKind] = useState<
    "revision" | "lesson" | "practice" | "summary" | "explain"
  >("revision");
  const [draft, setDraft] = useState<TeachingAssistantDraft | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const topics = Array.from(new Set(suggestedTopics));
  const generate = async () => {
    if (!topic.trim()) {
      setMessage("Choose or enter a topic before creating a draft.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      setDraft(
        await api<TeachingAssistantDraft>(
          `/schools/teaching-assistant/?school_id=${schoolId}`,
          {
            method: "POST",
            body: JSON.stringify({
              class_id: Number(classId),
              subject_id: Number(subjectId),
              topic: topic.trim(),
              kind,
            }),
          },
        ),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The teaching draft could not be created.",
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <section className="school-assistant">
      <header>
        <div>
          <span>NEBA TEACHING ASSISTANT</span>
          <h3>Turn a topic signal into the next lesson.</h3>
          <p>
            Every draft starts from recorded school evidence and stays
            teacher-reviewable.
          </p>
        </div>
        <Bot size={23} />
      </header>
      <div className="school-assistant-controls">
        <label>
          Topic
          <input
            list="school-assistant-topics"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="e.g. Fractions"
          />
          <datalist id="school-assistant-topics">
            {topics.map((item) => (
              <option value={item} key={item} />
            ))}
          </datalist>
        </label>
        <label>
          Draft type
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as typeof kind)}
          >
            <option value="revision">Revision activity</option>
            <option value="lesson">Reteaching lesson</option>
            <option value="practice">Differentiated practice</option>
            <option value="summary">Progress summary</option>
            <option value="explain">Explain the evidence</option>
          </select>
        </label>
        <button
          type="button"
          className="school-app-button primary"
          disabled={loading}
          onClick={() => void generate()}
        >
          {loading ? "Preparing draft…" : "Create teacher draft"}
          <Sparkles size={15} />
        </button>
      </div>
      {message && <p className="school-app-notice">{message}</p>}
      {draft && (
        <article className="school-assistant-draft">
          <div className="school-assistant-evidence">
            <span>RECORDED EVIDENCE</span>
            <strong>
              {draft.evidence.average ?? "—"}
              {draft.evidence.average !== null ? "%" : ""}
            </strong>
            <small>
              {draft.evidence.topic} · {draft.evidence.coverage} scores ·{" "}
              {draft.evidence.confidence === "sufficient"
                ? "evidence ready"
                : "early signal"}
            </small>
          </div>
          <div className="school-assistant-output">
            <span>
              {draft.source === "ai_draft"
                ? "AI DRAFT · TEACHER REVIEW REQUIRED"
                : "TEACHER-REVIEW STARTER DRAFT"}
            </span>
            <h4>{draft.title}</h4>
            <p>{draft.teacher_note}</p>
            {draft.sections.map((section) => (
              <div className="school-assistant-section" key={section.heading}>
                <strong>{section.heading}</strong>
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="school-assistant-checks">
              <strong>Before using this</strong>
              {draft.review_checks.map((item) => (
                <span key={item}>
                  <Check size={14} />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </article>
      )}
    </section>
  );
}

function assessmentProgress(assessment: TeachingAssessment, studentCount: number) {
  const expected = assessment.questions.length
    ? assessment.questions.length * studentCount
    : studentCount;
  const entered = assessment.questions.length
    ? assessment.questions.reduce(
        (total, question) =>
          total +
          question.scores.filter(
            (score) => score.status === "entered" && score.score !== null,
          ).length,
        0,
      )
    : assessment.entered_scores;
  return {
    expected,
    entered,
    remaining: Math.max(expected - entered, 0),
    percent: expected ? Math.min(Math.round((entered / expected) * 100), 100) : 0,
  };
}

function assessmentTypeLabel(type: string) {
  return type === "exam"
    ? "Examination"
    : type === "quiz"
      ? "Quiz or test"
      : "Continuous assessment";
}

function AssessmentBoard({
  assessments,
  students,
  role,
  url,
  onSaved,
}: {
  assessments: TeachingAssessment[];
  students: TeachingWork["students"];
  role: string;
  url: string;
  onSaved: () => void;
}) {
  const [termFilter, setTermFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [collapsedTerms, setCollapsedTerms] = useState<Set<string>>(new Set());
  const terms = Array.from(
    new Set(assessments.map((assessment) => assessment.term || "Unassigned term")),
  );
  const filtered = assessments.filter(
    (assessment) =>
      (termFilter === "all" || (assessment.term || "Unassigned term") === termFilter) &&
      (typeFilter === "all" || assessment.type === typeFilter),
  );
  const groups = filtered.reduce<Record<string, TeachingAssessment[]>>(
    (result, assessment) => {
      const key = assessment.term || "Unassigned term";
      (result[key] ||= []).push(assessment);
      return result;
    },
    {},
  );
  useEffect(() => {
    // Keep term groups open when a results view or filter is first loaded.
    setCollapsedTerms(new Set());
  }, [assessments, termFilter, typeFilter]);
  const toggle = (id: number, isExpanded: boolean) => {
    if (isExpanded) {
      setExpanded((current) => { const next = new Set(current); next.delete(id); return next; });
      setCollapsed((current) => new Set(current).add(id));
    } else {
      setExpanded((current) => new Set(current).add(id));
      setCollapsed((current) => { const next = new Set(current); next.delete(id); return next; });
    }
  };
  const toggleTerm = (term: string) => setCollapsedTerms((current) => {
    const next = new Set(current);
    if (next.has(term)) next.delete(term);
    else next.add(term);
    return next;
  });
  const allProgress = filtered.reduce(
    (total, assessment) => {
      const progress = assessmentProgress(assessment, students.length);
      return { entered: total.entered + progress.entered, expected: total.expected + progress.expected };
    },
    { entered: 0, expected: 0 },
  );
  const overallPercent = allProgress.expected
    ? Math.min(Math.round((allProgress.entered / allProgress.expected) * 100), 100)
    : 0;

  return (
    <div className="school-assessment-board">
      <div className="school-assessment-toolbar">
        <div>
          <strong>{filtered.length} assessment{filtered.length === 1 ? "" : "s"}</strong>
          <small>{overallPercent}% of score entries recorded in this view</small>
        </div>
        <div className="school-assessment-filters">
          <label>
            Term
            <select value={termFilter} onChange={(event) => setTermFilter(event.target.value)}>
              <option value="all">All terms</option>
              {terms.map((term) => <option value={term} key={term}>{term}</option>)}
            </select>
          </label>
          <label>
            Type
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="all">All types</option>
              <option value="ca">Continuous assessment</option>
              <option value="quiz">Quiz or test</option>
              <option value="exam">Examination</option>
            </select>
          </label>
        </div>
      </div>
      {Object.entries(groups).map(([term, group]) => {
        const progress = group.reduce(
          (total, assessment) => {
            const item = assessmentProgress(assessment, students.length);
            return { entered: total.entered + item.entered, expected: total.expected + item.expected };
          },
          { entered: 0, expected: 0 },
        );
        const percent = progress.expected ? Math.min(Math.round((progress.entered / progress.expected) * 100), 100) : 0;
        return (
          <section className="school-assessment-group" key={term}>
            <header>
              <button type="button" className="school-assessment-group-toggle" onClick={() => toggleTerm(term)} aria-expanded={!collapsedTerms.has(term)}><ChevronDown size={16} /><div><span>{term}</span><strong>{group.length} assessment{group.length === 1 ? "" : "s"}</strong></div></button>
              <div className="school-assessment-group-progress"><strong>{percent}%</strong><small>{progress.entered}/{progress.expected || 0} entries</small><i><b style={{ width: `${percent}%` }} /></i></div>
            </header>
            {!collapsedTerms.has(term) && <div className="school-assessment-cards">
              {group.map((assessment) => {
                const item = assessmentProgress(assessment, students.length);
                const isExpanded = expanded.has(assessment.id) || (item.percent < 100 && !collapsed.has(assessment.id));
                const isCollapsed = !isExpanded;
                return (
                  <article className={`school-assessment-card ${isCollapsed ? "collapsed" : ""}`} key={assessment.id}>
                    <button type="button" className="school-assessment-card-head" onClick={() => toggle(assessment.id, isExpanded)} aria-expanded={isExpanded}>
                      <span className="school-assessment-status-dot" data-status={item.percent === 100 ? "complete" : assessment.status} />
                      <div><strong>{assessment.title}</strong><small>{assessmentTypeLabel(assessment.type)} · {assessment.academic_session}</small></div>
                      <div className="school-assessment-card-progress"><strong>{item.percent}%</strong><small>{item.remaining ? `${item.remaining} entries left` : "Complete"}</small></div>
                      <ChevronDown size={16} />
                    </button>
                    {isExpanded && <div className="school-assessment-card-body"><div className="school-assessment-progress-line"><span><b style={{ width: `${item.percent}%` }} /></span><small>{item.entered} of {item.expected || 0} score entries recorded</small></div><ScoreEntry assessment={assessment} students={students} role={role} url={url} onSaved={onSaved} /></div>}
                  </article>
                );
              })}
            </div>}
          </section>
        );
      })}
      {!filtered.length && <div className="school-class-empty"><ClipboardCheck size={24} /><p>No assessments match these filters.</p></div>}
    </div>
  );
}

function ScoreEntry({
  assessment,
  students,
  role,
  url,
  onSaved,
}: {
  assessment: TeachingWork["assessments"][number];
  students: TeachingWork["students"];
  role: string;
  url: string;
  onSaved: () => void;
}) {
  const [notice, setNotice] = useState("");
  const [questions, setQuestions] = useState<
    Array<{
      number: number;
      topic: string;
      learning_objective: string;
      maximum_score?: string;
    }>
  >(
    assessment.questions.length
      ? assessment.questions.map((question) => ({
          number: question.number,
          topic: question.topic,
          learning_objective: question.learning_objective,
          maximum_score: question.maximum_score?.toString() || "",
        }))
      : [{ number: 1, topic: "", learning_objective: "", maximum_score: "" }],
  );
  const [csvRows, setCsvRows] = useState<
    Array<{ student_id: string; score: string }>
  >([]);
  const [csvSourceName, setCsvSourceName] = useState("scores.csv");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [studentColumn, setStudentColumn] = useState("");
  const [scoreColumn, setScoreColumn] = useState("");
  const [csvPreview, setCsvPreview] = useState<{
    valid: boolean;
    needs_mapping?: boolean;
    row_count: number;
    valid_count: number;
    errors: string[];
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const updateStatus = async (
    status: "submitted" | "reviewed" | "published",
  ) => {
    try {
      await api(url, {
        method: "POST",
        body: JSON.stringify({
          action: "assessment_status",
          assessment_id: assessment.id,
          status,
        }),
      });
      setNotice(
        status === "submitted"
          ? "Assessment submitted for review."
          : status === "reviewed"
            ? "Assessment approved for publication."
            : "Assessment published and now available to academic intelligence.",
      );
      onSaved();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Assessment status could not be updated.",
      );
    }
  };
  const saveQuestions = async () => {
    try {
      const result = await api<{ saved: number }>(url, {
        method: "POST",
        body: JSON.stringify({
          action: "questions",
          assessment_id: assessment.id,
          questions: questions.map((question) => ({
            ...question,
            maximum_score: question.maximum_score || assessment.maximum_score,
          })),
        }),
      });
      setNotice(`${result.saved} question topic maps saved.`);
      onSaved();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Question mapping could not be saved.",
      );
    }
  };
  const previewFile = async (
    file: File,
    mapping?: { student: string; score: string },
  ) => {
    const form = new FormData();
    form.append("action", "score_import_file_preview");
    form.append("assessment_id", String(assessment.id));
    form.append("file", file);
    if (mapping?.student) form.append("student_column", mapping.student);
    if (mapping?.score) form.append("score_column", mapping.score);
    try {
      const result = await api<{
        valid: boolean;
        needs_mapping?: boolean;
        columns: string[];
        suggested_mapping: { student_column: string; score_column: string };
        row_count: number;
        valid_count: number;
        errors: string[];
        rows: Array<{ student_id: string; score: string }>;
      }>(url, { method: "POST", body: form });
      setCsvColumns(result.columns);
      setStudentColumn(result.suggested_mapping.student_column);
      setScoreColumn(result.suggested_mapping.score_column);
      setCsvRows(result.rows);
      setCsvPreview(result);
      setNotice(
        result.valid
          ? `${result.valid_count} rows are ready to import.`
          : result.needs_mapping
            ? "Choose the student ID and score columns, then validate again."
            : `${result.errors.length} issue${result.errors.length === 1 ? "" : "s"} must be corrected before import.`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "The spreadsheet could not be read.",
      );
    }
  };
  const readImportFile = async (file: File) => {
    setCsvFile(file);
    setCsvSourceName(file.name);
    setCsvPreview(null);
    await previewFile(file);
  };
  const previewCsv = async () => {
    if (csvFile)
      await previewFile(csvFile, {
        student: studentColumn,
        score: scoreColumn,
      });
  };
  const importCsv = async () => {
    if (!csvPreview?.valid) return;
    try {
      const result = await api<{ saved: number; import_id: number }>(url, {
        method: "POST",
        body: JSON.stringify({
          action: "score_import",
          assessment_id: assessment.id,
          rows: csvRows,
          source_name: csvSourceName,
        }),
      });
      setNotice(
        `${result.saved} scores imported from ${csvSourceName}. Import ${result.import_id} was recorded.`,
      );
      setCsvRows([]);
      setCsvPreview(null);
      if (inputRef.current) inputRef.current.value = "";
      onSaved();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "CSV scores could not be imported.",
      );
    }
  };
  const saveQuestionScores = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const scores = assessment.questions.flatMap((question) =>
      students.map((student) => {
        const value = form.get(`question-${question.id}-${student.id}`);
        return {
          question_id: question.id,
          student_id: student.id,
          score: value,
          status: value === "" ? "missing" : "entered",
        };
      }),
    );
    try {
      const result = await api<{ saved: number }>(url, {
        method: "POST",
        body: JSON.stringify({
          action: "question_scores",
          assessment_id: assessment.id,
          scores,
        }),
      });
      setNotice(`${result.saved} question-level scores saved.`);
      onSaved();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Question-level scores could not be saved.",
      );
    }
  };
  if (!assessment.questions.length && assessment.status === "draft")
    return (
      <section className="school-app-score-entry">
        <div>
          <strong>{assessment.title}</strong>
          <span>
            Map each question before recording question-level evidence.
          </span>
        </div>
        <article className="school-app-evidence-work">
          <header>
            <span>QUESTION-TO-TOPIC MAP</span>
            <small>Teacher-reviewed evidence</small>
          </header>
          <p>
            Assign each question to the learning topic it tests and record its
            maximum score. This makes Neba&apos;s later topic signals
            explainable.
          </p>
          {questions.map((question, index) => (
            <div
              className="school-app-question-map"
              key={`${question.number}-${index}`}
            >
              <label>
                Question
                <input
                  type="number"
                  min="1"
                  value={question.number}
                  onChange={(event) =>
                    setQuestions(
                      questions.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, number: Number(event.target.value) }
                          : item,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Topic
                <input
                  value={question.topic}
                  placeholder="e.g. Fractions"
                  onChange={(event) =>
                    setQuestions(
                      questions.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, topic: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Maximum score
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={question.maximum_score || ""}
                  placeholder="e.g. 5"
                  onChange={(event) =>
                    setQuestions(
                      questions.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, maximum_score: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Learning objective <small>Optional</small>
                <input
                  value={question.learning_objective}
                  placeholder="Add and simplify fractions"
                  onChange={(event) =>
                    setQuestions(
                      questions.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, learning_objective: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
              </label>
            </div>
          ))}
          <div className="school-app-evidence-actions">
            <button
              type="button"
              className="school-app-button quiet"
              onClick={() =>
                setQuestions([
                  ...questions,
                  {
                    number: questions.length + 1,
                    topic: "",
                    learning_objective: "",
                    maximum_score: "",
                  },
                ])
              }
            >
              Add question
            </button>
            <button
              type="button"
              className="school-app-button primary"
              onClick={() => void saveQuestions()}
            >
              Save question map
            </button>
          </div>
        </article>
        {notice && <p className="school-app-notice">{notice}</p>}
      </section>
    );
  if (assessment.questions.length && assessment.status === "draft")
    return (
      <section className="school-app-score-entry">
        <div>
          <strong>{assessment.title}</strong>
          <span>
            Question-level evidence · {assessment.questions.length} mapped
            questions
          </span>
          <button
            type="button"
            className={`school-app-button ${role === "admin" || role === "academic_head" ? "primary" : "quiet"}`}
            onClick={() => void updateStatus(role === "admin" || role === "academic_head" ? "published" : "submitted")}
          >
            {role === "admin" || role === "academic_head" ? "Publish results" : "Submit for review"}
          </button>
        </div>
        <form
          className="school-app-question-score-form"
          onSubmit={(event) => void saveQuestionScores(event)}
        >
          <span>RECORD QUESTION-LEVEL SCORES</span>
          <p>
            These scores power topic-level signals. Blank fields remain marked
            as missing rather than treated as zero.
          </p>
          {assessment.questions.map((question) => (
            <fieldset key={question.id}>
              <legend>
                Question {question.number} · {question.topic}{" "}
                {question.maximum_score
                  ? `(${question.maximum_score} marks)`
                  : ""}
              </legend>
              {question.learning_objective && (
                <small>{question.learning_objective}</small>
              )}
              {students.map((student) => {
                const existing = question.scores.find(
                  (score) => score.student_id === student.id,
                );
                return (
                  <label key={student.id}>
                    {student.first_name} {student.last_name}
                    <small>{student.student_id}</small>
                    <input
                      name={`question-${question.id}-${student.id}`}
                      defaultValue={existing?.score ?? ""}
                      type="number"
                      min="0"
                      max={question.maximum_score ?? undefined}
                      step="0.5"
                    />
                  </label>
                );
              })}
            </fieldset>
          ))}
          <button className="school-app-button primary">
            Save question evidence
          </button>
        </form>
        {notice && <p className="school-app-notice">{notice}</p>}
      </section>
    );
  const progress = assessmentProgress(assessment, students.length);
  return (
    <section className="school-app-score-entry">
      <div>
        <strong>{assessment.title}</strong>
        <span>
          {progress.entered} score entries recorded · {progress.percent}%
          complete · {assessment.status}
        </span>
        {assessment.status === "draft" && (
          <button
            type="button"
            className={`school-app-button ${role === "admin" || role === "academic_head" ? "primary" : "quiet"}`}
            onClick={() => void updateStatus(role === "admin" || role === "academic_head" ? "published" : "submitted")}
          >
            {role === "admin" || role === "academic_head" ? "Publish results" : "Submit for review"}
          </button>
        )}
        {assessment.status === "submitted" &&
          (role === "admin" || role === "academic_head") && (
            <button
              type="button"
              className="school-app-button quiet"
              onClick={() => void updateStatus("reviewed")}
            >
              Approve results
            </button>
          )}
        {assessment.status === "reviewed" &&
          (role === "admin" || role === "academic_head") && (
            <button
              type="button"
              className="school-app-button primary"
              onClick={() => void updateStatus("published")}
            >
              Publish results
            </button>
          )}
        {assessment.status === "published" && (
          <small>
            Published results are read-only and power academic intelligence.
          </small>
        )}
      </div>
      {assessment.status === "draft" && (
        <>
          <article className="school-app-evidence-work">
            <header>
              <span>QUESTION-TO-TOPIC MAP</span>
              <small>Teacher-reviewed evidence</small>
            </header>
            <p>
              Map the questions this assessment covered before using its result
              to interpret a learning gap.
            </p>
            {questions.map((question, index) => (
              <div
                className="school-app-question-map"
                key={`${question.number}-${index}`}
              >
                <label>
                  Question
                  <input
                    type="number"
                    min="1"
                    value={question.number}
                    onChange={(event) =>
                      setQuestions(
                        questions.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, number: Number(event.target.value) }
                            : item,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Topic
                  <input
                    value={question.topic}
                    placeholder="e.g. Fractions"
                    onChange={(event) =>
                      setQuestions(
                        questions.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, topic: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Learning objective <small>Optional</small>
                  <input
                    value={question.learning_objective}
                    placeholder="Add and simplify fractions"
                    onChange={(event) =>
                      setQuestions(
                        questions.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                learning_objective: event.target.value,
                              }
                            : item,
                        ),
                      )
                    }
                  />
                </label>
              </div>
            ))}
            <div className="school-app-evidence-actions">
              <button
                type="button"
                className="school-app-button quiet"
                onClick={() =>
                  setQuestions([
                    ...questions,
                    {
                      number: questions.length + 1,
                      topic: "",
                      learning_objective: "",
                    },
                  ])
                }
              >
                Add question
              </button>
              <button
                type="button"
                className="school-app-button primary"
                onClick={() => void saveQuestions()}
              >
                Save mapping
              </button>
            </div>
          </article>
          <article className="school-app-evidence-work">
            <header>
              <span>RESULT FILE IMPORT</span>
              <small>CSV or XLSX</small>
            </header>
            <p>
              Choose a result file, map its columns, validate every row, then
              import it as one recorded batch. No partial import occurs when any
              row is invalid.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void readImportFile(file);
              }}
            />
            {csvFile && (
              <>
                <small>
                  {csvSourceName} · {csvPreview?.row_count || 0} rows read.
                </small>
                {csvColumns.length > 0 && (
                  <div className="school-app-question-map">
                    <label>
                      Student ID column
                      <select
                        value={studentColumn}
                        onChange={(event) =>
                          setStudentColumn(event.target.value)
                        }
                      >
                        <option value="">Choose column</option>
                        {csvColumns.map((column) => (
                          <option value={column} key={`student-${column}`}>
                            {column}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Score column
                      <select
                        value={scoreColumn}
                        onChange={(event) => setScoreColumn(event.target.value)}
                      >
                        <option value="">Choose column</option>
                        {csvColumns.map((column) => (
                          <option value={column} key={`score-${column}`}>
                            {column}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
                <button
                  type="button"
                  className="school-app-button quiet"
                  onClick={() => void previewCsv()}
                  disabled={!studentColumn || !scoreColumn}
                >
                  Validate import
                </button>
                {csvPreview && !csvPreview.valid && (
                  <div className="school-app-notice">
                    {csvPreview.errors.map((error) => (
                      <span key={error}>{error}</span>
                    ))}
                  </div>
                )}
                {csvPreview?.valid && (
                  <button
                    type="button"
                    className="school-app-button primary"
                    onClick={() => void importCsv()}
                  >
                    Import validated scores
                  </button>
                )}
              </>
            )}
          </article>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              const scores = students.map((student) => ({
                student_id: student.id,
                score: data.get(`score-${student.id}`),
                status:
                  data.get(`score-${student.id}`) === ""
                    ? "missing"
                    : "entered",
              }));
              try {
                const result = await api<{ saved: number }>(url, {
                  method: "POST",
                  body: JSON.stringify({
                    action: "scores",
                    assessment_id: assessment.id,
                    scores,
                  }),
                });
                setNotice(`${result.saved} scores saved.`);
                onSaved();
              } catch (error) {
                setNotice(
                  error instanceof Error
                    ? error.message
                    : "Scores could not be saved.",
                );
              }
            }}
          >
            <span>OR ENTER SCORES MANUALLY</span>
            {students.map((student) => (
              <label key={student.id}>
                {student.first_name} {student.last_name}{" "}
                <small>{student.student_id}</small>
                <input
                  name={`score-${student.id}`}
                  type="number"
                  min="0"
                  max={assessment.maximum_score}
                  step="0.5"
                />
              </label>
            ))}
            <button className="school-app-button primary">Save scores</button>
          </form>
        </>
      )}
      {notice && <p className="school-app-notice">{notice}</p>}
    </section>
  );
}

function StaffRecord({
  member,
  schoolId,
  classes,
  subjects,
  canManage,
  onBack,
  onChanged,
}: {
  member: Member;
  schoolId: number;
  classes: SchoolClass[];
  subjects: Subject[];
  canManage: boolean;
  onBack: () => void;
  onChanged: (member: Member) => void;
}) {
  const [assignmentType, setAssignmentType] =
    useState<StaffAssignment["type"]>("class_teacher");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const endpoint = `/schools/members/${member.public_id}/?school_id=${schoolId}`;
  const update = async (payload: Record<string, string | number>) => {
    setSaving(true);
    setMessage("");
    try {
      const updated = await api<Member>(endpoint, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      onChanged(updated);
      setMessage(
        payload.action === "remove_assignment"
          ? "Assignment removed."
          : payload.action === "update_role"
            ? "School role updated."
            : "Assignment saved.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Staff access could not be updated.",
      );
    } finally {
      setSaving(false);
    }
  };
  const assignments = member.assignments || [];
  return (
    <section className="school-app-page school-app-detail-view">
      <button type="button" className="school-app-back" onClick={onBack}>
        ← Back to staff
      </button>
      <div className="school-app-page-heading">
        <div>
          <span>STAFF ACCESS</span>
          <h2>{member.name}</h2>
          <p>
            {member.email || "No email on record"} · Assign responsibilities
            here without creating another staff account.
          </p>
        </div>
      </div>
      {message && (
        <div className="school-app-notice" role="status">
          {message}
          <button
            type="button"
            onClick={() => setMessage("")}
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      )}
      <section className="school-app-staff-layout">
        <article className="school-app-panel school-app-staff-identity">
          <span className="school-app-detail-label">SCHOOL ACCESS</span>
          <dl>
            <div>
              <dt>School role</dt>
              <dd>{member.role.replace("_", " ")}</dd>
            </div>
            <div>
              <dt>Member ID</dt>
              <dd>{member.public_id || "Preparing access…"}</dd>
            </div>
          </dl>
          {canManage && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void update({
                  action: "update_role",
                  role: String(data.get("role") || member.role),
                });
              }}
            >
              <label>
                Change school role
                <select name="role" defaultValue={member.role}>
                  <option value="teacher">Teacher</option>
                  <option value="academic_head">Academic head</option>
                  <option value="admin">School admin</option>
                </select>
              </label>
              <button className="school-app-button quiet" disabled={saving}>
                Update role
              </button>
            </form>
          )}
        </article>
        <article className="school-app-panel school-app-staff-assignments">
          <header>
            <div>
              <span>TEACHING RESPONSIBILITIES</span>
              <h3>
                {assignments.length
                  ? `${assignments.length} active assignment${assignments.length === 1 ? "" : "s"}`
                  : "No assignments yet"}
              </h3>
            </div>
            <BookOpen size={20} />
          </header>
          <div className="school-app-assignment-list">
            {assignments.map((assignment) => (
              <div key={`${assignment.type}-${assignment.id}`}>
                <span
                  className={`school-app-assignment-kind ${assignment.type}`}
                >
                  {assignment.type === "class_teacher"
                    ? "CLASS TEACHER"
                    : "SUBJECT TEACHER"}
                </span>
                <div>
                  <strong>{assignment.class_name}</strong>
                  <small>
                    {assignment.subject_name
                      ? `${assignment.subject_name} · `
                      : ""}
                    {assignment.academic_session}
                  </small>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() =>
                      void update({
                        action: "remove_assignment",
                        type: assignment.type,
                        assignment_id: assignment.id,
                      })
                    }
                    disabled={saving}
                    aria-label={`Remove ${assignment.type.replace("_", " ")} assignment for ${assignment.class_name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {!assignments.length && (
            <p className="school-app-assignment-empty">
              Choose a responsibility below to connect this teacher to their
              work.
            </p>
          )}
        </article>
      </section>
      {canManage && member.role === "teacher" && (
        <article className="school-app-panel school-app-assignment-composer">
          <span className="school-app-detail-label">
            ASSIGN CLASS OR SUBJECT
          </span>
          <p className="school-app-assignment-help">
            Class teachers can see and manage the whole class. Subject teachers
            can see only the selected subject in the selected class.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void update({
                action: "add_assignment",
                type: assignmentType,
                class_id: Number(data.get("class_id")),
                ...(assignmentType === "subject_teacher"
                  ? { subject_id: Number(data.get("subject_id")) }
                  : {}),
              });
            }}
          >
            <label>
              Assignment type
              <select
                value={assignmentType}
                onChange={(event) =>
                  setAssignmentType(
                    event.target.value as StaffAssignment["type"],
                  )
                }
              >
                <option value="class_teacher">
                  Class teacher — whole class
                </option>
                <option value="subject_teacher">
                  Subject teacher — one subject
                </option>
              </select>
            </label>
            <label>
              Class
              <select name="class_id" required defaultValue="">
                <option value="" disabled>
                  Choose a class
                </option>
                {classes.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name} · {item.academic_session}
                  </option>
                ))}
              </select>
            </label>
            {assignmentType === "subject_teacher" && (
              <label>
                Subject
                <select name="subject_id" required defaultValue="">
                  <option value="" disabled>
                    Choose a subject
                  </option>
                  {subjects.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              className="school-app-button primary"
              disabled={
                saving ||
                !classes.length ||
                (assignmentType === "subject_teacher" && !subjects.length)
              }
            >
              {saving ? "Saving…" : "Assign responsibility"}
              <ArrowRight size={15} />
            </button>
          </form>
        </article>
      )}
      {canManage && member.role !== "teacher" && (
        <section className="school-app-assignment-rule">
          <Settings2 size={20} />
          <div>
            <h3>Teaching assignments are available to teachers.</h3>
            <p>
              Change this member&apos;s school role to Teacher before assigning
              a class or subject responsibility.
            </p>
          </div>
        </section>
      )}
    </section>
  );
}

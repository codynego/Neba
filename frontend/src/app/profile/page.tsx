"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/api";
import { api } from "@/lib/api";
import { User } from "@/lib/types";
import { DocumentsSection, PassportEditor } from "@/components/profile-editor";
import { MemberPhoto } from "@/components/trust";
import { PushNotificationSettings } from "@/components/push-notifications";
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Check,
  ChevronRight,
  Coins,
  FileText,
  LogOut,
  MapPin,
  Pencil,
  Shield,
  Sparkles,
  Star,
  Target,
  User as UserIcon,
} from "lucide-react";

const opportunityInterestLabels: Record<string, string> = {
  scholarship: "Scholarships",
  grant: "Grants",
  job: "Jobs",
  internship: "Internships",
  fellowship: "Fellowships",
  competition: "Competitions",
  training: "Training",
  startup: "Startup Programs",
  funding: "Business Funding",
  tender: "Tenders & Procurement",
  remote: "Remote Opportunities",
};

const goalLabels: Record<string, string> = {
  fund_education: "Fund my education",
  find_job: "Find a job",
  start_business: "Start a business",
  grow_business: "Grow my business",
  learn_skills: "Learn new skills",
  gain_experience: "Gain experience",
  study_abroad: "Study abroad",
  remote_work: "Find remote work",
  get_funding: "Get funding",
};

const eligibilityFields: { key: keyof User | string; label: string }[] = [
  { key: "date_of_birth", label: "Age" },
  { key: "country", label: "Nationality" },
  { key: "city", label: "Location" },
  { key: "education_level", label: "Education" },
  { key: "field_of_study", label: "Field of study" },
  { key: "employment_status", label: "Employment" },
  { key: "skills", label: "Skills" },
  { key: "years_experience", label: "Experience" },
  { key: "opportunity_interests", label: "Career interests" },
];

function hasValue(user: User, key: string): boolean {
  const v = (user as unknown as Record<string, unknown>)[key];
  if (Array.isArray(v)) return v.length > 0;
  return Boolean(v);
}

function completionScore(user: User): number {
  const fields = [
    user.display_name,
    user.country,
    user.education_level,
    user.field_of_study,
    user.employment_status,
    user.skills?.length,
    user.opportunity_interests?.length,
    user.goals?.length,
  ];
  const done = fields.filter(Boolean).length;
  return Math.round((done / fields.length) * 100);
}

type CreditSummary = { balance: number; earned_today: number; daily_cap: number };

function SectionHeader({ icon, eyebrow, onEdit }: { icon: React.ReactNode; eyebrow: string; onEdit?: () => void }) {
  return (
    <div className="pp-section-header">
      <span className="pp-section-icon">{icon}</span>
      <span className="pp-section-eyebrow">{eyebrow}</span>
      {onEdit && (
        <button className="pp-edit-btn" onClick={onEdit} aria-label={`Edit ${eyebrow.toLowerCase()}`}>
          <Pencil size={13} /> Edit
        </button>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (!value) return null;
  return (
    <div className="pp-row">
      <span className="pp-row-label">{label}</span>
      <span className="pp-row-value">{value}</span>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState<CreditSummary | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getToken()) { router.replace("/login?next=/profile"); return; }
    const controller = new AbortController();
    api<User>("/auth/me/", { signal: controller.signal })
      .then((profile) => { setUser(profile); api<CreditSummary>("/auth/credits/", { signal: controller.signal }).then(setCredits).catch(() => {}); })
      .catch((err) => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [router]);

  if (error) return <main className="pp-page container"><p className="error-box">{error}</p></main>;

  if (!user) return (
    <main className="pp-page container">
      <div className="pp-skeleton">
        <div className="skeleton square" />
        <div className="skeleton line long" />
        <div className="skeleton line" />
        <div className="skeleton line" />
      </div>
    </main>
  );

  const score = completionScore(user);
  const firstName = user.display_name?.split(" ")[0] || user.username;

  return (
    <main className="pp-page container">

      {/* ── Passport Header ─────────────────────────── */}
      <header className="pp-header">
        <div className="pp-header-left">
          <p className="pp-passport-label">YOUR OPPORTUNITY PASSPORT</p>
          <h1 className="pp-name">Profile</h1>
          <p className="pp-header-intro">Your profile helps Getneba find opportunities that actually fit you.</p>
          <div className="pp-header-meta">
            {(user.city || user.state) && (
              <span><MapPin size={13} />{[user.city, user.state, user.country].filter(Boolean).join(", ")}</span>
            )}
          </div>
        </div>
        <div className="pp-header-right">
          <MemberPhoto id={user.id} name={user.display_name || user.username} available={user.photo_available} />
          <div className="pp-header-person"><strong>{user.display_name || user.username}</strong><span>@{user.username}</span><div className="pp-header-actions">{credits && <Link className="pp-credit-button" href="/credits"><Coins size={15} /><span>{credits.balance}</span><small>credits</small></Link>}<button className="pp-edit-photo-btn" onClick={() => setEditing("personal")}><Pencil size={13} /> Edit profile</button></div></div>
        </div>
      </header>

      {/* ── Profile Strength ────────────────────────── */}
      <section className="pp-strength">
        <div className="pp-strength-top">
          <div>
            <span className="pp-strength-pct">{score}%</span>
            <span className="pp-strength-label">Profile complete</span>
          </div>
          <Link href="/matches" className="pp-strength-link">
            <Sparkles size={14} /> See your matches <ArrowRight size={13} />
          </Link>
        </div>
        <div className="pp-progress-bar" role="progressbar" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100}>
          <div className="pp-progress-fill" style={{ width: `${score}%` }} />
        </div>
        {score < 100 && (
          <p className="pp-strength-note">
            Complete your profile to improve your opportunity matches.{" "}
            <button className="pp-inline-link" onClick={() => setEditing("personal")}>Complete your profile →</button>
          </p>
        )}
      </section>

      <section className="pp-publisher-card">
        <span className="pp-publisher-icon"><FileText size={19} /></span>
        <div>
          <span className="pp-section-eyebrow">SHARE SOMETHING OF YOUR OWN</span>
          <h2>Have an opportunity to share?</h2>
          <p>Post it on Getneba and find people who can help make it happen.</p>
        </div>
        <Link href="/my-opportunities" className="button button-dark compact">My opportunities <ArrowRight size={15} /></Link>
      </section>

      {/* ── Edit Drawer ─────────────────────────────── */}
      {editing && (
        <div className="pp-drawer-backdrop" onClick={() => setEditing(null)}>
          <div className="pp-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="pp-drawer-header">
              <strong>Edit profile</strong>
              <button className="pp-drawer-close" onClick={() => setEditing(null)} aria-label="Close">✕</button>
            </div>
            <PassportEditor user={user} section={editing} onSaved={(updated) => { setUser(updated); setEditing(null); }} />
          </div>
        </div>
      )}

      <div className="pp-sections">

        {/* 1. Personal Information */}
        <section className="pp-section">
          <SectionHeader icon={<UserIcon size={16} />} eyebrow="PERSONAL INFORMATION" onEdit={() => setEditing("personal")} />
          <p className="pp-section-desc">Basic information used to determine eligibility.</p>
          <div className="pp-rows">
            <Row label="Full name" value={user.display_name} />
            <Row label="Date of birth" value={user.date_of_birth ? new Date(user.date_of_birth).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" }) : undefined} />
            <Row label="Country" value={user.country} />
            <Row label="State" value={user.state} />
            <Row label="City" value={user.city} />
            <Row label="Phone" value={user.phone} />
            <Row label="Email" value={user.email} />
            <Row label="Gender" value={user.gender} />
          </div>
        </section>

        <section className="pp-section">
          <SectionHeader icon={<Briefcase size={16} />} eyebrow="BUSINESS & PROJECTS" onEdit={() => setEditing("business")} />
          <p className="pp-section-desc">Useful context for grants, funding, tenders, startup programs, and business matches.</p>
          <div className="pp-rows">
            <Row label="Business or project" value={user.business_name} />
            <Row label="Stage" value={user.business_status} />
            <Row label="Industry" value={user.business_industry || user.industry} />
            <Row label="Website" value={user.business_website} />
          </div>
          {!user.business_status && <button className="pp-add-cta" onClick={() => setEditing("business")}>+ Add business context</button>}
        </section>

        {/* 2. Education */}
        <section className="pp-section">
          <SectionHeader icon={<BookOpen size={16} />} eyebrow="EDUCATION" onEdit={() => setEditing("education")} />
          <p className="pp-section-desc">Used for scholarship and fellowship matching.</p>
          <div className="pp-rows">
            <Row label="Education level" value={user.education_level} />
            <Row label="Institution" value={user.institution} />
            <Row label="Field of study" value={user.field_of_study} />
            <Row label="Expected graduation" value={user.graduation_year ?? undefined} />
            <Row label="CGPA" value={user.gpa} />
          </div>
        </section>

        {/* 3. Career & Experience */}
        <section className="pp-section">
          <SectionHeader icon={<Briefcase size={16} />} eyebrow="CAREER & EXPERIENCE" onEdit={() => setEditing("career")} />
          <div className="pp-rows">
            <Row label="Employment status" value={user.employment_status} />
            <Row label="Industry" value={user.industry} />
            <Row label="Years of experience" value={user.years_experience} />
          </div>
          {user.skills?.length > 0 && (
            <div className="pp-chips-group">
              <span className="pp-chips-label">Skills</span>
              <div className="pp-chips">
                {user.skills.map((s) => <span key={s} className="pp-chip">{s}</span>)}
              </div>
            </div>
          )}
        </section>

        {/* 4. Interests & Goals */}
        <section className="pp-section">
          <SectionHeader icon={<Target size={16} />} eyebrow="INTERESTS & GOALS" onEdit={() => setEditing("interests")} />
          {user.opportunity_interests?.length > 0 && (
            <div className="pp-chips-group">
              <span className="pp-chips-label">Looking for</span>
              <div className="pp-chips">
                {user.opportunity_interests.map((i) => (
                  <span key={i} className="pp-chip pp-chip-primary">{opportunityInterestLabels[i] || i}</span>
                ))}
              </div>
            </div>
          )}
          {user.goals?.length > 0 && (
            <div className="pp-chips-group">
              <span className="pp-chips-label">Goals</span>
              <div className="pp-chips">
                {user.goals.map((g) => (
                  <span key={g} className="pp-chip">{goalLabels[g] || g}</span>
                ))}
              </div>
            </div>
          )}
          {!user.opportunity_interests?.length && !user.goals?.length && (
            <button className="pp-add-cta" onClick={() => setEditing("interests")}>
              + Add your interests and goals
            </button>
          )}
        </section>

        {/* 5. Opportunity preferences */}
        <section className="pp-section pp-section-preferences">
          <SectionHeader icon={<MapPin size={16} />} eyebrow="OPPORTUNITY PREFERENCES" onEdit={() => setEditing("interests")} />
          <p className="pp-section-desc">Keep your radar focused on opportunities that make sense for you.</p>
          <div className="pp-preference-grid">
            <div><span>Preferred locations</span><strong>{user.country || "Add a country"}{user.opportunity_interests?.includes("remote") ? " · Remote" : ""}</strong></div>
            <div><span>Opportunity types</span><strong>{user.opportunity_interests?.length ? `${user.opportunity_interests.length} selected` : "Choose your interests"}</strong></div>
            <div><span>Profile alerts</span><strong>Push notifications {user.nearby_task_emails ? "on" : "off"}</strong></div>
          </div>
        </section>

        {/* 6. Eligibility Profile */}
        <section className="pp-section pp-section-eligibility">
          <SectionHeader icon={<Shield size={16} />} eyebrow="ELIGIBILITY PROFILE" />
          <p className="pp-section-desc">What Getneba knows about you — used to match you to real opportunities.</p>
          <div className="pp-eligibility-grid">
            {eligibilityFields.map(({ key, label }) => {
              const filled = hasValue(user, key as string);
              return (
                <div key={label} className={`pp-eligibility-row${filled ? "" : " missing"}`}>
                  <span className="pp-eligibility-check">{filled ? <Check size={13} /> : <span className="pp-eligibility-dot" />}</span>
                  <span>{label}</span>
                </div>
              );
            })}
          </div>
          <Link href="/matches" className="pp-eligibility-cta">
            View your matched opportunities <ChevronRight size={14} />
          </Link>
        </section>

        {/* 6. Bio */}
        {user.bio && (
          <section className="pp-section">
            <SectionHeader icon={<Star size={16} />} eyebrow="ABOUT YOU" onEdit={() => setEditing("personal")} />
            <p className="pp-bio">{user.bio}</p>
          </section>
        )}

        <section className="pp-section pp-section-docs">
          <SectionHeader icon={<FileText size={16} />} eyebrow="DOCUMENTS" />
          <p className="pp-section-desc">CV, transcripts, and certificates strengthen your applications.</p>
          <DocumentsSection />
        </section>

        {/* 8. Notifications */}
        <section className="pp-section">
          <SectionHeader icon={<Sparkles size={16} />} eyebrow="OPPORTUNITY ALERTS" />
          <PushNotificationSettings />
        </section>

      </div>

      {/* Footer actions */}
      <div className="pp-footer-actions">
        <Link href={`/u/${user.username}`} className="pp-footer-link">
          View public profile <ChevronRight size={14} />
        </Link>
        <button
          className="pp-logout-btn"
          onClick={() => { clearToken(); router.push("/"); }}
        >
          <LogOut size={15} /> Sign out
        </button>
      </div>

    </main>
  );
}

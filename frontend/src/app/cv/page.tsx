"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { CVDraft, Opportunity, OpportunityApplication, Page, User } from "@/lib/types";

const emptyDraft: CVDraft = {
  headline: "",
  summary: "",
  experience: [],
  education: [],
  skills: [],
  keywords: [],
  missing_information: [],
  tailoring_notes: [],
};

function profileContext(user: User) {
  return {
    name: user.display_name,
    bio: user.bio,
    skills: user.skills,
    education_level: user.education_level,
    field_of_study: user.field_of_study,
    institution: user.institution,
    graduation_year: user.graduation_year,
    employment_status: user.employment_status,
    years_experience: user.years_experience,
    industry: user.industry,
    business_name: user.business_name,
    business_industry: user.business_industry,
    business_description: user.business_description,
    business_website: user.business_website,
    country: user.country,
    city: user.city,
    saved_cv: user.cv_profile,
  };
}

function profileFallback(user: User): CVDraft {
  const education = user.education_level || user.field_of_study || user.institution
    ? [{ qualification: [user.education_level, user.field_of_study].filter(Boolean).join(" · ") || "Education", institution: user.institution || "Add institution", dates: user.graduation_year ? String(user.graduation_year) : "Add dates" }]
    : [];
  const experience = user.business_name || user.business_description
    ? [{ role: "Founder / Project lead", organization: user.business_name || "Personal project", dates: "Add dates", bullets: [user.business_description || "Add what you built, managed, or achieved."] }]
    : [];
  const saved: Partial<CVDraft> = user.cv_profile || {};
  return { ...emptyDraft, headline: saved.headline || user.industry || user.field_of_study || "Professional profile", summary: saved.summary || user.bio || "Add a short summary of your experience and the value you bring.", experience: saved.experience?.length ? saved.experience : experience, education: saved.education?.length ? saved.education : education, skills: Array.from(new Set([...(saved.skills || []), ...(user.skills || [])])), missing_information: [!(saved.summary || user.bio) ? "A short professional summary" : "", !(saved.education?.length || user.education_level || user.institution) ? "Your education and institution" : "", !(saved.skills?.length || user.skills?.length) ? "Your relevant skills" : ""].filter(Boolean), keywords: saved.keywords || [], tailoring_notes: saved.tailoring_notes || [] };
}

export default function CVPage() {
  const [user, setUser] = useState<User | null>(null);
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [applicationId, setApplicationId] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [requirements, setRequirements] = useState("");
  const [draft, setDraft] = useState<CVDraft | null>(null);
  const [additionalInformation, setAdditionalInformation] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!draft || !user) return;
    const timer = window.setTimeout(() => {
      api<User>("/auth/me/", { method: "PATCH", body: JSON.stringify({ cv_profile: { ...draft, missing_information: [], tailoring_notes: [] } }) })
        .then((updated) => { setUser(updated); if (applicationId) api(`/opportunity-applications/${applicationId}/attach-cv/`, { method: "POST" }).catch(() => {}); })
        .catch(() => setError("Your CV is still available here, but the latest changes could not be saved to your profile."));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [draft]);

  useEffect(() => {
    const opportunityId = new URLSearchParams(window.location.search).get(
      "opportunity",
    );
    setApplicationId(new URLSearchParams(window.location.search).get("application") || "");
    Promise.all([
      api<User>("/auth/me/"),
      opportunityId
        ? api<Opportunity>(`/opportunities/${opportunityId}/`)
        : Promise.resolve(null),
    ])
      .then(([profile, item]) => {
        setUser(profile);
        setOpportunity(item);
        if (item) {
          setRole(item.title);
          setCompany(item.provider);
          setRequirements(item.eligibility_notes || "");
        }
      })
      .catch((loadError) =>
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Sign in to prepare your CV.",
        ),
      )
      .finally(() => setBusy(false));
  }, []);

  async function generate() {
    if (!user) return;
    if (!role.trim() && !opportunity) {
      setError("Add the role or opportunity you are preparing for.");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const result = await api<CVDraft>("/ai/cv/tailor/", {
        method: "POST",
        body: JSON.stringify({
          profile: { ...profileContext(user), additional_information: Object.entries(additionalInformation).map(([question, answer]) => `${question}: ${answer}`).filter(Boolean).join("\n") },
          opportunity_context: opportunity
            ? {
                title: opportunity.title,
                provider: opportunity.provider,
                category: opportunity.category,
                summary: opportunity.summary,
                eligibility: opportunity.eligibility_notes,
                benefit: opportunity.benefit,
                skills: opportunity.match?.reasons?.join(", "),
                missing: opportunity.match?.missing?.join(", "),
              }
            : { title: role, provider: company, requirements },
        }),
      });
      let linkedApplicationId = applicationId;
      if (opportunity && !linkedApplicationId) {
        const existing = await api<Page<OpportunityApplication>>(`/opportunity-applications/?opportunity_id=${opportunity.public_id}`);
        if (existing.results[0]) {
          linkedApplicationId = existing.results[0].public_id;
        } else {
          const created = await api<OpportunityApplication>("/opportunity-applications/", { method: "POST", body: JSON.stringify({ opportunity_id: opportunity.public_id, status: "preparing", next_action: "Review and submit your tailored CV" }) });
          linkedApplicationId = created.public_id;
        }
        setApplicationId(linkedApplicationId);
      }
      const fallback = profileFallback(user);
      setDraft({ ...fallback, ...result, summary: result.summary || fallback.summary, headline: result.headline || fallback.headline, experience: result.experience?.length ? result.experience : fallback.experience, education: result.education?.length ? result.education : fallback.education, skills: Array.from(new Set([...(result.skills || []), ...(fallback.skills || [])])), missing_information: Array.from(new Set([...(result.missing_information || []), ...(fallback.missing_information || [])])) });
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Your CV could not be prepared.",
      );
    } finally {
      setGenerating(false);
    }
  }

  function updateDraft<K extends keyof CVDraft>(key: K, value: CVDraft[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }
  function updateExperience(index: number, value: string) {
    const experience = [...(draft?.experience || [])];
    experience[index] = {
      ...experience[index],
      bullets: value.split("\n").filter(Boolean),
    };
    updateDraft("experience", experience);
  }
  function updateEducation(
    index: number,
    key: "qualification" | "institution" | "dates",
    value: string,
  ) {
    const education = [...(draft?.education || [])];
    education[index] = { ...education[index], [key]: value };
    updateDraft("education", education);
  }

  if (busy)
    return (
      <main className="cv-page container">
        <p>Loading your CV workspace…</p>
      </main>
    );
  return (
    <main className="cv-page container">
      <Link
        className="back-link"
        href={
          opportunity ? `/opportunities/${opportunity.public_id}` : "/assistant"
        }
      >
        <ArrowLeft size={15} />{" "}
        {opportunity ? "Back to opportunity" : "Back to AI Assistant"}
      </Link>
      <header className="cv-header">
        <div>
          <span className="eyebrow">
            <Sparkles size={13} /> NEBA CV
          </span>
          <h1>
            Make your experience
            <br />
            <em>match the opportunity.</em>
          </h1>
          <p>
            Neba rewrites your real profile into a clean, ATS-friendly CV.
            Review every line before you use it.
          </p>
        </div>
        <div className="cv-header-mark">
          <FileText size={24} />
          <span>
            TRUTHFUL
            <br />
            BY DESIGN
          </span>
        </div>
      </header>
      <section className="cv-target-card">
        <div>
          <span className="eyebrow">WHAT ARE YOU PREPARING FOR?</span>
          {opportunity ? (
            <>
              <h2>{opportunity.title}</h2>
              <p>
                {opportunity.provider} · {opportunity.category}
              </p>
            </>
          ) : (
            <h2>Choose a target role</h2>
          )}
        </div>
        {!opportunity && (
          <div className="cv-target-fields">
            <label>
              Role or position
              <input
                value={role}
                onChange={(event) => setRole(event.target.value)}
                placeholder="e.g. Product Designer"
              />
            </label>
            <label>
              Company or provider
              <input
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                placeholder="Optional"
              />
            </label>
            <label className="cv-target-wide">
              Requirements or job description
              <textarea
                value={requirements}
                onChange={(event) => setRequirements(event.target.value)}
                placeholder="Paste the requirements here for better tailoring…"
                rows={3}
              />
            </label>
          </div>
        )}
        <button
          className="button button-dark"
          onClick={generate}
          disabled={generating || !user}
        >
          {generating ? (
            <>
              <LoaderCircle className="button-loader" size={16} /> Writing your
              CV…
            </>
          ) : (
            <>
              <Sparkles size={16} /> {draft ? "Update my CV" : "Prepare my CV"}
            </>
          )}
        </button>
      </section>
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
      {!draft ? (
        <section className="cv-empty">
          <FileText size={28} />
          <h2>Your tailored CV will appear here.</h2>
          <p>
            Start with your profile. Neba will bring the most relevant
            experience and skills forward, then show you what information is
            still missing.
          </p>
        </section>
      ) : (
        <div className="cv-workspace">
          <section className="cv-editor">
            <div className="cv-editor-heading">
              <div>
                <span className="eyebrow">EDITABLE DRAFT</span>
                <h2>Review before you send.</h2>
                {opportunity && applicationId && <span className="cv-attached-status"><Check size={12} /> Saved to this opportunity</span>}
              </div>
              <div className="cv-editor-actions">
                <button className="button button-outline compact" onClick={() => window.print()}>Save as PDF</button>
              </div>
            </div>
            <label className="cv-field">
              <span>Professional headline</span>
              <input
                value={draft.headline}
                onChange={(event) =>
                  updateDraft("headline", event.target.value)
                }
              />
            </label>
            <label className="cv-field">
              <span>Profile summary</span>
              <textarea
                value={draft.summary}
                onChange={(event) => updateDraft("summary", event.target.value)}
                rows={5}
              />
            </label>
            <div className="cv-editor-section">
              <div className="cv-section-title">
                <span>EXPERIENCE</span>
                {!draft.experience.length && (
                  <small>No experience was found in your profile.</small>
                )}
              </div>
              {draft.experience.map((item, index) => (
                <article
                  className="cv-experience-editor"
                  key={`${item.role}-${index}`}
                >
                  <div className="cv-experience-meta">
                    <strong>{item.role || "Experience"}</strong>
                    <span>
                      {item.organization} · {item.dates}
                    </span>
                  </div>
                  <label className="cv-field">
                    <span>
                      Bullets <small>one per line</small>
                    </span>
                    <textarea
                      value={item.bullets.join("\n")}
                      onChange={(event) =>
                        updateExperience(index, event.target.value)
                      }
                      rows={Math.max(4, item.bullets.length + 1)}
                    />
                  </label>
                </article>
              ))}
            </div>
            <div className="cv-editor-section">
              <div className="cv-section-title">
                <span>EDUCATION</span>
              </div>
              {draft.education.map((item, index) => (
                <article
                  className="cv-education-editor"
                  key={`${item.institution}-${index}`}
                >
                  <label className="cv-field">
                    <span>Qualification</span>
                    <input
                      value={item.qualification}
                      onChange={(event) =>
                        updateEducation(
                          index,
                          "qualification",
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <label className="cv-field">
                    <span>Institution</span>
                    <input
                      value={item.institution}
                      onChange={(event) =>
                        updateEducation(
                          index,
                          "institution",
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <label className="cv-field">
                    <span>Dates</span>
                    <input
                      value={item.dates}
                      onChange={(event) =>
                        updateEducation(index, "dates", event.target.value)
                      }
                    />
                  </label>
                </article>
              ))}
            </div>
            <label className="cv-field">
              <span>
                Skills <small>separate with commas</small>
              </span>
              <input
                value={draft.skills.join(", ")}
                onChange={(event) =>
                  updateDraft(
                    "skills",
                    event.target.value
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean),
                  )
                }
              />
            </label>
          </section>
          <aside className="cv-side">
            <section className="cv-preview">
              <div className="cv-preview-top">
                <span>CV PREVIEW</span>
                <small>ATS-friendly layout</small>
              </div>
              <div className="cv-paper">
                <h2>{user?.display_name || "Your name"}</h2>
                <h3>{draft.headline}</h3>
                <p className="cv-paper-contact">
                  {[user?.email, user?.city, user?.country]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <div>
                  <strong>PROFILE</strong>
                  <p>{draft.summary}</p>
                </div>
                {draft.experience.length > 0 && (
                  <div>
                    <strong>EXPERIENCE</strong>
                    {draft.experience.map((item, index) => (
                      <article key={`${item.role}-preview-${index}`}>
                        <b>{item.role}</b>
                        <span>
                          {item.organization} · {item.dates}
                        </span>
                        <ul>
                          {item.bullets.map((bullet) => (
                            <li key={bullet}>{bullet}</li>
                          ))}
                        </ul>
                      </article>
                    ))}
                  </div>
                )}
                <div>
                  <strong>EDUCATION</strong>
                  {draft.education.map((item, index) => (
                    <p key={`${item.institution}-preview-${index}`}>
                      <b>{item.qualification}</b>
                      <br />
                      {item.institution} · {item.dates}
                    </p>
                  ))}
                </div>
                <div>
                  <strong>SKILLS</strong>
                  <p>{draft.skills.join(" · ")}</p>
                </div>
              </div>
            </section>
            <section className="cv-feedback">
              <span className="eyebrow">
                <Check size={13} /> NEBA REVIEW
              </span>
              <h3>Tailored to this opportunity</h3>
              <ul>
                {draft.tailoring_notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
              {draft.missing_information.length > 0 && (
                <>
                  <h4>Neba needs a little more</h4>
                  <p className="cv-missing-intro">Answer these prompts and Neba will update the CV with your information. It will not invent details for you.</p>
                  <div className="cv-missing-form">
                    {draft.missing_information.map((item) => (
                      <label key={item}>
                        <span>{item}</span>
                        <textarea value={additionalInformation[item] || ""} onChange={(event) => setAdditionalInformation((current) => ({ ...current, [item]: event.target.value }))} placeholder="Add the details you want Neba to use…" rows={3} />
                      </label>
                    ))}
                  </div>
                  <button className="button button-outline compact cv-update-button" onClick={generate} disabled={generating}><Sparkles size={14} /> {generating ? "Updating CV…" : "Update CV with my answers"}</button>
                </>
              )}
            </section>
            <Link
              className="cv-interview-link"
              href={
                opportunity
                  ? `/assistant/interview?opportunity=${opportunity.public_id}`
                  : "/assistant/interview"
              }
            >
              <span>
                <Sparkles size={17} />
                <strong>Next: practise your interview</strong>
                <small>Use this CV as your preparation base.</small>
              </span>
              <ArrowRight size={16} />
            </Link>
          </aside>
        </div>
      )}
    </main>
  );
}

"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { Camera, LocateFixed, MailCheck, Send, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { ProfileDocument, User } from "@/lib/types";
import { compressImage } from "@/lib/image-compression";

type UploadTicket = { upload_url: string; key: string; content_type: string };

async function patchUser(data: Record<string, unknown>): Promise<User> {
  return api<User>("/auth/me/", { method: "PATCH", body: JSON.stringify(data) });
}

function usePhotoUpload() {
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [compressing, setCompressing] = useState(false);
  const [photoError, setPhotoError] = useState("");

  useEffect(() => {
    if (!photo) { setPreview(""); return; }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    setPhotoError("");
    if (!file) { setPhoto(null); return; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      event.target.value = ""; setPhoto(null);
      setPhotoError("Choose a JPEG, PNG, or WebP photo."); return;
    }
    if (file.size > 20 * 1024 * 1024) {
      event.target.value = ""; setPhoto(null);
      setPhotoError("Choose a photo under 20 MB."); return;
    }
    setCompressing(true);
    try { setPhoto(await compressImage(file)); }
    catch (error) { event.target.value = ""; setPhoto(null); setPhotoError((error as Error).message || "Could not process photo."); }
    finally { setCompressing(false); }
  }

  async function uploadPhoto(): Promise<User | null> {
    if (!photo) return null;
    const f = photo.size > 2 * 1024 * 1024 ? await compressImage(photo) : photo;
    const ticket = await api<UploadTicket>("/auth/profile-photo/upload/", { method: "POST", body: JSON.stringify({ content_type: f.type, size: f.size }) });
    const up = await fetch(ticket.upload_url, { method: "PUT", headers: { "Content-Type": ticket.content_type }, body: f });
    if (!up.ok) throw new Error("Photo upload failed.");
    return api<User>("/auth/profile-photo/confirm/", { method: "POST", body: JSON.stringify({ key: ticket.key }) });
  }

  return { photo, preview, compressing, photoError, choosePhoto, uploadPhoto, setPhoto };
}

function EmailCard({ user }: { user: User }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function resend() {
    setBusy(true); setMsg("");
    try { const r = await api<{ detail: string }>("/auth/email/resend/", { method: "POST", body: "{}" }); setMsg(r.detail); }
    catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <section className={`email-verification-card${user.email_verified ? " is-verified" : ""}`} aria-live="polite">
      <div className="email-verification-icon" aria-hidden="true">{user.email_verified ? <MailCheck size={21} /> : <ShieldCheck size={21} />}</div>
      <div className="email-verification-content">
        <div className="email-verification-heading">
          <span className="email-verification-label">Account email</span>
          <span className="email-verification-status">{user.email_verified ? "Verified" : "Action needed"}</span>
        </div>
        <strong>{user.email}</strong>
        {user.email_verified ? <p>Your email is confirmed.</p> : <>
          <p>Verify your email to enable notifications.</p>
          <button className="email-verification-button" type="button" onClick={resend} disabled={busy}>
            <Send size={14} />{busy ? "Sending…" : "Resend verification email"}
          </button>
        </>}
        {msg && <p className="email-verification-feedback" role="status">{msg}</p>}
      </div>
    </section>
  );
}

function PersonalSection({ user, onSaved }: { user: User; onSaved: (u: User) => void }) {
  const { photo, preview, compressing, photoError, choosePhoto, uploadPhoto, setPhoto } = usePhotoUpload();
  const [coords, setCoords] = useState({ latitude: user.latitude || "", longitude: user.longitude || "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  function locateMe() {
    if (!navigator.geolocation) { setMsg("Location not supported."); return; }
    navigator.geolocation.getCurrentPosition(
      ({ coords: c }) => setCoords({ latitude: c.latitude.toFixed(6), longitude: c.longitude.toFixed(6) }),
      () => setMsg("Location unavailable. Enter manually."),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMsg("");
    const data = new FormData(event.currentTarget);
    data.delete("profile_photo");
    try {
      let updated = await patchUser({ ...Object.fromEntries(data), photo_visible: data.get("photo_visible") === "on", latitude: coords.latitude || null, longitude: coords.longitude || null });
      if (photo) { const r = await uploadPhoto(); if (r) updated = r; setPhoto(null); }
      onSaved(updated); setMsg("Saved.");
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <form className="pp-editor-form stack-form" onSubmit={save}>
      <EmailCard user={user} />
      <label className="profile-photo-field">Profile photo
        <span className="photo-upload-row">
          <span className="photo-preview">{compressing ? <small style={{ fontSize: "10px", textAlign: "center", lineHeight: "1.2" }}>Optimizing…</small> : preview ? <img src={preview} alt="Preview" /> : <Camera size={24} />}</span>
          <span><input name="profile_photo" type="file" accept="image/jpeg,image/png,image/webp" required={!user.photo_available} onChange={choosePhoto} disabled={busy || compressing} /><small>JPEG, PNG or WebP under 20 MB.</small></span>
        </span>
      </label>
      {photoError && <p className="form-error">{photoError}</p>}
      <label className="legal-consent"><input name="photo_visible" type="checkbox" defaultChecked={user.photo_visible} /><span>Show my photo on my public profile.</span></label>
      <label>Full name<input name="display_name" defaultValue={user.display_name} required maxLength={80} /></label>
      <label>Date of birth<input name="date_of_birth" type="date" defaultValue={user.date_of_birth || ""} /></label>
      <label>Gender
        <select name="gender" defaultValue={user.gender || ""}>
          <option value="">Prefer not to say</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="non_binary">Non-binary</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label>Country<input name="country" defaultValue={user.country} maxLength={120} placeholder="Nigeria" /></label>
      <div className="form-row">
        <label>State<input name="state" defaultValue={user.state} maxLength={120} /></label>
        <label>City<input name="city" defaultValue={user.city} maxLength={120} /></label>
      </div>
      <label>Area / neighborhood<input name="neighborhood" defaultValue={user.neighborhood} maxLength={120} placeholder="e.g. GRA, Lekki" /></label>
      <label>Address (private)<input name="address" defaultValue={user.address} maxLength={240} placeholder="Street or landmark" /><small>Stays private. Others see only your area.</small></label>
      <button className="location-capture" type="button" onClick={locateMe}><LocateFixed size={16} />Use my current location</button>
      {coords.latitude && coords.longitude && <p className="coordinate-note">Location added privately.</p>}
      <label>Phone<input name="phone" type="tel" autoComplete="tel" defaultValue={user.phone || ""} placeholder="0801 234 5678" /></label>
      <label>About you<textarea name="bio" defaultValue={user.bio} maxLength={600} rows={3} placeholder="A short bio for your public profile." /></label>
      <button className="button button-dark compact" disabled={busy || compressing}>{compressing ? "Optimizing photo…" : busy ? "Saving…" : "Save personal info"}</button>
      {msg && <p role="status" className="profile-feedback">{msg}</p>}
    </form>
  );
}

function EducationSection({ user, onSaved }: { user: User; onSaved: (u: User) => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMsg("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try { const updated = await patchUser({ ...data, graduation_year: data.graduation_year ? Number(data.graduation_year) : null }); onSaved(updated); setMsg("Saved."); }
    catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <form className="pp-editor-form stack-form" onSubmit={save}>
      <label>Education level
        <select name="education_level" defaultValue={user.education_level || ""}>
          <option value="">Select…</option>
          <option value="secondary">Secondary school</option>
          <option value="ond">OND / Diploma</option>
          <option value="hnd">HND</option>
          <option value="university">University (Bachelor&apos;s)</option>
          <option value="masters">Master&apos;s</option>
          <option value="phd">PhD</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label>Institution<input name="institution" defaultValue={user.institution} maxLength={200} placeholder="University of Lagos" /></label>
      <label>Field of study<input name="field_of_study" defaultValue={user.field_of_study} maxLength={120} placeholder="Computer Science" /></label>
      <label>Expected graduation year<input name="graduation_year" type="number" defaultValue={user.graduation_year ?? ""} min={1990} max={2040} placeholder="2027" /></label>
      <label>CGPA / GPA<input name="gpa" defaultValue={user.gpa} maxLength={20} placeholder="3.4 / 5.0" /></label>
      <button className="button button-dark compact" disabled={busy}>{busy ? "Saving…" : "Save education"}</button>
      {msg && <p role="status" className="profile-feedback">{msg}</p>}
    </form>
  );
}

const SKILLS_PRESET = ["Python","JavaScript","TypeScript","React","Node.js","Django","SQL","Data Analysis","Machine Learning","AI","Design","Figma","Writing","Marketing","Sales","Finance","Project Management","Research","Teaching","Photography","Video Editing","Social Media","Content Creation","Business Development","Entrepreneurship","Agriculture"];

function CareerSection({ user, onSaved }: { user: User; onSaved: (u: User) => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [skills, setSkills] = useState<string[]>(user.skills || []);
  const [customSkill, setCustomSkill] = useState("");

  function toggleSkill(s: string) { setSkills((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]); }
  function addCustom() { const t = customSkill.trim(); if (t && !skills.includes(t)) setSkills((p) => [...p, t]); setCustomSkill(""); }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMsg("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try { const updated = await patchUser({ ...data, skills }); onSaved(updated); setMsg("Saved."); }
    catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <form className="pp-editor-form stack-form" onSubmit={save}>
      <label>Employment status
        <select name="employment_status" defaultValue={user.employment_status || ""}>
          <option value="">Select…</option>
          <option value="student">Student</option>
          <option value="employed">Employed</option>
          <option value="self_employed">Self-employed</option>
          <option value="unemployed">Unemployed</option>
          <option value="freelancer">Freelancer</option>
        </select>
      </label>
      <label>Industry<input name="industry" defaultValue={user.industry} maxLength={120} placeholder="Technology" /></label>
      <label>Years of experience
        <select name="years_experience" defaultValue={user.years_experience || ""}>
          <option value="">Select…</option>
          <option value="0">Less than 1 year</option>
          <option value="1">1 year</option>
          <option value="2">2 years</option>
          <option value="3">3 years</option>
          <option value="5">5 years</option>
          <option value="7">7+ years</option>
          <option value="10">10+ years</option>
        </select>
      </label>
      <label>Business status
        <select name="business_status" defaultValue={user.business_status || ""}>
          <option value="">None / not applicable</option>
          <option value="idea">Idea stage</option>
          <option value="early">Early stage</option>
          <option value="established">Established</option>
          <option value="scaling">Scaling</option>
        </select>
      </label>
      <fieldset className="pp-skill-picker">
        <legend>Your skills</legend>
        <div className="pp-skill-chips">
          {SKILLS_PRESET.map((s) => (
            <button key={s} type="button" className={`pp-skill-chip${skills.includes(s) ? " selected" : ""}`} onClick={() => toggleSkill(s)}>{s}</button>
          ))}
          {skills.filter((s) => !SKILLS_PRESET.includes(s)).map((s) => (
            <button key={s} type="button" className="pp-skill-chip selected" onClick={() => toggleSkill(s)}>{s}</button>
          ))}
        </div>
        <div className="pp-skill-custom">
          <input value={customSkill} onChange={(e) => setCustomSkill(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} placeholder="Add a skill…" maxLength={60} />
          <button type="button" className="small-button" onClick={addCustom}>Add</button>
        </div>
      </fieldset>
      <button className="button button-dark compact" disabled={busy}>{busy ? "Saving…" : "Save career info"}</button>
      {msg && <p role="status" className="profile-feedback">{msg}</p>}
    </form>
  );
}

function BusinessSection({ user, onSaved }: { user: User; onSaved: (u: User) => void }) {
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setMsg(""); try { const updated = await patchUser(Object.fromEntries(new FormData(event.currentTarget))); onSaved(updated); setMsg("Saved."); } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); } }
  return <form className="pp-editor-form stack-form" onSubmit={save}><p className="pp-section-desc">Add context if you run a business, are building an idea, or want funding and procurement opportunities.</p><label>Business or project name<input name="business_name" defaultValue={user.business_name || ""} maxLength={180} placeholder="e.g. Kora Foods" /></label><label>Business stage<select name="business_status" defaultValue={user.business_status || ""}><option value="">Not applicable</option><option value="idea">Idea stage</option><option value="early">Early stage</option><option value="established">Established</option><option value="scaling">Scaling</option></select></label><label>Industry<input name="business_industry" defaultValue={user.business_industry || user.industry || ""} maxLength={120} placeholder="e.g. Food, technology, fashion" /></label><label>Website <small>Optional</small><input name="business_website" type="url" defaultValue={user.business_website || ""} placeholder="https://example.com" /></label><label>What are you building?<textarea name="business_description" defaultValue={user.business_description || ""} maxLength={1000} rows={4} placeholder="Briefly describe your business or idea." /></label><button className="button button-dark compact" disabled={busy}>{busy ? "Saving…" : "Save business info"}</button>{msg && <p role="status" className="profile-feedback">{msg}</p>}</form>;
}

export function DocumentsSection() {
  const [documents, setDocuments] = useState<ProfileDocument[]>([]); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null); const [pendingName, setPendingName] = useState(""); const [pendingType, setPendingType] = useState("other");
  async function load() { setDocuments(await api<ProfileDocument[]>("/auth/documents/")); }
  useEffect(() => { load().catch(() => {}); }, []);
  function chooseFile(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; const lowerName = file.name.toLowerCase(); const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim(); setPendingFile(file); setPendingName(baseName || "Document"); setPendingType(lowerName.includes("cv") || lowerName.includes("resume") ? "cv" : lowerName.includes("business") ? "business_plan" : "other"); setMsg(""); }
  function cancelUpload() { setPendingFile(null); setPendingName(""); setPendingType("other"); }
  async function upload(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!pendingFile || !pendingName.trim()) { setMsg("Add a name for this document before uploading."); return; } setBusy(true); setMsg(""); try { const extension = pendingFile.name.includes(".") ? `.${pendingFile.name.split(".").pop()}` : ""; const name = pendingName.trim().toLowerCase().endsWith(extension.toLowerCase()) ? pendingName.trim() : `${pendingName.trim()}${extension}`; const ticket = await api<{ upload_url: string; key: string }>("/auth/documents/", { method: "POST", body: JSON.stringify({ document_type: pendingType, name, content_type: pendingFile.type || "application/octet-stream", size: pendingFile.size }) }); const result = await fetch(ticket.upload_url, { method: "PUT", headers: { "Content-Type": pendingFile.type || "application/octet-stream" }, body: pendingFile }); if (!result.ok) throw new Error("Document upload failed."); await api("/auth/documents/confirm/", { method: "POST", body: JSON.stringify({ key: ticket.key, document_type: pendingType, name }) }); await load(); cancelUpload(); setMsg("Document added."); } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); } }
  async function remove(publicId: string) { setBusy(true); try { await api(`/auth/documents/${publicId}/`, { method: "DELETE" }); await load(); } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); } }
  return <div className="profile-documents"><div className="profile-documents-actions"><label className="button button-outline compact">{pendingFile ? "Change file" : "Add document"}<input type="file" accept=".pdf,.doc,.docx,.xlsx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain" onChange={chooseFile} disabled={busy} hidden /></label><small>PDF, Word, spreadsheet or text · up to 10 MB</small></div>{pendingFile && <form className="profile-document-upload-form" onSubmit={upload}><div className="profile-document-selected"><strong>{pendingFile.name}</strong><small>{(pendingFile.size / 1024 / 1024).toFixed(1)} MB selected</small></div><div className="profile-document-upload-fields"><label>Document name<input value={pendingName} onChange={(event) => setPendingName(event.target.value)} placeholder="e.g. CV" required /></label><label>Document type<select value={pendingType} onChange={(event) => setPendingType(event.target.value)}><option value="cv">CV / Resume</option><option value="business_plan">Business plan</option><option value="portfolio">Portfolio</option><option value="certificate">Certificate</option><option value="other">Other</option></select></label></div><small className="profile-document-hint">Choose a type so we can find and use this document for the right opportunities later.</small><div className="profile-document-upload-actions"><button className="small-button" type="button" onClick={cancelUpload} disabled={busy}>Cancel</button><button className="button compact" type="submit" disabled={busy}>{busy ? "Uploading…" : "Save document"}</button></div></form>}{documents.length ? <div className="profile-document-list">{documents.map((document) => <div className="profile-document-row" key={document.public_id}><div><strong>{document.name}</strong><small>{document.document_type_label} · {(document.size / 1024 / 1024).toFixed(1)} MB</small></div><div>{document.download_url && <a className="small-button" href={document.download_url} target="_blank" rel="noreferrer">Open</a>}<button className="small-button" type="button" onClick={() => remove(document.public_id)} disabled={busy}>Remove</button></div></div>)}</div> : <p className="pp-coming-soon">No documents yet. Add a CV, business plan, portfolio, or certificate when you are ready.</p>}{msg && <p role="status" className="profile-feedback">{msg}</p>}</div>;
}

const INTEREST_OPTIONS = [
  { value: "scholarship", label: "Scholarships" },{ value: "grant", label: "Grants" },{ value: "job", label: "Jobs" },
  { value: "internship", label: "Internships" },{ value: "fellowship", label: "Fellowships" },{ value: "competition", label: "Competitions" },
  { value: "training", label: "Training" },{ value: "startup", label: "Startup Programs" },{ value: "tender", label: "Tenders & Procurement" },{ value: "remote", label: "Remote Opportunities" },
];
const GOAL_OPTIONS = [
  { value: "fund_education", label: "Fund my education" },{ value: "find_job", label: "Find a job" },{ value: "start_business", label: "Start a business" },
  { value: "grow_business", label: "Grow my business" },{ value: "learn_skills", label: "Learn new skills" },{ value: "gain_experience", label: "Gain experience" },
  { value: "study_abroad", label: "Study abroad" },{ value: "remote_work", label: "Find remote work" },{ value: "get_funding", label: "Get funding" },
];

function InterestsSection({ user, onSaved }: { user: User; onSaved: (u: User) => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [interests, setInterests] = useState<string[]>(user.opportunity_interests || []);
  const [goals, setGoals] = useState<string[]>(user.goals || []);

  function toggle(list: string[], setList: (l: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMsg("");
    try { const updated = await patchUser({ opportunity_interests: interests, goals }); onSaved(updated); setMsg("Saved."); }
    catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <form className="pp-editor-form stack-form" onSubmit={save}>
      <fieldset className="pp-multi-select">
        <legend>What are you looking for?</legend>
        <div className="pp-select-chips">
          {INTEREST_OPTIONS.map(({ value, label }) => (
            <button key={value} type="button" className={`pp-select-chip${interests.includes(value) ? " selected" : ""}`} onClick={() => toggle(interests, setInterests, value)}>{label}</button>
          ))}
        </div>
      </fieldset>
      <fieldset className="pp-multi-select">
        <legend>What are you trying to achieve?</legend>
        <div className="pp-select-chips">
          {GOAL_OPTIONS.map(({ value, label }) => (
            <button key={value} type="button" className={`pp-select-chip${goals.includes(value) ? " selected" : ""}`} onClick={() => toggle(goals, setGoals, value)}>{label}</button>
          ))}
        </div>
      </fieldset>
      <button className="button button-dark compact" disabled={busy}>{busy ? "Saving…" : "Save interests & goals"}</button>
      {msg && <p role="status" className="profile-feedback">{msg}</p>}
    </form>
  );
}

export function PassportEditor({ user, section, onSaved }: { user: User; section: string; onSaved: (u: User) => void }) {
  if (section === "education") return <EducationSection user={user} onSaved={onSaved} />;
  if (section === "career") return <CareerSection user={user} onSaved={onSaved} />;
  if (section === "business") return <BusinessSection user={user} onSaved={onSaved} />;
  if (section === "interests") return <InterestsSection user={user} onSaved={onSaved} />;
  return <PersonalSection user={user} onSaved={onSaved} />;
}

// Keep ProfileEditor export for backward compatibility with any other imports
export function ProfileEditor({ user, onSaved }: { user: User; onSaved: (u: User) => void }) {
  return <PassportEditor user={user} section="personal" onSaved={onSaved} />;
}

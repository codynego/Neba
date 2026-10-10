"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowRight, ClipboardCheck, Globe2, LoaderCircle, Plus, X } from "lucide-react";
import { api } from "@/lib/api";
import { OpportunityApplication, Page } from "@/lib/types";

const categories = [
  ["job", "Job"], ["internship", "Internship"], ["scholarship", "Scholarship"],
  ["fellowship", "Fellowship"], ["grant", "Grant"], ["training", "Training"],
  ["competition", "Competition"], ["startup", "Startup programme"], ["funding", "Funding"],
];

export default function ApplicationsPage() {
  const [items, setItems] = useState<OpportunityApplication[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => { api<Page<OpportunityApplication>>("/opportunity-applications/").then((page) => setItems(page.results)).catch(() => {}); }, []);

  async function addExternalApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setFeedback("");
    const form = new FormData(event.currentTarget);
    const dateTime = (name: string) => form.get(name) ? `${form.get(name)}T23:59:00Z` : null;
    const payload = {
      title: form.get("title"), provider: form.get("provider"), application_url: form.get("application_url"),
      category: form.get("category"), location_label: form.get("location_label"), status: form.get("status"),
      deadline: dateTime("deadline"), next_action: form.get("next_action"), next_action_at: dateTime("next_action_at"), notes: form.get("notes"),
    };
    try {
      const created = await api<OpportunityApplication>("/opportunity-applications/", { method: "POST", body: JSON.stringify(payload) });
      setItems((current) => [created, ...current]);
      setFeedback(`${created.opportunity.title} is now in your tracker.`);
      setShowForm(false);
      formRef.current?.reset();
    } catch (exception) { setError((exception as Error).message); } finally { setBusy(false); }
  }

  return <main className="tracker-page container">
    <header className="tracker-page-header"><div><span className="eyebrow">APPLICATION TRACKER</span><h1>Keep every next step visible.</h1><p>Track applications from GetNeba and anywhere else in one private workspace.</p></div><button className="button button-dark tracker-add-button" onClick={() => { setShowForm((open) => !open); setError(""); }}><Plus size={17} /> Add outside application</button></header>

    {showForm && <section className="external-application-sheet" aria-labelledby="outside-application-title">
      <div className="external-sheet-marker"><Globe2 size={18} /><span>OUTSIDE<br />GETNEBA</span></div>
      <div className="external-sheet-body"><div className="external-sheet-heading"><div><span className="eyebrow">PRIVATE TRACKER ENTRY</span><h2 id="outside-application-title">Bring an outside application into view.</h2><p>This stays private. It will not be published as an opportunity or contribution.</p></div><button className="icon-button" type="button" aria-label="Close form" onClick={() => setShowForm(false)}><X size={18} /></button></div>
      <form ref={formRef} onSubmit={addExternalApplication} className="external-application-form">
        <div className="form-row"><label><span>Opportunity title</span><input name="title" required maxLength={220} placeholder="e.g. Graduate Product Analyst" /></label><label><span>Organisation</span><input name="provider" required maxLength={180} placeholder="e.g. Acme Labs" /></label></div>
        <label><span>Application link <small>Optional</small></span><input name="application_url" type="url" maxLength={500} placeholder="https://company.com/careers/role" /></label>
        <div className="form-row external-form-triple"><label><span>Type</span><select name="category" defaultValue="job">{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>Status</span><select name="status" defaultValue="applied"><option value="preparing">Preparing</option><option value="applied">Applied</option><option value="shortlisted">Shortlisted</option><option value="interview">Interview</option><option value="awarded">Awarded</option><option value="unsuccessful">Unsuccessful</option><option value="withdrawn">Withdrawn</option></select></label><label><span>Deadline <small>Optional</small></span><input name="deadline" type="date" /></label></div>
        <div className="form-row"><label><span>Location <small>Optional</small></span><input name="location_label" maxLength={140} placeholder="Remote, Lagos, London…" /></label><label><span>Next action date <small>Optional</small></span><input name="next_action_at" type="date" /></label></div>
        <label><span>Next action <small>Optional</small></span><input name="next_action" maxLength={240} placeholder="Follow up, prepare for interview, send portfolio…" /></label>
        <label><span>Private notes <small>Optional</small></span><textarea name="notes" rows={3} maxLength={2000} placeholder="What did you submit? Who did you speak to? What should you remember?" /></label>
        {error && <p className="error-box" role="alert">{error}</p>}
        <div className="external-form-footer"><span>Only you can see this entry.</span><button className="button button-dark" disabled={busy}>{busy ? <><LoaderCircle size={16} /> Adding…</> : <>Add to tracker <ArrowRight size={16} /></>}</button></div>
      </form></div>
    </section>}

    {feedback && <p className="tracker-feedback" role="status">{feedback}</p>}
    {items.length ? <div className="tracker-list full">{items.map((item) => <Link href={`/applications/${item.public_id}`} key={item.public_id}><ClipboardCheck size={18} /><div><strong>{item.opportunity.title}</strong><small>{item.next_action || item.opportunity.provider}</small>{item.opportunity.tracker_only && <span className="tracker-private-label">Added by you · private</span>}</div><span className={`application-status ${item.status}`}>{item.status}</span>{item.unread_activity_count > 0 && <span className="application-update-indicator"><i />{item.unread_activity_count > 1 ? `${item.unread_activity_count} updates` : "New update"}</span>}<ArrowRight size={16} /></Link>)}</div> : <div className="radar-empty"><ClipboardCheck size={26} /><div><strong>No applications in your tracker.</strong><p>Add one you found elsewhere, or start preparing from a GetNeba match.</p></div><button className="button button-dark compact" onClick={() => setShowForm(true)}>Add outside application <Plus size={15} /></button><Link className="button button-outline compact" href="/matches">See my matches <ArrowRight size={15} /></Link></div>}
  </main>;
}

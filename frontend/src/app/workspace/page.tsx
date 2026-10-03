"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Banknote, Check, ChevronRight, CircleDollarSign, ClipboardList, MessageCircleMore, Plus, Sparkles, UserRoundPlus, Wrench, X } from "lucide-react";
import { api, getToken } from "@/lib/api";
import { Business, Customer, Job, JobStatus, Page, naira } from "@/lib/types";

const columns: { status: JobStatus; label: string; empty: string }[] = [
  { status: "new", label: "New request", empty: "No fresh enquiries" },
  { status: "quoted", label: "Quote sent", empty: "No quotes waiting" },
  { status: "confirmed", label: "Confirmed", empty: "No confirmed work" },
  { status: "in_progress", label: "In progress", empty: "No active jobs" },
  { status: "completed", label: "Complete", empty: "No completed jobs" },
];
const nextStatus: Partial<Record<JobStatus, JobStatus>> = { new: "quoted", quoted: "confirmed", confirmed: "in_progress", in_progress: "completed" };
const statusCopy: Record<JobStatus, string> = { new: "Send quote", quoted: "Confirm job", confirmed: "Start job", in_progress: "Mark complete", completed: "Completed", cancelled: "Cancelled" };

export default function WorkspacePage() {
  const router = useRouter();
  const [business, setBusiness] = useState<Business | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showJobForm, setShowJobForm] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setError("");
    try {
      const mine = await api<{ business: Business | null }>("/businesses/mine/");
      setBusiness(mine.business);
      if (mine.business) {
        const [jobPage, customerPage] = await Promise.all([api<Page<Job>>("/jobs/"), api<Page<Customer>>("/customers/")]);
        setJobs(jobPage.results); setCustomers(customerPage.results);
      }
    } catch (err) { setError(err instanceof Error ? err.message : "We couldn’t load your workspace."); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (!getToken()) { router.replace("/login?next=/workspace"); return; } void load(); }, [router]);

  const moneyAtRisk = useMemo(() => jobs.filter((job) => Number(job.balance_due) > 0 && job.status !== "cancelled").reduce((sum, job) => sum + Number(job.balance_due), 0), [jobs]);
  async function createBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); const form = new FormData(event.currentTarget);
    try { await api<Business>("/businesses/", { method: "POST", body: JSON.stringify({ name: form.get("name"), service_type: form.get("service_type"), city: form.get("city"), phone: form.get("phone") }) }); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Your workspace wasn’t created."); } finally { setSaving(false); }
  }
  async function createCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); const form = new FormData(event.currentTarget);
    try { const customer = await api<Customer>("/customers/", { method: "POST", body: JSON.stringify({ name: form.get("name"), phone: form.get("phone"), address: form.get("address") }) }); setCustomers((items) => [...items, customer].sort((a, b) => a.name.localeCompare(b.name))); setShowCustomerForm(false); }
    catch (err) { setError(err instanceof Error ? err.message : "The customer wasn’t saved."); } finally { setSaving(false); }
  }
  async function createJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); const form = new FormData(event.currentTarget); const quote = String(form.get("quote_amount") || "").trim();
    try { const job = await api<Job>("/jobs/", { method: "POST", body: JSON.stringify({ customer: Number(form.get("customer")), title: form.get("title"), description: form.get("description"), address: form.get("address"), assignee_name: form.get("assignee_name"), quote_amount: quote || null, deposit_amount: form.get("deposit_amount") || "0", amount_paid: form.get("amount_paid") || "0", source: "whatsapp" }) }); setJobs((items) => [job, ...items]); setShowJobForm(false); }
    catch (err) { setError(err instanceof Error ? err.message : "The job wasn’t saved."); } finally { setSaving(false); }
  }
  async function advanceJob(job: Job) { const next = nextStatus[job.status]; if (!next) return; setSaving(true); try { const updated = await api<Job>(`/jobs/${job.id}/advance/`, { method: "POST", body: JSON.stringify({ status: next }) }); setJobs((items) => items.map((item) => item.id === job.id ? updated : item)); } catch (err) { setError(err instanceof Error ? err.message : "The job status wasn’t updated."); } finally { setSaving(false); } }

  if (loading) return <main className="ops-page"><div className="ops-loading">Loading your workspace…</div></main>;
  if (!business) return <main className="ops-page"><section className="ops-onboard"><div><span className="ops-label">NEBA PRO WORKSPACE</span><h1>Set up the desk<br />behind your jobs.</h1><p>Start with the business name your customers know. You can begin logging enquiries immediately.</p><div className="ops-onboard-note"><Sparkles size={18} /><span>Customer jobs, quotes and payment follow-ups will live here.</span></div></div><form className="ops-form" onSubmit={createBusiness}><h2>Create your workspace</h2><Field label="Business name" name="name" placeholder="e.g. Bright Air Services" required /><Field label="What do you do?" name="service_type" placeholder="e.g. AC repair & installation" /><Field label="City" name="city" placeholder="e.g. Lagos" /><Field label="Business phone" name="phone" placeholder="e.g. 0801 000 0000" /><button className="ops-primary" disabled={saving}>{saving ? "Creating…" : "Create workspace"}<ArrowRight size={17} /></button>{error && <p className="ops-error" role="alert">{error}</p>}</form></section></main>;
  return <main className="ops-page"><div className="ops-top"><div><span className="ops-label">{business.service_type || "SERVICE BUSINESS"} · {business.city || "NIGERIA"}</span><h1>{business.name}</h1><p>Here’s what needs your attention today.</p></div><div className="ops-top-actions"><button className="ops-quiet" onClick={() => setShowCustomerForm(true)}><UserRoundPlus size={17} /> Customer</button><button className="ops-primary" onClick={() => setShowJobForm(true)}><Plus size={18} /> New job</button></div></div>
    {error && <p className="ops-error ops-banner" role="alert">{error} <button onClick={() => void load()}>Try again</button></p>}
    <section className="ops-pulse"><article><span><ClipboardList size={18} /> OPEN JOBS</span><strong>{jobs.filter((job) => !["completed", "cancelled"].includes(job.status)).length}</strong><p>Across your pipeline</p></article><article><span><CircleDollarSign size={18} /> BALANCE TO COLLECT</span><strong>{naira(moneyAtRisk)}</strong><p>From open jobs</p></article><article className="ops-assist"><span><Sparkles size={18} /> NEBA ASSIST</span><strong>{jobs.filter((job) => job.status === "new" || job.status === "quoted").length} jobs need a response</strong><p>Reply while the customer is still ready to book.</p></article></section>
    <section className="ops-board-section"><div className="ops-section-title"><div><span className="ops-label">JOB PIPELINE</span><h2>Every job has a next step.</h2></div><span>{jobs.length} total jobs</span></div><div className="ops-board">{columns.map((column) => { const cards = jobs.filter((job) => job.status === column.status); return <section className={`ops-column ops-${column.status}`} key={column.status}><header><span>{column.label}</span><b>{cards.length}</b></header>{cards.length ? cards.map((job) => <JobCard job={job} key={job.id} onAdvance={advanceJob} disabled={saving} />) : <p className="ops-empty">{column.empty}</p>}<button className="ops-add-job" onClick={() => setShowJobForm(true)}>+ Add job</button></section>; })}</div></section>
    {showJobForm && <Modal title="Add a customer job" onClose={() => setShowJobForm(false)}><form className="ops-form ops-form-compact" onSubmit={createJob}><label>Customer<select name="customer" required defaultValue=""><option value="" disabled>Choose a customer</option>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ""}</option>)}</select></label>{!customers.length && <p className="ops-form-help">Add your first customer first.</p>}<Field label="What needs doing?" name="title" placeholder="e.g. AC isn’t cooling" required /><Field label="Job address" name="address" placeholder="e.g. Lekki Phase 1" /><Field label="Assign to" name="assignee_name" placeholder="e.g. Ibrahim A." /><div className="ops-form-row"><Field label="Quoted price" name="quote_amount" type="number" placeholder="40000" /><Field label="Deposit received" name="amount_paid" type="number" placeholder="0" /></div><label>Notes<textarea name="description" placeholder="What the customer said, photos received, or next steps." rows={3} /></label><button className="ops-primary" disabled={saving || !customers.length}>{saving ? "Saving…" : "Create job"}<ArrowRight size={17} /></button></form></Modal>}
    {showCustomerForm && <Modal title="Add a customer" onClose={() => setShowCustomerForm(false)}><form className="ops-form ops-form-compact" onSubmit={createCustomer}><Field label="Customer name" name="name" placeholder="e.g. Emeka N." required /><Field label="Phone number" name="phone" placeholder="e.g. 0801 000 0000" /><Field label="Address" name="address" placeholder="e.g. Lekki Phase 1" /><button className="ops-primary" disabled={saving}>{saving ? "Saving…" : "Save customer"}<Check size={17} /></button></form></Modal>}
  </main>;
}
function Field({ label, name, placeholder, required, type = "text" }: { label: string; name: string; placeholder: string; required?: boolean; type?: string }) { return <label>{label}<input name={name} type={type} placeholder={placeholder} required={required} min={type === "number" ? "0" : undefined} /></label>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="ops-modal-backdrop" role="presentation"><section className="ops-modal" role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button aria-label="Close" onClick={onClose}><X size={19} /></button></header>{children}</section></div>; }
function JobCard({ job, onAdvance, disabled }: { job: Job; onAdvance: (job: Job) => void; disabled: boolean }) { const next = nextStatus[job.status]; return <article className="ops-job-card"><div className="ops-job-icon"><Wrench size={15} /></div><h3>{job.title}</h3><p>{job.customer_name}</p>{job.assignee_name && <span className="ops-assignee">{job.assignee_name}</span>}{job.quote_amount && <div className="ops-job-money"><span>{naira(job.quote_amount)}</span><small className={job.payment_status}>{job.payment_status === "paid" ? "Paid" : `${naira(job.balance_due)} due`}</small></div>}{next && <button onClick={() => onAdvance(job)} disabled={disabled}>{statusCopy[job.status]} <ChevronRight size={14} /></button>}</article>; }

"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, MapPin } from "lucide-react";
import { api, getToken } from "@/lib/api";
import { categories, Category, naira, Task } from "@/lib/types";
import { VerificationGate } from "@/components/trust";

type Draft = { title: string; description: string; category: Category; city: string; state: string; neighborhood: string; scheduled_for: string; reward_amount: string; reward_note: string };
const emptyDraft: Draft = { title: "", description: "", category: "other", city: "", state: "", neighborhood: "", scheduled_for: "", reward_amount: "", reward_note: "" };
export default function NewTaskPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitLock = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setDraft((previous) => ({ ...previous, description: query.get("description") || "", category: categories.some((item) => item.value === query.get("category")) ? query.get("category") as Category || "other" : "other", city: localStorage.getItem("neba_city") || "" }));
    if (!getToken()) router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }, [router]);
  const update = (key: keyof Draft, value: string) => setDraft((previous) => ({ ...previous, [key]: value }));
  function changeStep(next: number) { setStep(next); setError(""); requestAnimationFrame(() => heading.current?.focus()); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 2) { changeStep(step + 1); return; }
    if (submitLock.current) return;
    submitLock.current = true; setBusy(true); setError("");
    try {
      const data = { ...draft, title: draft.title.trim(), description: draft.description.trim(), city: draft.city.trim(), state: draft.state.trim(), scheduled_for: draft.scheduled_for ? new Date(draft.scheduled_for).toISOString() : undefined };
      const task = await api<Task>("/tasks/", { method: "POST", body: JSON.stringify(data) });
      router.push(`/tasks/${task.id}?posted=1`);
    } catch (error) { setError((error as Error).message); setBusy(false); submitLock.current = false; }
  }
  return <main className="form-page"><div className="form-shell wide"><div className="step-progress" aria-label={`Step ${step + 1} of 3`}>{["Your task", "The details", "Review"].map((label, index) => <span key={label} className={step === index ? "active" : ""} aria-current={step === index ? "step" : undefined}><b>{step > index ? <Check size={12} /> : index + 1}</b>{label}{index < 2 && <i />}</span>)}</div><span className="eyebrow">A LITTLE HELP STARTS HERE</span><h1 ref={heading} tabIndex={-1}>{step === 0 ? <>What do you need <em>done?</em></> : step === 1 ? <>Make it easy to <em>say yes.</em></> : <>Looking <em>good?</em></>}</h1><p>{step === 0 ? "Tell your neighbors what you need. Big or small." : step === 1 ? "Add the where, when, and a reward for their time." : "Check the details before sharing with your community."}</p>
    <VerificationGate /><form className="stack-form" onSubmit={submit}>
      {step === 0 && <><label>Describe what you need<textarea name="description" required minLength={10} rows={5} maxLength={5000} value={draft.description} onChange={(event) => update("description", event.target.value)} placeholder="e.g. I need a hand moving a fridge upstairs tomorrow. It will take about 30 minutes." /></label><label>Give your task a short title<input name="title" required maxLength={140} value={draft.title} onChange={(event) => update("title", event.target.value)} placeholder="e.g. Help move a fridge upstairs" /></label><label>What kind of help?<select name="category" value={draft.category} onChange={(event) => update("category", event.target.value)}>{categories.filter((item) => item.value).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></>}
      {step === 1 && <><div className="form-row"><label>City<input name="city" required maxLength={120} value={draft.city} onChange={(event) => update("city", event.target.value)} placeholder="e.g. Benin City" /></label><label>State<input name="state" required maxLength={120} value={draft.state} onChange={(event) => update("state", event.target.value)} placeholder="e.g. Edo" /></label></div><div className="form-row"><label>Neighborhood (optional)<input name="neighborhood" maxLength={120} value={draft.neighborhood} onChange={(event) => update("neighborhood", event.target.value)} placeholder="e.g. GRA" /></label><label>When? (optional)<input name="scheduled_for" type="datetime-local" value={draft.scheduled_for} onChange={(event) => update("scheduled_for", event.target.value)} /></label></div><p className="form-note"><MapPin size={13} /> Only your city and neighborhood are public. Share an exact address after choosing a helper.</p><div className="reward-choice"><span>₦</span><div>Reward their time<small>Agree on payment directly with your helper.</small></div></div><label>Cash reward (₦)<input name="reward_amount" type="number" min="1" max="99999999.99" step="0.01" required value={draft.reward_amount} onChange={(event) => update("reward_amount", event.target.value)} placeholder="e.g. 4000" /></label><label>Anything extra? (optional)<input name="reward_note" maxLength={160} value={draft.reward_note} onChange={(event) => update("reward_note", event.target.value)} placeholder="e.g. Lunch and transport fare included" /></label></>}
      {step === 2 && <div className="review-block"><span className="category-pill">{categories.find((item) => item.value === draft.category)?.label}</span><h2 style={{ marginTop: 24 }}>{draft.title}</h2><p>{draft.description}</p><dl className="review-list"><div><dt>Where</dt><dd>{[draft.neighborhood, draft.city, draft.state].filter(Boolean).join(", ")}</dd></div><div><dt>When</dt><dd>{draft.scheduled_for ? new Date(draft.scheduled_for).toLocaleString("en-NG") : "Flexible timing"}</dd></div><div><dt>Reward</dt><dd>{naira(draft.reward_amount)}</dd></div>{draft.reward_note && <div><dt>Also included</dt><dd>{draft.reward_note}</dd></div>}</dl></div>}
      {error && <p className="error-box" role="alert">{error}</p>}
      <div className="form-actions">{step > 0 && <button type="button" className="button button-outline" disabled={busy} onClick={() => changeStep(step - 1)}><ArrowLeft size={17} />Back</button>}<button type="submit" className="button button-dark" disabled={busy}>{busy ? "Sharing your task…" : step < 2 ? "Continue" : "Post my task"}{!busy && <ArrowRight size={17} />}</button></div>
    </form></div></main>;
}

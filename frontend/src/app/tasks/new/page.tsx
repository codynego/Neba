"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, MapPin, PackageCheck, ShieldCheck } from "lucide-react";
import { api, getToken } from "@/lib/api";
import { categories, Category, itemTypeLabels, ItemType, rewardLabel, rewardTypeLabels, RewardType, Task } from "@/lib/types";
import { VerificationGate } from "@/components/trust";
import { ListingPhotoPicker, uploadListingPhotos } from "@/components/listing-photos";

type Draft = {
  title: string;
  description: string;
  category: Category;
  city: string;
  state: string;
  neighborhood: string;
  scheduled_for: string;
  is_recurring: boolean;
  helpers_needed: number;
  reward_type: RewardType;
  reward_amount: string;
  reward_note: string;
  involves_item: boolean;
  item_type: ItemType | "";
  item_value: string;
  item_already_paid: boolean;
  policy_confirmed: boolean;
};

const emptyDraft: Draft = {
  title: "", description: "", category: "other", city: "", state: "", neighborhood: "",
  scheduled_for: "", is_recurring: false, helpers_needed: 1, reward_type: "money", reward_amount: "", reward_note: "", involves_item: false,
  item_type: "", item_value: "", item_already_paid: false, policy_confirmed: false,
};

export default function NewTaskPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const submitLock = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setDraft((previous) => ({
      ...previous,
      description: query.get("description") || "",
      category: categories.some((item) => item.value === query.get("category")) ? query.get("category") as Category || "other" : "other",
      city: localStorage.getItem("neba_city") || "",
    }));
    if (!getToken()) router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }, [router]);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((previous) => ({ ...previous, [key]: value }));
  function changeStep(next: number) { setStep(next); setError(""); requestAnimationFrame(() => heading.current?.focus()); }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 2) { changeStep(step + 1); return; }
    if (submitLock.current) return;
    submitLock.current = true; setBusy(true); setError("");
    try {
      const photoKeys = await uploadListingPhotos("tasks", photos);
      const data = {
        ...draft,
        photos: photoKeys,
        title: draft.title.trim(),
        description: draft.description.trim(),
        city: draft.city.trim(),
        state: draft.state.trim(),
        reward_amount: draft.reward_amount || null,
        scheduled_for: draft.scheduled_for ? new Date(draft.scheduled_for).toISOString() : null,
        item_type: draft.involves_item ? draft.item_type : "",
        item_value: draft.involves_item ? draft.item_value : null,
        item_already_paid: draft.involves_item && draft.item_already_paid,
      };
      const task = await api<Task>("/tasks/", { method: "POST", body: JSON.stringify(data) });
      router.push(`/tasks/${task.public_id || task.id}?posted=1`);
    } catch (error) {
      setError((error as Error).message);
      setBusy(false);
      submitLock.current = false;
    }
  }

  return <main className="form-page"><div className="form-shell wide">
    <div className="step-progress" aria-label={`Step ${step + 1} of 3`}>{["Your task", "The details", "Review"].map((label, index) => <span key={label} className={step === index ? "active" : ""} aria-current={step === index ? "step" : undefined}><b>{step > index ? <Check size={12} /> : index + 1}</b>{label}{index < 2 && <i />}</span>)}</div>
    <span className="eyebrow">A LITTLE HELP STARTS HERE</span>
    <h1 ref={heading} tabIndex={-1}>{step === 0 ? <>What do you need <em>done?</em></> : step === 1 ? <>Make it easy to <em>say yes.</em></> : <>Looking <em>good?</em></>}</h1>
    <p>{step === 0 ? "Tell your neighbors what you need. Big or small." : step === 1 ? "Add the where, when, and a reward for their time." : "Check the details and task policy before sharing."}</p>
    <VerificationGate />
    <form className="stack-form" onSubmit={submit}>
      {step === 0 && <>
        <label>Describe what you need<textarea name="description" required minLength={10} rows={5} maxLength={5000} value={draft.description} onChange={(event) => update("description", event.target.value)} placeholder="e.g. I need a hand moving a fridge upstairs tomorrow. It will take about 30 minutes." /></label>
        <label>Give your task a short title<input name="title" required maxLength={140} value={draft.title} onChange={(event) => update("title", event.target.value)} placeholder="e.g. Help move a fridge upstairs" /></label>
        <ListingPhotoPicker files={photos} onChange={setPhotos} label="Show what needs doing" />
        <label>What kind of help?<select name="category" value={draft.category} onChange={(event) => update("category", event.target.value as Category)}>{categories.filter((item) => item.value).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <fieldset className="item-policy-card"><legend>Does someone need to collect, carry, or deliver an item?</legend>
          <label className="choice-row"><input type="radio" name="involves_item" checked={!draft.involves_item} onChange={() => update("involves_item", false)} /><span><strong>No</strong><small>This is help, tutoring, setup, or another service.</small></span></label>
          <label className="choice-row"><input type="radio" name="involves_item" checked={draft.involves_item} onChange={() => update("involves_item", true)} /><span><strong>Yes</strong><small>A person will take temporary custody of an item.</small></span></label>
        </fieldset>
        {draft.involves_item && <div className="item-details-panel">
          <div className="item-details-heading"><PackageCheck size={19} /><div><strong>Tell us about the item</strong><p>For now, NEBA supports already-paid items worth up to ₦50,000.</p></div></div>
          <label>Item type<select required value={draft.item_type} onChange={(event) => update("item_type", event.target.value as ItemType)}><option value="">Choose an item type</option>{Object.entries(itemTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Estimated item value (₦)<input type="number" required min="1" max="50000" step="0.01" value={draft.item_value} onChange={(event) => update("item_value", event.target.value)} placeholder="e.g. 15000" /></label>
          <label className="check-label"><input type="checkbox" required checked={draft.item_already_paid} onChange={(event) => update("item_already_paid", event.target.checked)} />The item is already paid for. The helper will not use their own money.</label>
          <p className="policy-warning">Cash collection, financial transactions, high-value goods, and prohibited items are not supported.</p>
        </div>}
      </>}
      {step === 1 && <>
        <div className="form-row"><label>City<input name="city" required maxLength={120} value={draft.city} onChange={(event) => update("city", event.target.value)} placeholder="e.g. Benin City" /></label><label>State<input name="state" required maxLength={120} value={draft.state} onChange={(event) => update("state", event.target.value)} placeholder="e.g. Edo" /></label></div>
        <div className="form-row"><label>Neighborhood (optional)<input name="neighborhood" maxLength={120} value={draft.neighborhood} onChange={(event) => update("neighborhood", event.target.value)} placeholder="e.g. GRA" /></label><label>When? (optional)<input name="scheduled_for" type="datetime-local" value={draft.scheduled_for} onChange={(event) => update("scheduled_for", event.target.value)} /></label></div>
        <div className="task-capacity-note"><strong>One helper per task</strong><p>For now, each task is a one-time booking with one helper. You can post another task when you need help again.</p></div>
        <p className="form-note"><MapPin size={13} /> Only your city and neighborhood are public. Share an exact task address after choosing a helper.</p>
        <div className="reward-choice"><span>↔</span><div>What will you give in return?<small>NEBA supports any clear, lawful exchange of value.</small></div></div>
        <label>Reward type<select name="reward_type" value={draft.reward_type} onChange={(event) => update("reward_type", event.target.value as RewardType)}>{Object.entries(rewardTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {(draft.reward_type === "money" || draft.reward_type === "combination") && <label>Money amount (₦){draft.reward_type === "combination" && <small className="label-hint">Optional</small>}<input name="reward_amount" type="number" min="1" max="99999999.99" step="0.01" required={draft.reward_type === "money"} value={draft.reward_amount} onChange={(event) => update("reward_amount", event.target.value)} placeholder="e.g. 4000" /></label>}
        <label>Describe the reward{draft.reward_type === "money" && <small className="label-hint">Optional</small>}<input name="reward_note" maxLength={160} required={draft.reward_type !== "money"} value={draft.reward_note} onChange={(event) => update("reward_note", event.target.value)} placeholder={draft.reward_type === "money" ? "e.g. Transport fare included" : draft.reward_type === "food" ? "e.g. Pizza and a drink" : draft.reward_type === "skill" ? "e.g. A 1-hour coding lesson" : draft.reward_type === "combination" ? "e.g. Lunch and transport" : "Be specific about what you will give"} /></label>
      </>}
      {step === 2 && <>
        <div className="review-block"><span className="category-pill">{categories.find((item) => item.value === draft.category)?.label}</span><h2 style={{ marginTop: 24 }}>{draft.title}</h2><p>{draft.description}</p><dl className="review-list"><div><dt>Where</dt><dd>{[draft.neighborhood, draft.city, draft.state].filter(Boolean).join(", ")}</dd></div><div><dt>When</dt><dd>{draft.scheduled_for ? new Date(draft.scheduled_for).toLocaleString("en-NG") : "Flexible timing"}</dd></div><div><dt>Helper</dt><dd>1 helper · one-time task</dd></div><div><dt>Reward</dt><dd>{rewardLabel({ reward_type: draft.reward_type, reward_amount: draft.reward_amount || null, reward_note: draft.reward_note })}</dd></div>{draft.involves_item && <div><dt>Item</dt><dd>{itemTypeLabels[draft.item_type as ItemType]} · {draft.item_value ? `₦${Number(draft.item_value).toLocaleString("en-NG")}` : "Value not supplied"} · already paid</dd></div>}</dl></div>
        <label className="policy-confirmation"><input type="checkbox" required checked={draft.policy_confirmed} onChange={(event) => update("policy_confirmed", event.target.checked)} /><ShieldCheck size={19} /><span><strong>This task follows NEBA’s task policy.</strong><small>It does not involve cash collection, financial-account access, illegal or dangerous goods, high-value property, or another prohibited service.</small></span></label>
      </>}
      {error && <p className="error-box" role="alert">{error}</p>}
      <div className="form-actions">{step > 0 && <button type="button" className="button button-outline" disabled={busy} onClick={() => changeStep(step - 1)}><ArrowLeft size={17} />Back</button>}<button type="submit" className="button button-dark" disabled={busy}>{busy ? "Checking your task…" : step < 2 ? "Continue" : "Post my task"}{!busy && <ArrowRight size={17} />}</button></div>
    </form>
  </div></main>;
}

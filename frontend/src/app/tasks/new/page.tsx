"use client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getToken } from "@/lib/api";
import { categories, Task } from "@/lib/types";
export default function NewTaskPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!getToken()) router.replace("/login?next=/tasks/new"); }, [router]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (!data.scheduled_for) delete data.scheduled_for;
    try { const task = await api<Task>("/tasks/", { method: "POST", body: JSON.stringify(data) }); router.push(`/tasks/${task.id}`); }
    catch (error) { setError((error as Error).message); setBusy(false); }
  }
  return <main className="form-page"><div className="form-shell wide"><span className="eyebrow">POST A NEED</span><h1>What do you need <em>done?</em></h1><p>Good details help the right person say yes.</p><form className="stack-form" onSubmit={submit}><label>Task title<input name="title" required maxLength={140} placeholder="e.g. Help move a sofa upstairs" /></label><label>Describe the task<textarea name="description" required rows={5} placeholder="What needs doing? What should the helper bring or know?" /></label><div className="form-row"><label>Category<select name="category" required>{categories.filter((item) => item.value).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>Reward (₦)<input name="reward_amount" type="number" min="1" step="0.01" required placeholder="5000" /></label></div><div className="form-row"><label>City<input name="city" required placeholder="e.g. Abuja" /></label><label>State<input name="state" required placeholder="e.g. FCT" /></label></div><div className="form-row"><label>Neighborhood (optional)<input name="neighborhood" placeholder="e.g. Wuse 2" /></label><label>When (optional)<input name="scheduled_for" type="datetime-local" /></label></div><label>Reward note (optional)<input name="reward_note" maxLength={160} placeholder="e.g. Transport fare included" /></label><p className="form-note">Your city and neighborhood are public. Share an exact address only after you choose someone.</p>{error && <p className="error-box">{error}</p>}<button className="button button-dark full-width" disabled={busy}>{busy ? "Posting..." : "Post task ↗"}</button></form></div></main>;
}

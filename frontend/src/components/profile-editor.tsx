"use client";
import { FormEvent, useState } from "react";
import { api } from "@/lib/api";
import { User, categories, availabilityLabels } from "@/lib/types";
export function ProfileEditor({ user, onSaved }: { user: User; onSaved: (user: User) => void }) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setFeedback(""); const data = new FormData(event.currentTarget);
    try { const updated = await api<User>("/auth/me/", { method: "PATCH", body: JSON.stringify({ ...Object.fromEntries(data), skills: data.getAll("skills") }) }); onSaved(updated); setFeedback("Profile saved. Your neighbors can see your updated skills and availability."); } catch (err) { setFeedback((err as Error).message); } finally { setBusy(false); }
  }
  return <details className="profile-editor"><summary>Edit your profile & availability</summary><form className="stack-form" onSubmit={save}><label>Display name<input name="display_name" defaultValue={user.display_name} required maxLength={80} /></label><label>About you<textarea name="bio" defaultValue={user.bio} maxLength={600} rows={4} placeholder="Tell neighbors what you can help with and your experience." /></label><div className="form-row"><label>City<input name="city" defaultValue={user.city} maxLength={120} /></label><label>State<input name="state" defaultValue={user.state} maxLength={120} /></label></div><label>Neighborhood<input name="neighborhood" defaultValue={user.neighborhood} maxLength={120} placeholder="Your neighborhood, not your exact address" /></label><label>Availability<select name="availability" defaultValue={user.availability}>{Object.entries(availabilityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><fieldset className="skill-checkboxes"><legend>Your skills</legend>{categories.filter((category) => category.value).map((category) => <label className="check-label" key={category.value}><input type="checkbox" name="skills" value={category.value} defaultChecked={user.skills?.includes(category.value as User["skills"][number])} />{category.label}</label>)}</fieldset><p className="form-note">“Not taking work” pauses new applications and direct requests. Existing bookings remain yours to manage.</p><button className="button button-dark compact" disabled={busy}>{busy ? "Saving..." : "Save profile"}</button>{feedback && <p role="status">{feedback}</p>}</form></details>;
}

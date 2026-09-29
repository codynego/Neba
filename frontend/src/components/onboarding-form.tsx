"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { ArrowRight, Camera, CheckCircle2, LocateFixed, MapPin, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { User } from "@/lib/types";

type UploadTicket = { upload_url: string; key: string; content_type: string };
type Intent = "need-help" | "can-help" | "explore";

export function OnboardingForm({ initialUser, nextPath }: { initialUser: User; nextPath?: string }) {
  const [user, setUser] = useState(initialUser);
  const [step, setStep] = useState<1 | 2>(initialUser.profile_complete ? 2 : 1);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [intent, setIntent] = useState<Intent>("need-help");
  const [coordinates, setCoordinates] = useState({ latitude: initialUser.latitude || "", longitude: initialUser.longitude || "" });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (!photo) { setPreview(""); return; }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] || null;
    if (next && (!["image/jpeg", "image/png", "image/webp"].includes(next.type) || next.size > 5 * 1024 * 1024)) {
      event.target.value = "";
      setPhoto(null);
      setFeedback("Choose a JPEG, PNG, or WebP photo under 5 MB.");
      return;
    }
    setFeedback("");
    setPhoto(next);
  }

  function useCurrentLocation() {
    setFeedback("");
    if (!navigator.geolocation) { setFeedback("Location access is not supported by this browser. You can enter your area manually."); return; }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setCoordinates({ latitude: coords.latitude.toFixed(6), longitude: coords.longitude.toFixed(6) }),
      () => setFeedback("Location access was not available. You can enter your area manually."),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback("");
    const data = new FormData(event.currentTarget);
    data.delete("profile_photo");
    try {
      let updated = await api<User>("/auth/me/", { method: "PATCH", body: JSON.stringify({ ...Object.fromEntries(data), latitude: coordinates.latitude || null, longitude: coordinates.longitude || null }) });
      if (photo) {
        const ticket = await api<UploadTicket>("/auth/profile-photo/upload/", { method: "POST", body: JSON.stringify({ content_type: photo.type, size: photo.size }) });
        const upload = await fetch(ticket.upload_url, { method: "PUT", headers: { "Content-Type": ticket.content_type }, body: photo });
        if (!upload.ok) throw new Error("The photo upload did not finish. Check your R2 CORS settings and try again.");
        updated = await api<User>("/auth/profile-photo/confirm/", { method: "POST", body: JSON.stringify({ key: ticket.key }) });
      }
      setUser(updated);
      if (!updated.profile_complete) throw new Error("Add a photo, phone number, address, city, state, and neighborhood to continue.");
      setStep(2);
    } catch (error) {
      setFeedback((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function finish() {
    const target = nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : intent === "can-help" ? "/offers/new" : intent === "explore" ? "/tasks" : "/tasks/new";
    window.location.assign(target);
  }

  return <main className="onboarding-page container">
    <div className="onboarding-rail"><span className="eyebrow">WELCOME TO GETNEBA</span><div className="onboarding-progress"><span className="active" /><span className={step === 2 ? "active" : ""} /></div><small>Step {step} of 2</small></div>
    {step === 1 ? <section className="onboarding-card">
      <div className="onboarding-heading"><span className="onboarding-mark"><MapPin size={20} /></span><div><h1>Let’s place you in the neighborhood.</h1><p>A clear photo and a useful location help people know who they’re connecting with. Your exact address stays private.</p></div></div>
      <form className="stack-form" onSubmit={saveProfile}>
        <label className="profile-photo-field">Profile picture <span className="photo-upload-row"><span className="photo-preview">{preview ? <img src={preview} alt="Selected profile preview" /> : user.photo_available ? <CheckCircle2 size={24} /> : <Camera size={24} />}</span><span><input name="profile_photo" type="file" accept="image/jpeg,image/png,image/webp" required={!user.photo_available} onChange={choosePhoto} /><small>Use a clear photo of yourself. JPEG, PNG, or WebP under 5 MB.</small></span></span></label>
        <div className="form-row"><label>Phone number<input name="phone" type="tel" autoComplete="tel" defaultValue={user.phone || ""} required placeholder="0801 234 5678" /></label><label>Display name<input name="display_name" defaultValue={user.display_name} required maxLength={80} /></label></div>
        <label>Address or nearby landmark<input name="address" autoComplete="street-address" defaultValue={user.address || ""} required maxLength={240} placeholder="Street, estate, or nearby landmark" /><small>This is private. Other members see only your area, city, and state.</small></label>
        <div className="form-row"><label>City<input name="city" defaultValue={user.city || ""} required maxLength={120} placeholder="e.g. Abuja" /></label><label>State<input name="state" defaultValue={user.state || ""} required maxLength={120} placeholder="e.g. FCT" /></label></div>
        <label>Area / neighborhood<input name="neighborhood" defaultValue={user.neighborhood || ""} required maxLength={120} placeholder="e.g. Garki, Lekki, or GRA" /></label>
        <button className="location-capture" type="button" onClick={useCurrentLocation}><LocateFixed size={16} />Use my current location <small>(optional)</small></button>
        {coordinates.latitude && <p className="coordinate-note">Private map coordinates added.</p>}
        {feedback && <p className="error-box" role="alert">{feedback}</p>}
        <button className="button button-dark" disabled={busy}>{busy ? "Saving your profile…" : "Continue"}<ArrowRight size={17} /></button>
      </form>
    </section> : <section className="onboarding-card onboarding-finish">
      <span className="onboarding-success"><CheckCircle2 size={28} /></span><span className="eyebrow">YOU’RE READY</span><h1>Where should we take you first?</h1><p>Your profile is complete. You can ask for help, offer a skill, or look around first.</p>
      <div className="intent-grid">
        <label className={intent === "need-help" ? "selected" : ""}><input type="radio" name="intent" value="need-help" checked={intent === "need-help"} onChange={() => setIntent("need-help")} /><strong>I need help</strong><small>Post a task for your neighborhood.</small></label>
        <label className={intent === "can-help" ? "selected" : ""}><input type="radio" name="intent" value="can-help" checked={intent === "can-help"} onChange={() => setIntent("can-help")} /><strong>I can help</strong><small>Share a skill people can book.</small></label>
        <label className={intent === "explore" ? "selected" : ""}><input type="radio" name="intent" value="explore" checked={intent === "explore"} onChange={() => setIntent("explore")} /><strong>Let me look around</strong><small>See tasks and helpers nearby.</small></label>
      </div>
      <p className="onboarding-privacy"><ShieldCheck size={15} />You can change your profile and availability anytime.</p><button className="button button-dark" onClick={finish}>Continue to GetNeba<ArrowRight size={17} /></button>
    </section>}
  </main>;
}

"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { Camera, CheckCircle2, LocateFixed, MapPin, Phone } from "lucide-react";
import { api } from "@/lib/api";
import { User, categories, availabilityLabels } from "@/lib/types";
import { compressImage } from "@/lib/image-compression";

type UploadTicket = { upload_url: string; key: string; content_type: string };

export function ProfileEditor({ user, onSaved }: { user: User; onSaved: (user: User) => void }) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [preview, setPreview] = useState("");
  const [coordinates, setCoordinates] = useState({ latitude: user.latitude || "", longitude: user.longitude || "" });

  useEffect(() => {
    if (!photo) { setPreview(""); return; }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    setFeedback("");
    if (!file) {
      setPhoto(null);
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      event.target.value = "";
      setPhoto(null);
      setFeedback("Choose a JPEG, PNG, or WebP photo.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      event.target.value = "";
      setPhoto(null);
      setFeedback("Choose a photo under 20 MB.");
      return;
    }
    setCompressing(true);
    try {
      const compressed = await compressImage(file);
      setPhoto(compressed);
    } catch (error) {
      event.target.value = "";
      setPhoto(null);
      setFeedback((error as Error).message || "Could not process this photo.");
    } finally {
      setCompressing(false);
    }
  }

  function useCurrentLocation() {
    setFeedback("");
    if (!navigator.geolocation) { setFeedback("Location access is not supported by this browser."); return; }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setCoordinates({ latitude: coords.latitude.toFixed(6), longitude: coords.longitude.toFixed(6) });
        setFeedback("Location added. Confirm your area, city, and state before saving.");
      },
      () => setFeedback("Location access was not available. You can enter your area manually."),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback("");
    const data = new FormData(event.currentTarget);
    data.delete("profile_photo");
    try {
      let updated = await api<User>("/auth/me/", {
        method: "PATCH",
        body: JSON.stringify({
          ...Object.fromEntries(data),
          skills: data.getAll("skills"),
          latitude: coordinates.latitude || null,
          longitude: coordinates.longitude || null,
        }),
      });
      if (photo) {
        const fileToUpload = photo.size > 2 * 1024 * 1024 ? await compressImage(photo) : photo;
        const ticket = await api<UploadTicket>("/auth/profile-photo/upload/", {
          method: "POST",
          body: JSON.stringify({ content_type: fileToUpload.type, size: fileToUpload.size }),
        });
        const upload = await fetch(ticket.upload_url, { method: "PUT", headers: { "Content-Type": ticket.content_type }, body: fileToUpload });
        if (!upload.ok) throw new Error("The photo upload did not finish. Check your R2 CORS settings and try again.");
        updated = await api<User>("/auth/profile-photo/confirm/", { method: "POST", body: JSON.stringify({ key: ticket.key }) });
        setPhoto(null);
      }
      onSaved(updated);
      setFeedback(updated.profile_complete ? "Profile complete. You can now post, apply, and offer help." : "Saved. Add the remaining profile details to continue.");
    } catch (error) {
      setFeedback((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return <details className="profile-editor profile-completion" open={!user.profile_complete}>
    <summary>{user.profile_complete ? "Edit your profile & availability" : "Complete your profile"}</summary>
    <div className="profile-requirements" aria-label="Profile requirements">
      <span className={user.photo_available ? "done" : ""}><Camera size={15} />Photo{user.photo_available && <CheckCircle2 size={13} />}</span>
      <span className={user.phone ? "done" : ""}><Phone size={15} />Phone{user.phone && <CheckCircle2 size={13} />}</span>
      <span className={user.address && user.neighborhood && user.city && user.state ? "done" : ""}><MapPin size={15} />Location{user.address && user.neighborhood && user.city && user.state && <CheckCircle2 size={13} />}</span>
    </div>
    <form className="stack-form" onSubmit={save}>
      <label className="profile-photo-field">Profile picture
        <span className="photo-upload-row">
          <span className="photo-preview">{compressing ? <small style={{ fontSize: "10px", textAlign: "center", lineHeight: "1.2" }}>Optimizing…</small> : preview ? <img src={preview} alt="Selected profile preview" /> : <Camera size={24} />}</span>
          <span><input name="profile_photo" type="file" accept="image/jpeg,image/png,image/webp" required={!user.photo_available} onChange={choosePhoto} disabled={busy || compressing} /><small>Use a clear photo of yourself. JPEG, PNG, or WebP under 20 MB (compressed automatically).</small></span>
        </span>
      </label>
      <label>Display name<input name="display_name" defaultValue={user.display_name} required maxLength={80} /></label>
      <label>Phone number<input name="phone" type="tel" autoComplete="tel" defaultValue={user.phone || ""} required placeholder="0801 234 5678" /></label>
      <label>Address or nearby landmark<input name="address" autoComplete="street-address" defaultValue={user.address || ""} required maxLength={240} placeholder="Street, estate, or a nearby landmark" /><small>This stays private. Other members see only your area, city, and state.</small></label>
      <div className="form-row"><label>City<input name="city" defaultValue={user.city} required maxLength={120} /></label><label>State<input name="state" defaultValue={user.state} required maxLength={120} /></label></div>
      <label>Area / neighborhood<input name="neighborhood" defaultValue={user.neighborhood} required maxLength={120} placeholder="e.g. GRA, Lekki, Wuse 2" /></label>
      <button className="location-capture" type="button" onClick={useCurrentLocation}><LocateFixed size={16} />Use my current location</button>
      {(coordinates.latitude && coordinates.longitude) && <p className="coordinate-note">Location coordinates added privately.</p>}
      <label>About you<textarea name="bio" defaultValue={user.bio} maxLength={600} rows={4} placeholder="Tell neighbors what you can help with and your experience." /></label>
      <label>Availability<select name="availability" defaultValue={user.availability}>{Object.entries(availabilityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <fieldset className="skill-checkboxes"><legend>Your skills</legend>{categories.filter((category) => category.value).map((category) => <label className="check-label" key={category.value}><input type="checkbox" name="skills" value={category.value} defaultChecked={user.skills?.includes(category.value as User["skills"][number])} />{category.label}</label>)}</fieldset>
      <p className="form-note">“Not taking work” pauses new applications and direct requests. Existing bookings remain yours to manage.</p>
      <button className="button button-dark compact" disabled={busy || compressing}>{compressing ? "Optimizing photo…" : busy ? "Saving profile…" : "Save profile"}</button>
      {feedback && <p role="status" className="profile-feedback">{feedback}</p>}
    </form>
  </details>;
}

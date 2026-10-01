"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import { api } from "@/lib/api";
import { compressImage } from "@/lib/image-compression";

type ListingKind = "tasks" | "offers";
type UploadTicket = { upload_url: string; key: string };

export function ListingPhotoPicker({ files, onChange, label = "Add helpful photos" }: { files: File[]; onChange: (files: File[]) => void; label?: string }) {
  const [previews, setPreviews] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";
    if (!selected.length) return;
    if (files.length + selected.length > 4) { setError("Choose up to 4 photos."); return; }
    setProcessing(true); setError("");
    try {
      const prepared: File[] = [];
      for (const file of selected) prepared.push(await compressImage(file));
      onChange([...files, ...prepared]);
    } catch (err) { setError((err as Error).message); }
    finally { setProcessing(false); }
  }

  return <section className="listing-photo-picker">
    <div className="listing-photo-heading"><span><Camera size={18} /></span><div><strong>{label}</strong><small>Optional · Show the work clearly without sharing private details.</small></div></div>
    {files.length < 4 && <label className="listing-photo-add"><ImagePlus size={21} /><span>{processing ? "Preparing photos…" : files.length ? "Add another photo" : "Choose up to 4 photos"}</span><input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={choose} disabled={processing} /></label>}
    {!!previews.length && <div className="selected-photo-grid">{previews.map((url, index) => <figure key={url}><img src={url} alt={`Selected photo ${index + 1}`} /><button type="button" onClick={() => onChange(files.filter((_, item) => item !== index))} aria-label={`Remove photo ${index + 1}`}><X size={15} /></button></figure>)}</div>}
    {error && <p className="photo-error" role="alert">{error}</p>}
  </section>;
}

export async function uploadListingPhotos(kind: ListingKind, files: File[]) {
  const keys: string[] = [];
  for (const original of files) {
    // Keep compression at the upload boundary as well as the picker so a future
    // caller cannot accidentally send a full-size task or offer image.
    const file = await compressImage(original);
    const ticket = await api<UploadTicket>(`/${kind}/photo-upload/`, { method: "POST", body: JSON.stringify({ content_type: file.type, size: file.size }) });
    const response = await fetch(ticket.upload_url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
    if (!response.ok) throw new Error("A photo did not finish uploading. Check your connection and try again.");
    keys.push(ticket.key);
  }
  return keys;
}

export function ListingPhotoGallery({ kind, id, count, compact = false, title }: { kind: ListingKind; id: string | number; count?: number; compact?: boolean; title: string }) {
  const [urls, setUrls] = useState<string[]>([]);
  const total = Math.min(count || 0, compact ? 1 : 4);
  useEffect(() => {
    let active = true;
    if (!total) { setUrls([]); return; }
    Promise.all(Array.from({ length: total }, (_, index) => api<{ url: string }>(`/${kind}/${id}/photos/${index}/`).then((item) => item.url).catch(() => "")))
      .then((items) => { if (active) setUrls(items.filter(Boolean)); });
    return () => { active = false; };
  }, [kind, id, total]);
  if (!total) return null;
  return <div className={`listing-photo-gallery${compact ? " compact" : ""}${urls.length > 1 ? " multiple" : ""}`} aria-label={`Photos for ${title}`}>
    {urls.map((url, index) => <img key={url} src={url} alt={`${title}, photo ${index + 1}`} />)}
  </div>;
}

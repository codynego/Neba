"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Download, FileImage, FileText, LoaderCircle, Paperclip, X } from "lucide-react";
import { api } from "@/lib/api";
import { MessageAttachment } from "@/lib/types";
import { compressImage } from "@/lib/image-compression";
import { ImageLightbox } from "./image-lightbox";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const maxImageInputSize = 20 * 1024 * 1024;
const maxFileSize = 10 * 1024 * 1024;
const maxFiles = 4;

type UploadTicket = MessageAttachment & { upload_url: string };

export function selectMessageFiles(current: File[], incoming: FileList | null) {
  const next = [...current, ...Array.from(incoming || [])].slice(0, maxFiles);
  const invalid = next.find((file) => !allowedTypes.has(file.type) || file.size > (file.type.startsWith("image/") ? maxImageInputSize : maxFileSize));
  if (invalid) throw new Error("Choose JPEG, PNG, or WebP images under 20 MB, or PDF files under 10 MB.");
  return next;
}

export async function uploadMessageFiles(base: string, files: File[], onProgress: (value: string) => void) {
  const uploaded: MessageAttachment[] = [];
  for (let index = 0; index < files.length; index += 1) {
    const original = files[index];
    const isImage = original.type.startsWith("image/");
    onProgress(`${isImage ? "Compressing" : "Preparing"} ${index + 1} of ${files.length}…`);
    const file = isImage ? await compressImage(original) : original;
    onProgress(`Uploading ${index + 1} of ${files.length}…`);
    const ticket = await api<UploadTicket>(`${base}/message-upload/`, {
      method: "POST",
      body: JSON.stringify({ name: file.name, content_type: file.type, size: file.size }),
    });
    const response = await fetch(ticket.upload_url, { method: "PUT", headers: { "Content-Type": ticket.content_type }, body: file });
    if (!response.ok) throw new Error(`Could not upload ${file.name}. Try again.`);
    uploaded.push({ key: ticket.key, name: ticket.name, content_type: ticket.content_type, size: ticket.size });
  }
  return uploaded;
}

export function AttachmentPicker({ files, disabled, progress, onChange, onError }: {
  files: File[]; disabled: boolean; progress: string; onChange: (files: File[]) => void; onError: (message: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  function choose(event: ChangeEvent<HTMLInputElement>) {
    try { onChange(selectMessageFiles(files, event.target.files)); onError(""); }
    catch (error) { onError((error as Error).message); }
    event.target.value = "";
  }
  return <div className="attachment-picker">
    {files.length > 0 && <div className="pending-attachments" aria-label="Files ready to send">{files.map((file, index) => <span key={`${file.name}-${file.lastModified}`}><FileType type={file.type} /><span><strong>{file.name}</strong><small>{formatSize(file.size)}</small></span><button type="button" aria-label={`Remove ${file.name}`} disabled={disabled} onClick={() => onChange(files.filter((_, item) => item !== index))}><X size={14} /></button></span>)}</div>}
    <input ref={input} className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={choose} disabled={disabled || files.length >= maxFiles} />
    <button className="attachment-button" type="button" disabled={disabled || files.length >= maxFiles} onClick={() => input.current?.click()} aria-label="Attach photos or PDF files"><Paperclip size={18} /><span>Attach</span></button>
    {progress && <span className="attachment-progress" role="status"><LoaderCircle size={14} />{progress}</span>}
  </div>;
}

function FileType({ type }: { type: string }) {
  return type.startsWith("image/") ? <FileImage size={18} /> : <FileText size={18} />;
}

function formatSize(size: number) {
  return size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`;
}

function Attachment({ attachment, url }: { attachment: MessageAttachment; url: string }) {
  const [file, setFile] = useState<{ url: string; download_url: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  useEffect(() => {
    let active = true;
    api<{ url: string; download_url: string }>(url).then((data) => { if (active) setFile(data); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [url]);
  if (failed) return <span className="message-file unavailable"><FileType type={attachment.content_type} /><span><strong>{attachment.name}</strong><small>Attachment unavailable</small></span></span>;
  if (!file) return <span className="message-file loading"><LoaderCircle size={18} /><span><strong>{attachment.name}</strong><small>Loading securely…</small></span></span>;
  if (attachment.content_type.startsWith("image/")) {
    const images = [{ url: file.url, downloadUrl: file.download_url, alt: attachment.name, name: attachment.name }];
    return <><div className="message-image"><button type="button" onClick={() => setPreviewing(true)} aria-label={`Preview ${attachment.name}`}><img src={file.url} alt={attachment.name} /></button><span><button type="button" onClick={() => setPreviewing(true)}><FileImage size={14} />Preview</button><a href={file.download_url} download={attachment.name}><Download size={14} />Download</a></span></div>{previewing && <ImageLightbox images={images} activeIndex={0} onChange={() => {}} onClose={() => setPreviewing(false)} />}</>;
  }
  return <a className="message-file" href={file.download_url} download={attachment.name}><FileText size={18} /><span><strong>{attachment.name}</strong><small>{formatSize(attachment.size)}</small></span><Download size={16} /></a>;
}

export function MessageAttachments({ base, messageId, attachments }: { base: string; messageId: number; attachments?: MessageAttachment[] }) {
  if (!attachments?.length) return null;
  return <div className="message-attachments">{attachments.map((attachment, index) => <Attachment key={attachment.key} attachment={attachment} url={`${base}/messages/${messageId}/attachments/${index}/`} />)}</div>;
}

"use client";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, ShieldCheck, LockKeyhole } from "lucide-react";
import { api, getToken } from "@/lib/api";
import { Trust } from "@/lib/types";
import { TrustBadges } from "@/components/trust";

type Status = Trust & { phone: string | null; sms_available: boolean; uploads_available: boolean; retention_days: number; submission: { status: string; review_note: string; id: number } | null };
type Challenge = { id: string; instruction: string; expires_at: string };
export default function VerifyPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [portrait, setPortrait] = useState<Blob | null>(null);
  const [actionPhoto, setActionPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState("");
  const [streaming, setStreaming] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const mounted = useRef(true);
  const load = useCallback(async () => { setStatus(await api<Status>("/auth/verification/")); }, []);
  const stopCamera = useCallback(() => { stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null; setStreaming(false); }, []);
  useEffect(() => {
    mounted.current = true;
    if (!getToken()) { router.replace("/login?next=/verify"); return; }
    load().catch((err) => setError(err.message));
    const hidden = () => { if (document.hidden) stopCamera(); };
    document.addEventListener("visibilitychange", hidden);
    return () => { mounted.current = false; stream.current?.getTracks().forEach((track) => track.stop()); document.removeEventListener("visibilitychange", hidden); };
  }, [router, load, stopCamera]);
  useEffect(() => { if (!portrait) { setPreview(""); return; } const url = URL.createObjectURL(portrait); setPreview(url); return () => URL.revokeObjectURL(url); }, [portrait]);
  async function run(action: () => Promise<void>) { if (busy) return; setBusy(true); setError(""); setNotice(""); try { await action(); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }
  async function startCamera() {
    await run(async () => {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access needs HTTPS or localhost and a supported browser.");
      if (!challenge || new Date(challenge.expires_at).getTime() <= Date.now()) {
        const fresh = await api<Challenge>("/auth/verification/capture/", { method: "POST" });
        setChallenge(fresh); setPortrait(null); setActionPhoto(null);
      }
      stopCamera();
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } }, audio: false });
      if (!mounted.current) { media.getTracks().forEach((track) => track.stop()); return; }
      stream.current = media; setStreaming(true);
      if (video.current) { video.current.srcObject = media; await video.current.play(); }
    });
  }
  function capture() {
    const element = video.current;
    if (!element || element.readyState < 2 || !element.videoWidth) { setError("Wait for the camera picture to appear."); return; }
    const canvas = document.createElement("canvas"); canvas.width = element.videoWidth; canvas.height = element.videoHeight;
    canvas.getContext("2d")?.drawImage(element, 0, 0);
    canvas.toBlob((blob) => { if (!blob || !mounted.current) return; if (!portrait) setPortrait(blob); else { setActionPhoto(blob); stopCamera(); } }, "image/jpeg", 0.88);
  }
  async function submitIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (!portrait || !actionPhoto || !challenge) { setError("Take both camera photos before submitting."); return; }
    data.set("portrait_image", portrait, "portrait.jpg"); data.set("challenge_image", actionPhoto, "challenge.jpg"); data.set("challenge_id", challenge.id);
    data.set("consent", data.has("consent") ? "true" : "false"); data.set("adult_confirmed", data.has("adult_confirmed") ? "true" : "false"); data.set("publish_photo", data.has("publish_photo") ? "true" : "false");
    await run(async () => { await api("/auth/verification/identity/", { method: "POST", body: data }); stopCamera(); setPortrait(null); setActionPhoto(null); setChallenge(null); await load(); setNotice("Your evidence is in the manual review queue. Approval is required before you can offer help."); });
  }
  return <main className="listing-page container"><div className="verification-page"><span className="eyebrow">TRUST STARTS WITH YOU</span><h1>A real person.<br /><em>A safer community.</em></h1><p>Confirm your number to post a task. Helpers also need an ID and camera-photo review before offering or accepting work.</p>{error && <p className="error-box" role="alert">{error}</p>}{notice && <p className="posted-notice" role="status">{notice}</p>}
    {!status ? <p role="status">Loading verification...</p> : <><TrustBadges trust={status} /><section className="verify-section"><div className="verify-section-heading"><span>1</span><div><h2>Verify your phone</h2><p>Your number is shared with task participants after acceptance.</p></div>{status.phone_verified && <CheckCircle2 size={23} />}</div>{status.phone_verified ? <p className="verify-confirmed">Verified: {status.phone}</p> : !status.sms_available ? <p className="verification-notice">SMS verification is awaiting service setup. You can browse, but posting and offering help stay locked until verification is available.</p> : <><form className="stack-form" onSubmit={(event) => { event.preventDefault(); run(async () => { await api("/auth/verification/phone/send/", { method: "POST", body: JSON.stringify({ phone }) }); setCodeSent(true); setNotice("Code sent. Check your SMS."); }); }}><label>Mobile number<input type="tel" autoComplete="tel" required value={phone} onChange={(event) => { setPhone(event.target.value); setCodeSent(false); }} placeholder="+2348012345678" /></label><p className="form-note">By requesting a code, you agree to receive an SMS for verification. Standard message rates may apply.</p><button disabled={busy} className="button button-dark">{codeSent ? "Resend code" : "Send verification code"}</button></form>{codeSent && <form className="stack-form" onSubmit={(event) => { event.preventDefault(); run(async () => { await api("/auth/verification/phone/check/", { method: "POST", body: JSON.stringify({ code }) }); setCode(""); await load(); }); }}><label>SMS code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{4,10}" required value={code} onChange={(event) => setCode(event.target.value)} /></label><button disabled={busy} className="button button-dark">Confirm phone</button></form>}</>}</section>
    <section className="verify-section"><div className="verify-section-heading"><span>2</span><div><h2>Identity and camera photos</h2><p>For members offering help. Reviewed by an authorized admin.</p></div><ShieldCheck size={23} /></div>{status.identity_verified ? <p className="verify-confirmed">Your identity was manually reviewed. You can offer and accept work.</p> : status.submission?.status === "pending" ? <div className="verification-notice"><LockKeyhole size={22} /><div><strong>Awaiting manual review</strong><p>An admin will check your ID, face photos, camera challenge, and adult eligibility. You can refresh this page to check the result.</p><button className="text-button" onClick={() => run(load)} disabled={busy}>Refresh status</button></div></div> : !status.phone_verified ? <p className="form-note">Finish phone verification to unlock this step.</p> : !status.uploads_available ? <p className="verification-notice">Private identity uploads are awaiting secure storage setup. Please return once available.</p> : <>{status.submission && <p className="error-box">{status.submission.status === "rejected" ? `Please submit again: ${status.submission.review_note}` : "Your previous submission is no longer active. You can start again."}</p>}<form className="stack-form" onSubmit={submitIdentity}><label>Full name as shown on ID<input name="full_name" required minLength={3} maxLength={140} autoComplete="name" /></label><label>Document type<select name="document_type"><option value="national_id">National identity card</option><option value="passport">Passport</option><option value="drivers_license">Driver&apos;s license</option></select></label><label>Clear photo of your ID<input name="document_image" type="file" accept="image/jpeg,image/png" required /><small>JPEG or PNG under 3 MB. Show your name, date of birth, and portrait clearly.</small></label><div className="camera-panel"><h3><Camera size={18} />Take two photos now</h3><p>{!portrait ? "First, face the camera with your full face visible and good lighting." : !actionPhoto ? challenge?.instruction : "Both photos captured. You can retake before submitting."}</p><video ref={video} autoPlay muted playsInline className={streaming ? "camera-feed" : "camera-feed hidden"} />{preview && !streaming && <img className="camera-preview" src={preview} alt="Your captured portrait" />}<div className="form-actions">{!streaming && !actionPhoto && <button type="button" className="button button-outline" disabled={busy} onClick={startCamera}>Open camera</button>}{streaming && <button type="button" className="button button-dark" onClick={capture}>{portrait ? "Capture challenge photo" : "Capture portrait"}</button>}{(portrait || streaming) && <button type="button" className="text-button" onClick={() => { stopCamera(); setPortrait(null); setActionPhoto(null); setChallenge(null); }}>Retake / stop</button>}</div><small>Camera photos support manual review. This pilot does not perform certified liveness or automated document-authenticity checks.</small></div><label className="check-label"><input type="checkbox" name="adult_confirmed" required />I am at least 18 years old.</label><label className="check-label"><input type="checkbox" name="consent" required />I consent to authorized Neba reviewers processing my ID and camera photos for identity review. Evidence is removed after {status.retention_days} days when the scheduled purge runs. I can withdraw consent below.</label><label className="check-label"><input type="checkbox" name="publish_photo" />Show my approved portrait to signed-in members as my profile picture. Optional.</label><button disabled={busy || !actionPhoto} className="button button-dark">{busy ? "Submitting..." : "Submit for manual review"}</button></form></>}</section>
    <div className="verification-privacy"><LockKeyhole size={20} /><div><strong>Your ID stays private</strong><p>Evidence is encrypted and accessible only to authorized reviewers. A verification badge confirms checks were completed; it does not guarantee good behaviour. <Link href="/safety">Visit the safety center</Link>.</p>{status.submission && status.submission.status !== "revoked" && <button className="text-button" disabled={busy} onClick={() => run(async () => { await api("/auth/verification/withdraw/", { method: "POST" }); stopCamera(); setPortrait(null); setActionPhoto(null); setChallenge(null); await load(); setNotice("Consent withdrawn. Identity approval and saved photos have been removed."); })}>Withdraw consent and remove my identity photos</button>}</div></div><Link href="/profile" className="back-link">Return to profile</Link></>}
  </div></main>;
}

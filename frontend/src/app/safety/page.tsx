"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { api, getToken } from "@/lib/api";
type Block = { id: number; display_name: string };
type Report = { id: number; reason: string; status: string; created_at: string };
export default function SafetyPage() {
  const router = useRouter();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const load = useCallback(async () => { const [blocked, reported] = await Promise.all([api<Block[]>("/auth/blocks/"), api<Report[]>("/auth/reports/")]); setBlocks(blocked); setReports(reported); setLoading(false); }, []);
  useEffect(() => { if (!getToken()) { router.replace("/login?next=/safety"); return; } load().catch((err) => { setError(err.message); setLoading(false); }); }, [router, load]);
  return <main className="listing-page container"><div className="verification-page"><span className="eyebrow">LOOK OUT FOR EACH OTHER</span><h1>Your safety <em>center.</em></h1><p>Keep agreements clear, protect private details, and report worrying behaviour.</p><div className="verification-notice"><ShieldCheck size={23} /><div><strong>What verification means</strong><p>Phone verification confirms access to a number. Approved identity review means the pilot checks were completed. Neither is a background check, professional licence check, or guarantee of safe behaviour.</p><Link href="/verify">Review your verification</Link></div></div><p className="form-note">Neba reports are reviewed by admins; they are not an emergency service. If you are in immediate danger, contact local emergency services.</p>{error && <p role="alert" className="error-box">{error}</p>}{loading ? <p role="status">Loading your safety settings...</p> : <><section className="verify-section"><h2>Members you blocked</h2>{blocks.length ? blocks.map((block) => <div className="dash-row" key={block.id}><strong>{block.display_name || "Community member"}</strong><button className="small-button" disabled={busy !== null} onClick={async () => { setBusy(block.id); try { await api("/auth/blocks/", { method: "DELETE", body: JSON.stringify({ user: block.id }) }); await load(); } catch (err) { setError((err as Error).message); } finally { setBusy(null); } }}>Unblock</button></div>) : <p>No blocked members.</p>}</section><section className="verify-section"><h2>Your private reports</h2>{reports.length ? reports.map((report) => <div className="dash-row" key={report.id}><div><strong>Report #{report.id}: {report.reason}</strong><p>{new Date(report.created_at).toLocaleDateString("en-NG")}</p></div><span className="status-pill">{report.status}</span></div>) : <p>You have not submitted any reports. Use “Report or block” on a task, offer, or application.</p>}</section></>}<Link href="/profile" className="back-link">Return to profile</Link></div></main>;
}

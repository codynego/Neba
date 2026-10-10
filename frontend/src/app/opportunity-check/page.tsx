"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Check, CheckCircle2, CircleHelp, ExternalLink, FileText, Globe2, History, Link2, LoaderCircle, Plus, Search, ShieldAlert, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { OpportunityApplication, OpportunityCheck, Page } from "@/lib/types";

const verdictCopy = {
  confirmed: { label: "Confirmed", note: "Strong official evidence matches this opportunity.", icon: ShieldCheck },
  supported: { label: "Supported by evidence", note: "Reliable evidence supports it, with some details still worth checking.", icon: CheckCircle2 },
  suspicious: { label: "Suspicious", note: "Important evidence conflicts or the application route raises risk.", icon: ShieldAlert },
  unable: { label: "Unable to verify", note: "There is not enough reliable evidence for a safe conclusion.", icon: CircleHelp },
};
const assessmentCopy = { confirmed: "Confirmed", corroborated: "Corroborated", unconfirmed: "Not verified", contradicted: "Contradicted", not_applicable: "Context" };
const stages = ["Reading the submission", "Searching official sources", "Comparing claims and application route", "Building the evidence report"];

function categoryFor(type: string) {
  const value = type.toLowerCase();
  return ["scholarship", "grant", "job", "internship", "fellowship", "competition", "training", "startup", "funding", "tender"].find((item) => value.includes(item)) || "job";
}

export default function OpportunityCheckPage() {
  const [mode, setMode] = useState<"url" | "text">("url");
  const [value, setValue] = useState("");
  const [report, setReport] = useState<OpportunityCheck | null>(null);
  const [history, setHistory] = useState<OpportunityCheck[]>([]);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState("");
  const [tracked, setTracked] = useState<OpportunityApplication | null>(null);

  useEffect(() => { api<Page<OpportunityCheck>>("/opportunity-checks/").then((page) => setHistory(page.results)).catch(() => {}); }, []);
  useEffect(() => {
    if (!busy) { setStage(0); return; }
    const timer = window.setInterval(() => setStage((current) => Math.min(current + 1, stages.length - 1)), 2400);
    return () => window.clearInterval(timer);
  }, [busy]);
  const verdict = report?.verdict ? verdictCopy[report.verdict] : null;
  const VerdictIcon = verdict?.icon || ShieldCheck;
  const completedHistory = history.filter((item) => item.status === "completed" && item.verdict);
  const primarySource = useMemo(() => report?.sources.find((source) => source.authority === "official")?.url || report?.extracted_data.resolved_url || report?.submitted_url, [report]);

  async function runCheck(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setReport(null); setTracked(null);
    try {
      const result = await api<OpportunityCheck>("/opportunity-checks/", { method: "POST", body: JSON.stringify({ [mode]: value.trim() }) });
      setReport(result); setHistory((items) => [result, ...items.filter((item) => item.public_id !== result.public_id)]);
    } catch (exception) { setError((exception as Error).message); } finally { setBusy(false); }
  }

  async function trackOpportunity() {
    if (!report) return;
    setError("");
    try {
      const created = await api<OpportunityApplication>("/opportunity-applications/", { method: "POST", body: JSON.stringify({
        title: report.title || "Checked opportunity", provider: report.organization || "Unknown organisation", application_url: primarySource || "",
        category: categoryFor(report.opportunity_type), status: "preparing", notes: `Opportunity Check: ${verdict?.label}. ${report.report_summary}`.slice(0, 2000),
      }) });
      setTracked(created);
    } catch (exception) { setError((exception as Error).message); }
  }

  function reset() { setReport(null); setValue(""); setError(""); setTracked(null); window.scrollTo({ top: 0, behavior: "smooth" }); }

  return <main className="check-page container">
    <header className="check-hero">
      <div><span className="eyebrow">NEBA EVIDENCE DESK</span><h1>Check before you <em>trust the link.</em></h1><p>Share an opportunity link or paste the message you received. Neba searches for official evidence, compares the claims and checks where the application actually leads.</p></div>
      <div className="check-method"><ShieldCheck size={25} /><strong>Evidence, not guesswork</strong><span>Official sources first · Claims checked separately · Uncertainty shown clearly</span></div>
    </header>

    {!report && <section className="check-intake" aria-labelledby="check-form-title">
      <div className="check-intake-number">01</div><div className="check-intake-main"><div className="check-intake-heading"><div><span className="eyebrow">SUBMIT FOR REVIEW</span><h2 id="check-form-title">What would you like Neba to inspect?</h2></div><span className="check-private">Private to your account</span></div>
      <div className="check-mode-tabs" role="tablist" aria-label="Submission type"><button role="tab" aria-selected={mode === "url"} className={mode === "url" ? "active" : ""} onClick={() => { setMode("url"); setValue(""); setError(""); }}><Link2 size={16} /> Opportunity link</button><button role="tab" aria-selected={mode === "text"} className={mode === "text" ? "active" : ""} onClick={() => { setMode("text"); setValue(""); setError(""); }}><FileText size={16} /> Paste a message</button></div>
      <form onSubmit={runCheck} className="check-form">
        {mode === "url" ? <label><span>Link to the opportunity</span><div className="check-url-field"><Globe2 size={19} /><input type="url" required maxLength={1000} value={value} onChange={(event) => setValue(event.target.value)} placeholder="https://organisation.org/opportunity" /></div><small>Use the exact page or application link you were sent.</small></label> : <label><span>Opportunity message or advert</span><textarea required minLength={40} maxLength={12000} rows={9} value={value} onChange={(event) => setValue(event.target.value)} placeholder="Paste the full message, including the organisation, deadline, benefits, contact details and application instructions…" /><small>{value.length.toLocaleString()} / 12,000 characters</small></label>}
        {error && <p className="error-box" role="alert">{error}</p>}
        <div className="check-submit-row"><p><ShieldCheck size={15} /> Your submission is processed by Neba’s AI and web-search providers to produce this private report.</p><button className="button button-dark" disabled={busy || !value.trim()}>{busy ? <><LoaderCircle className="spin" size={17} /> Checking…</> : <>Run opportunity check <Search size={16} /></>}</button></div>
      </form></div>
    </section>}

    {busy && <section className="check-progress" aria-live="polite"><div className="check-progress-radar"><span /><Search size={22} /></div><div><span className="eyebrow">LIVE EVIDENCE SEARCH</span><h2>{stages[stage]}</h2><div className="check-progress-steps">{stages.map((item, index) => <span key={item} className={index <= stage ? "active" : ""}><i>{index < stage ? <Check size={11} /> : index + 1}</i>{item}</span>)}</div><p>This can take up to a minute because Neba is checking current sources, not relying only on memory.</p></div></section>}

    {report && verdict && <>
      <section className={`check-verdict ${report.verdict}`}>
        <div className="check-verdict-mark"><VerdictIcon size={32} /><span>NEBA<br />CHECK</span></div><div className="check-verdict-copy"><span className="eyebrow">EVIDENCE REPORT</span><h2>{verdict.label}</h2><p>{verdict.note}</p></div><div className="check-verdict-facts"><div><span>Evidence confidence</span><strong>{report.evidence_confidence}</strong></div><div><span>Risk level</span><strong>{report.risk_level}</strong></div></div>
      </section>
      <section className="check-report-head"><div><span className="eyebrow">OPPORTUNITY IDENTIFIED</span><h1>{report.title || "Unidentified opportunity"}</h1><p>{report.organization || "Organisation not established"}{report.opportunity_type ? ` · ${report.opportunity_type}` : ""}</p></div><div className="check-report-actions">{primarySource && <a className="button button-outline" href={primarySource} target="_blank" rel="noreferrer">Open best source <ExternalLink size={15} /></a>}{tracked ? <Link className="button button-dark" href={`/applications/${tracked.public_id}`}>Open tracker <ArrowRight size={15} /></Link> : <button className="button button-dark" onClick={trackOpportunity}><Plus size={15} /> Add to tracker</button>}</div></section>
      {error && <p className="error-box" role="alert">{error}</p>}
      <div className="check-report-grid"><div className="check-report-main">
        <section className="check-report-section check-summary"><span className="check-section-index">01</span><div><span className="eyebrow">WHAT THE EVIDENCE SAYS</span><p className="check-summary-lead">{report.report_summary}</p><div className="check-action-note"><ArrowRight size={17} /><div><strong>Recommended next step</strong><p>{report.recommended_action}</p></div></div></div></section>
        <section className="check-report-section"><span className="check-section-index">02</span><div><div className="check-section-title"><div><span className="eyebrow">CLAIM LEDGER</span><h2>Each claim, checked separately.</h2></div><span>{report.claims.length} findings</span></div><div className="claim-ledger">{report.claims.map((claim, index) => <article key={`${claim.claim}-${index}`} className={`claim-row ${claim.assessment}`}><div className="claim-line"><span>{index + 1}</span><i /></div><div><span className="claim-status">{assessmentCopy[claim.assessment]}</span><h3>{claim.claim}</h3><p>{claim.evidence_summary}</p>{claim.source_url && <a href={claim.source_url} target="_blank" rel="noreferrer">View supporting source <ExternalLink size={13} /></a>}</div></article>)}</div></div></section>
        <section className="check-report-section"><span className="check-section-index">03</span><div><div className="check-section-title"><div><span className="eyebrow">SOURCE RECORD</span><h2>Where this report came from.</h2></div><span>{report.sources.length} sources</span></div><div className="check-source-list">{report.sources.map((source, index) => <a key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noreferrer"><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{source.title}</strong><p>{source.supports}</p><small>{source.authority} · {new URL(source.url).hostname.replace("www.", "")}</small></div><ExternalLink size={15} /></a>)}</div></div></section>
      </div><aside className="check-report-aside">
        <section><span className="eyebrow">AUTOMATED SAFETY CHECKS</span><div className="signal-list">{report.deterministic_checks.map((signal) => <div key={signal.key} className={signal.status}>{signal.status === "pass" ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}<div><strong>{signal.label}</strong><p>{signal.detail}</p></div></div>)}</div></section>
        {report.warnings.length > 0 && <section className="check-warnings"><span className="eyebrow">CAUTIONS</span>{report.warnings.map((warning, index) => <p key={index}><AlertTriangle size={15} />{warning}</p>)}</section>}
        <section className="check-limit"><CircleHelp size={18} /><div><strong>A check is not a guarantee.</strong><p>Web pages change and sophisticated fraud can copy real organisations. Never send money or sensitive documents until the application route is confirmed.</p></div></section>
        <button className="check-again" onClick={reset}>Check another opportunity <ArrowRight size={15} /></button>
      </aside></div>
    </>}

    {!report && !busy && completedHistory.length > 0 && <section className="check-history"><div className="check-history-title"><div><History size={18} /><div><span className="eyebrow">RECENT CHECKS</span><h2>Your private evidence archive</h2></div></div><span>Last {completedHistory.length}</span></div><div>{completedHistory.map((item) => <button key={item.public_id} onClick={() => { setReport(item); setError(""); }}><span className={`history-verdict ${item.verdict}`}><ShieldCheck size={16} /></span><div><strong>{item.title || item.submitted_url || "Pasted opportunity"}</strong><small>{item.organization || new Date(item.created_at).toLocaleDateString()}</small></div><b>{verdictCopy[item.verdict as keyof typeof verdictCopy].label}</b><ArrowRight size={15} /></button>)}</div></section>}
  </main>;
}

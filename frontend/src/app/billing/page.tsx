"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CheckCircle2, Coins, CreditCard, ReceiptText, Sparkles } from "lucide-react";
import { api, getToken } from "@/lib/api";

type BillingStatus = {
  plan: "free" | "plus";
  payments_configured: boolean;
  credit_balance: number;
  usage: { opportunity_checks: { used: number; limit: number; remaining: number; resets_at: string } };
  subscription: null | { plan: string; status: string; interval: string; amount: string | null; currency: string; current_period_end: string | null; next_billed_at: string | null; cancel_at_period_end: boolean };
  payments: { id: string; kind: string; description: string; amount: string; currency: string; status: string; created_at: string }[];
};

function amount(value: string, currency: string) { return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value)); }
function date(value: string | null) { return value ? new Date(value).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" }) : "—"; }

export default function BillingPage() {
  const router = useRouter(); const [data, setData] = useState<BillingStatus | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { if (!getToken()) { router.replace("/login?next=/billing"); return; } api<BillingStatus>("/billing/status/").then(setData).catch((err) => setError(err.message)); }, [router]);
  async function portal() { setBusy(true); setError(""); try { const result = await api<{ url: string }>("/billing/portal/", { method: "POST" }); window.location.assign(result.url); } catch (err) { setError((err as Error).message); setBusy(false); } }
  if (error && !data) return <main className="billing-page container"><p className="error-box">{error}</p></main>;
  if (!data) return <main className="billing-page container"><p>Loading billing…</p></main>;
  const usage = data.usage.opportunity_checks;
  return <main className="billing-page container"><header className="billing-page-header"><div><span className="eyebrow">PLAN & BILLING</span><h1>The account behind<br />your next move.</h1><p>See your plan, usage, credits, and payment history in one place.</p></div><span className={`billing-plan-stamp ${data.plan}`}><Sparkles size={18} /><b>GetNeba {data.plan === "plus" ? "Plus" : "Free"}</b><small>{data.subscription?.status || "Active"}</small></span></header>{error && <p className="pricing-error" role="alert">{error}</p>}<section className="billing-summary-grid"><article><span><Sparkles size={18} /> Opportunity checks</span><strong>{usage.remaining}<small> remaining</small></strong><div className="billing-usage-track"><i style={{ width: `${Math.min(100, usage.limit ? usage.used / usage.limit * 100 : 0)}%` }} /></div><p>{usage.used} of {usage.limit} used · resets {date(usage.resets_at)}</p></article><article><span><Coins size={18} /> Credit balance</span><strong>{data.credit_balance.toLocaleString()}<small> credits</small></strong><p>Earned and purchased credits stay together.</p><Link href="/credits">Get or earn credits <ArrowUpRight size={15} /></Link></article></section><section className="billing-plan-card"><div><span className="eyebrow">CURRENT PLAN</span><h2>GetNeba {data.plan === "plus" ? "Plus" : "Free"}</h2>{data.subscription ? <p>{data.subscription.cancel_at_period_end ? `Access ends ${date(data.subscription.current_period_end)}.` : `Next billing date: ${date(data.subscription.next_billed_at)}.`}</p> : <p>Core discovery, tracking, contributions, and three opportunity checks each month.</p>}</div><div>{data.subscription ? <button className="button button-dark" onClick={portal} disabled={busy}><CreditCard size={17} />{busy ? "Opening billing…" : "Manage billing"}</button> : <Link className="button button-dark" href="/pricing">Compare plans <ArrowUpRight size={17} /></Link>}<small>{data.subscription?.amount ? `${amount(data.subscription.amount, data.subscription.currency)} / ${data.subscription.interval}` : "No recurring charge"}</small></div></section><section className="billing-history"><header><div><span className="eyebrow">PAYMENT HISTORY</span><h2>Receipts and purchases</h2></div><ReceiptText size={22} /></header>{data.payments.length ? <div className="billing-payment-list">{data.payments.map((payment) => <div key={payment.id}><span className="billing-payment-icon"><CheckCircle2 size={17} /></span><div><strong>{payment.description}</strong><small>{date(payment.created_at)} · {payment.id}</small></div><b>{amount(payment.amount, payment.currency)}</b><em>{payment.status}</em></div>)}</div> : <div className="billing-empty"><ReceiptText size={21} /><p>No payments yet. When you subscribe or buy credits, receipts will appear here.</p></div>}</section></main>;
}

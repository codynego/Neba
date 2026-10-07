"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Coins, Gift, Sparkles } from "lucide-react";
import { api, getToken } from "@/lib/api";

type CreditTransaction = { amount: number; action: string; description: string; created_at: string };
type CreditSummary = { balance: number; earned_today: number; daily_cap: number; transactions: CreditTransaction[] };

function actionLabel(action: string) { return action === "approved_contribution" ? "Approved contribution" : action.replaceAll("_", " "); }

export default function CreditsPage() {
  const router = useRouter();
  const [credits, setCredits] = useState<CreditSummary | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!getToken()) { router.replace("/login?next=/credits"); return; }
    api<CreditSummary>("/auth/credits/").then(setCredits).catch((err) => setError(err.message));
  }, [router]);
  if (error) return <main className="credits-page container"><p className="error-box">{error}</p></main>;
  if (!credits) return <main className="credits-page container"><p className="credits-loading">Loading your credits…</p></main>;
  return <main className="credits-page container">
    <Link href="/profile" className="credits-back"><ArrowLeft size={15} /> Back to profile</Link>
    <header className="credits-heading"><div><span className="eyebrow"><Coins size={14} /> YOUR GETNEBA CREDITS</span><h1>Use contribution<br /><em>to go further.</em></h1><p>Credits unlock the deeper preparation tools that help you move from finding an opportunity to feeling ready for it.</p></div><div className="credits-balance-orb"><span>AVAILABLE</span><strong>{credits.balance}</strong><small>credits</small></div></header>
    <section className="credits-earn-card"><div className="credits-earn-icon"><Gift size={20} /></div><div><span className="eyebrow">EARN MORE TODAY</span><h2>Share something useful.</h2><p>You can earn {Math.max(0, credits.daily_cap - credits.earned_today)} more credits today when Getneba approves a unique opportunity you contribute.</p></div><Link href="/my-opportunities/new" className="button button-dark compact">Contribute <ArrowUpRight size={15} /></Link></section>
    <div className="credits-grid"><section className="credits-panel"><div className="credits-panel-heading"><div><span className="eyebrow">YOUR ACTIVITY</span><h2>Credit history</h2></div><span>{credits.transactions.length} entries</span></div>{credits.transactions.length ? <div className="credits-history">{credits.transactions.map((item, index) => <div className="credits-history-row" key={`${item.created_at}-${index}`}><span className="credits-history-icon"><Coins size={15} /></span><div><strong>{actionLabel(item.action)}</strong><small>{item.description || "Getneba credit activity"} · {new Date(item.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</small></div><b className={item.amount >= 0 ? "positive" : "negative"}>{item.amount >= 0 ? "+" : ""}{item.amount}</b></div>)}</div> : <div className="credits-empty"><Sparkles size={20} /><p>Your credit history will appear here after your first approved contribution.</p></div>}</section><section className="credits-panel credits-topup"><span className="credits-topup-mark"><Coins size={19} /></span><span className="eyebrow">TOP UP</span><h2>Need more room to prepare?</h2><p>Top up credits when you want to use premium intelligence tools without waiting for your next approved contribution.</p><button className="button button-dark" type="button" disabled>Top up credits <span>Coming soon</span></button><small>Payments will be available here soon.</small></section></div>
  </main>;
}

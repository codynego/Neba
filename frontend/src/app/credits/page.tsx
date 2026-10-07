"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Check, Coins, Gift, Sparkles } from "lucide-react";
import { api, getToken } from "@/lib/api";

type CreditTransaction = { amount: number; action: string; description: string; created_at: string };
type CreditSummary = { balance: number; earned_today: number; daily_cap: number; transactions: CreditTransaction[] };
const packages = [{ name: "Starter", credits: 100, price: 1000 }, { name: "Popular", credits: 300, price: 2500 }, { name: "Pro", credits: 1000, price: 7500 }];

function actionLabel(action: string) { return action === "approved_contribution" ? "Approved contribution" : action.replaceAll("_", " "); }

export default function CreditsPage() {
  const router = useRouter();
  const [credits, setCredits] = useState<CreditSummary | null>(null);
  const [selectedPackage, setSelectedPackage] = useState(1);
  const [customCredits, setCustomCredits] = useState(500);
  const [customMode, setCustomMode] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!getToken()) { router.replace("/login?next=/credits"); return; }
    api<CreditSummary>("/auth/credits/").then(setCredits).catch((err) => setError(err.message));
  }, [router]);
  if (error) return <main className="credits-page container"><p className="error-box">{error}</p></main>;
  if (!credits) return <main className="credits-page container"><p className="credits-loading">Loading your credits…</p></main>;
  const selected = customMode ? { credits: Math.max(10, customCredits || 0), price: Math.max(10, customCredits || 0) * 8 } : packages[selectedPackage];
  return <main className="credits-page container">
    <Link href="/profile" className="credits-back"><ArrowLeft size={15} /> Back to profile</Link>
    <header className="credits-heading"><div><span className="eyebrow"><Coins size={14} /> YOUR GETNEBA CREDITS</span><h1>Use contribution<br /><em>to go further.</em></h1><p>Credits unlock the deeper preparation tools that help you move from finding an opportunity to feeling ready for it.</p></div><div className="credits-balance-orb"><span>AVAILABLE</span><strong>{credits.balance}</strong><small>credits</small></div></header>
    <section className="credits-earn-card"><div className="credits-earn-icon"><Gift size={20} /></div><div><span className="eyebrow">EARN MORE TODAY</span><h2>Share something useful.</h2><p>You can earn {Math.max(0, credits.daily_cap - credits.earned_today)} more credits today when Getneba approves a unique opportunity you contribute.</p></div><Link href="/my-opportunities/new" className="button button-dark compact">Contribute <ArrowUpRight size={15} /></Link></section>
    <div className="credits-grid"><section className="credits-panel"><div className="credits-panel-heading"><div><span className="eyebrow">YOUR ACTIVITY</span><h2>Credit history</h2></div><span>{credits.transactions.length} entries</span></div>{credits.transactions.length ? <div className="credits-history">{credits.transactions.map((item, index) => <div className="credits-history-row" key={`${item.created_at}-${index}`}><span className="credits-history-icon"><Coins size={15} /></span><div><strong>{actionLabel(item.action)}</strong><small>{item.description || "Getneba credit activity"} · {new Date(item.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</small></div><b className={item.amount >= 0 ? "positive" : "negative"}>{item.amount >= 0 ? "+" : ""}{item.amount}</b></div>)}</div> : <div className="credits-empty"><Sparkles size={20} /><p>Your credit history will appear here after your first approved contribution.</p></div>}</section><section className="credits-panel credits-topup"><span className="credits-topup-mark"><Coins size={19} /></span><span className="eyebrow">BUY CREDITS</span><h2>Choose what you need.</h2><p>1 credit is the internal ₦10 usage anchor for Getneba AI tools.</p><div className="credit-package-grid">{packages.map((item, index) => <button type="button" className={`credit-package${!customMode && selectedPackage === index ? " selected" : ""}`} key={item.name} onClick={() => { setSelectedPackage(index); setCustomMode(false); }}><span>{item.name}{item.name === "Popular" && <small>Best value</small>}</span><strong>{item.credits.toLocaleString()}</strong><b>₦{item.price.toLocaleString()}</b>{!customMode && selectedPackage === index && <Check size={14} />}</button>)}</div><label className={`credit-custom${customMode ? " selected" : ""}`}><span><b>Need a different amount?</b><small>Custom credits · ₦8 per credit</small></span><input type="number" min="10" step="10" value={customCredits} onFocus={() => setCustomMode(true)} onChange={(event) => { setCustomCredits(Number(event.target.value)); setCustomMode(true); }} aria-label="Custom credit amount" /><em>credits</em></label><div className="credit-checkout-summary"><span>Selected</span><strong>{selected.credits.toLocaleString()} credits · ₦{selected.price.toLocaleString()}</strong></div><button className="button button-dark" type="button" disabled>Continue to payment <span>Coming soon</span></button><small>Payments will be available here soon.</small></section></div>
  </main>;
}

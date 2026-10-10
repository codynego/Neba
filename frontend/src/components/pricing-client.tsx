"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight, Check, Coins, ShieldCheck, Sparkles } from "lucide-react";
import { api, getToken } from "@/lib/api";

type Price = { interval: "month" | "year"; amount: string; currency: string; configured: boolean };
type Plan = { code: string; name: string; description: string; featured?: boolean; features: string[]; prices: Price[] };
type PlansResponse = { plans: Plan[]; payments_configured: boolean };

function money(price?: Price) {
  if (!price) return "Free";
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: price.currency, maximumFractionDigits: 0 }).format(Number(price.amount));
}

export function PricingClient() {
  const router = useRouter();
  const [data, setData] = useState<PlansResponse | null>(null);
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => { setSignedIn(Boolean(getToken())); api<PlansResponse>("/billing/plans/").then(setData).catch((err) => setError(err.message)); }, []);

  async function choosePlus() {
    if (!getToken()) { router.push(`/login?next=${encodeURIComponent(`/pricing?plan=plus&interval=${interval}`)}`); return; }
    setBusy(true); setError("");
    try {
      const result = await api<{ checkout_url: string }>("/billing/checkout/", { method: "POST", body: JSON.stringify({ kind: "subscription", interval }) });
      window.location.assign(result.checkout_url);
    } catch (err) { setError((err as Error).message); setBusy(false); }
  }

  return <main className="pricing-page">
    <section className="pricing-hero"><div className="nb-wrap pricing-hero-grid"><div><span className="nb-kicker"><Sparkles size={14} /> PRICING FOR THE NEXT STEP</span><h1>Start with a good find.<br /><em>Go further when it matters.</em></h1><p>Discovery stays free. Plus gives an active opportunity search more evidence, more preparation, and more room to think.</p></div><div className="pricing-ledger" aria-label="How GetNeba pricing works"><span>THE GETNEBA PROMISE</span><div><strong>Find</strong><b>Free</b></div><div><strong>Check</strong><b>Free + Plus</b></div><div><strong>Prepare</strong><b>Free + Plus</b></div><small><ShieldCheck size={15} /> No percentage taken from scholarships, grants, or earnings.</small></div></div></section>
    <section className="nb-wrap pricing-body"><div className="pricing-heading"><div><span className="nb-kicker">CHOOSE YOUR PACE</span><h2>One useful free plan.<br />One serious upgrade.</h2></div><div className="billing-toggle" role="group" aria-label="Billing interval"><button className={interval === "month" ? "active" : ""} onClick={() => setInterval("month")}>Monthly</button><button className={interval === "year" ? "active" : ""} onClick={() => setInterval("year")}>Yearly <span>save 20%</span></button></div></div>
      {error && <p className="pricing-error" role="alert">{error}</p>}
      {!data ? <div className="pricing-loading">Loading the plans…</div> : <div className="pricing-grid">{data.plans.map((plan) => { const price = plan.prices.find((item) => item.interval === interval); return <article key={plan.code} className={`pricing-card${plan.featured ? " featured" : ""}`}><header><div><span>{plan.featured ? "THE ACTIVE SEARCH" : "THE OPEN DOOR"}</span><h3>GetNeba {plan.name}</h3></div>{plan.featured && <Sparkles size={23} />}</header><div className="pricing-price"><strong>{money(price)}</strong><span>{price ? `/${interval === "month" ? "month" : "year"}` : "forever"}</span></div><p>{plan.description}</p><ul>{plan.features.map((feature) => <li key={feature}><Check size={16} />{feature}</li>)}</ul>{plan.code === "free" ? <Link className="pricing-action secondary" href={signedIn ? "/dashboard" : "/register"}>{signedIn ? "Go to my home" : "Start free"}<ArrowRight size={17} /></Link> : <button className="pricing-action primary" onClick={choosePlus} disabled={busy || !price?.configured || !data.payments_configured}>{busy ? "Opening secure checkout…" : price?.configured && data.payments_configured ? "Choose Plus" : "Checkout setup pending"}<ArrowUpRight size={17} /></button>}<small>{plan.code === "free" ? "No card required." : "Secure checkout and billing by Bachs."}</small></article>; })}</div>}
      <section className="pricing-credits-callout"><span><Coins size={22} /></span><div><span className="nb-kicker">PREFER PAY-AS-YOU-GO?</span><h2>Buy credits only when you need them.</h2><p>Credits work alongside either plan and can also be earned by contributing useful opportunities.</p></div><Link href={signedIn ? "/credits" : "/login?next=/credits"}>Explore credits <ArrowUpRight size={17} /></Link></section>
      <section className="pricing-faq"><div><span className="nb-kicker">PLAIN ANSWERS</span><h2>Before you choose.</h2></div><div>{[["Will discovery stay free?", "Yes. Browsing, saving, tracking and contributing opportunities remain part of Free."], ["How are payments handled?", "Bachs hosts checkout, stores payment details and manages recurring billing. GetNeba never receives your full card details."], ["Can I cancel?", "Yes. Plus members can manage or cancel from the Bachs billing portal. Your paid access follows the billing period shown there."], ["What happens to my credits?", "Credits stay on your account. A Plus subscription does not erase or replace credits you earned or bought."]].map(([question, answer]) => <article key={question}><h3>{question}</h3><p>{answer}</p></article>)}</div></section>
    </section>
  </main>;
}

"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ArrowLeft, MapPin } from "lucide-react";
import { api } from "@/lib/api";
import { Offer, User, naira } from "@/lib/types";
import { MemberPhoto, TrustBadges } from "@/components/trust";
import { HelperRequestForm } from "@/components/helper-request-form";
import { SafetyActions } from "@/components/safety-actions";
export default function OfferDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [me, setMe] = useState<User | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { const controller = new AbortController(); setOffer(null); setError(""); Promise.all([api<Offer>(`/offers/${id}/`, { signal: controller.signal }), api<User>("/auth/me/", { signal: controller.signal })]).then(([item, user]) => { setOffer(item); setMe(user); }).catch((err) => { if (!controller.signal.aborted) setError(err.message); }); return () => controller.abort(); }, [id]);
  return <main className="detail-page"><div className="container"><Link className="back-link" href="/offers"><ArrowLeft size={17} /> Back to people</Link>{error ? <p className="error-box">{error}</p> : offer ? <div className="detail-grid"><article className="detail-main"><span className="eyebrow">LOCAL SKILL OFFER</span><h1>{offer.title}</h1><div className="detail-meta"><span><MapPin size={18} /> {offer.city}, {offer.state}</span></div><div className="detail-body"><h2>What I can help with</h2><p>{offer.description}</p></div><div className="posted-by">Offered by <Link href={`/members/${offer.provider_username || offer.provider_public_id || offer.provider}`}><strong>{offer.provider_name || "Community member"}</strong></Link></div><MemberPhoto id={offer.provider} name={offer.provider_name || "N"} available={offer.provider_trust?.photo_available} /><TrustBadges trust={offer.provider_trust} /><SafetyActions member={offer.provider} name={offer.provider_name} /></article><aside className="detail-aside"><span className="eyebrow">STARTING PRICE</span><div className="detail-price">{naira(offer.starting_price)}</div><div className="aside-rule" />{me?.id === offer.provider ? <><p>This is your skill offer.</p><Link className="button button-outline full-width" href="/profile">Manage your profile & availability</Link></> : <HelperRequestForm offer={offer} />}</aside></div> : <p>Loading offer...</p>}</div></main>;
}

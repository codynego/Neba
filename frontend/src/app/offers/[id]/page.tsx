"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ArrowLeft, MapPin } from "lucide-react";
import { api } from "@/lib/api";
import { Offer, naira } from "@/lib/types";
export default function OfferDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api<Offer>(`/offers/${id}/`).then(setOffer).catch((err) => setError(err.message)); }, [id]);
  return <main className="detail-page"><div className="container"><Link className="back-link" href="/offers"><ArrowLeft size={17} /> Back to people</Link>{error ? <p className="error-box">{error}</p> : offer ? <div className="detail-grid"><article className="detail-main"><span className="eyebrow">LOCAL SKILL OFFER</span><h1>{offer.title}</h1><div className="detail-meta"><span><MapPin size={18} /> {offer.city}, {offer.state}</span></div><div className="detail-body"><h2>What I can help with</h2><p>{offer.description}</p></div><div className="posted-by">Offered by <strong>{offer.provider_name || "Community member"}</strong></div></article><aside className="detail-aside"><span className="eyebrow">STARTING PRICE</span><div className="detail-price">{naira(offer.starting_price)}</div><div className="aside-rule" /><p>Direct booking and messaging are coming next. For this pilot, post a task with your request so providers can apply.</p><Link href="/tasks/new" className="button button-dark full-width">Post your request ↗</Link></aside></div> : <p>Loading offer...</p>}</div></main>;
}

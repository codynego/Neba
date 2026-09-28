"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { api } from "@/lib/api";
import { Offer, Page } from "@/lib/types";
import { OfferCard } from "@/components/offer-card";
export default function OffersPage() {
  const [city, setCity] = useState("");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { const timer = setTimeout(() => { setLoading(true); api<Page<Offer>>(`/offers/?city=${encodeURIComponent(city)}`).then((data) => { setOffers(data.results); setError(""); }).catch((err) => setError(err.message)).finally(() => setLoading(false)); }, 250); return () => clearTimeout(timer); }, [city]);
  return <main className="listing-page"><div className="container"><div className="listing-heading"><div><span className="eyebrow">PEOPLE WHO CAN HELP</span><h1>Find local <em>skills.</em></h1><p>Explore what people in your city can do.</p></div><Link href="/offers/new" className="button button-dark">Offer your skills <ArrowUpRight size={18} /></Link></div><div className="filters"><label className="filter-search"><Search size={18} /><input placeholder="Filter by city" value={city} onChange={(e) => setCity(e.target.value)} /></label></div>{error ? <p className="error-box">{error}. Make sure the Django server is running.</p> : loading ? <p className="loading">Finding people...</p> : offers.length ? <div className="offer-grid">{offers.map((offer) => <OfferCard offer={offer} key={offer.id} />)}</div> : <div className="empty-list"><h2>No offers found here yet.</h2><p>Try another city or put your own skills on the map.</p><Link href="/offers/new" className="button button-dark">Create an offer <ArrowUpRight size={18} /></Link></div>}</div></main>;
}

import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import { Offer, naira } from "@/lib/types";
export function OfferCard({ offer }: { offer: Offer }) {
  return <article className="offer-card"><div className="offer-avatar">{(offer.provider_name || "N").slice(0, 1).toUpperCase()}</div><div className="offer-content"><span className="eyebrow">{offer.provider_name || "Community member"}</span><h3>{offer.title}</h3><p>{offer.description}</p><div className="offer-foot"><span><MapPin size={14} /> {offer.city}, {offer.state}</span><strong>From {naira(offer.starting_price)}</strong></div></div><Link href={`/offers/${offer.id}`} aria-label={`View ${offer.title}`} className="offer-arrow"><ArrowUpRight size={19} /></Link></article>;
}

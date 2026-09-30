import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import { Offer, categories, naira } from "@/lib/types";
import { MemberPhoto, TrustBadges } from "./trust";
import { ListingPhotoGallery } from "./listing-photos";
export function OfferCard({ offer }: { offer: Offer }) {
  return <Link href={`/offers/${offer.public_id || offer.id}`} className="offer-card"><div className="offer-top"><MemberPhoto id={offer.provider} name={offer.provider_name || "N"} available={offer.provider_trust?.photo_available} /><div><h3>{offer.provider_name || "Community member"}</h3><span className="card-category">{categories.find((category) => category.value === offer.category)?.label}</span></div><ArrowUpRight size={18} /></div><TrustBadges trust={offer.provider_trust} /><span className="offer-availability">{offer.provider_availability === "unavailable" ? "Not taking work" : offer.provider_availability || "Flexible availability"}</span><ListingPhotoGallery kind="offers" id={offer.public_id || offer.id} count={offer.photo_count} compact title={offer.title} /><h4>{offer.title}</h4><p>{offer.description}</p><div className="offer-foot"><span><MapPin size={14} />{offer.city}</span><strong>From {naira(offer.starting_price)}</strong></div></Link>;
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck2, CheckCircle2, MapPin, ShieldCheck, Star } from "lucide-react";
import { MemberPhoto, TrustBadges } from "@/components/trust";
import { OfferCard } from "@/components/offer-card";
import { SafetyActions } from "@/components/safety-actions";
import { availabilityLabels, categories } from "@/lib/types";
import type { MemberProfile } from "@/lib/types";
import { getPublicMemberProfile } from "@/lib/public-profile";
import { jsonLd, publicPageMetadata, siteUrl } from "@/lib/seo";

type MemberPageProps = { params: Promise<{ id: string }> };

function profileDescription(member: MemberProfile) {
  const name = member.display_name || `@${member.username}`;
  const location = [member.neighborhood, member.city, member.state].filter(Boolean).join(", ");
  const skillNames = member.skills.map((skill) => categories.find((category) => category.value === skill)?.label).filter(Boolean);
  const fallback = `${name}${skillNames.length ? ` offers ${skillNames.join(", ")}` : " is a GetNeba member"}${location ? ` in ${location}` : ""}. View their skills, availability and completed-task reviews.`;
  const description = (member.bio || fallback).replace(/\s+/g, " ").trim();
  return description.length > 160 ? `${description.slice(0, 157).trimEnd()}…` : description;
}

export async function generateMetadata({ params }: MemberPageProps): Promise<Metadata> {
  const { id } = await params;
  const member = await getPublicMemberProfile(id);
  if (!member) return { title: "Member not found", robots: { index: false, follow: false } };
  return publicPageMetadata(
    `${member.display_name || member.username} (@${member.username})`,
    profileDescription(member),
    `/u/${encodeURIComponent(member.username)}`,
  );
}

export default async function MemberPage({ params }: MemberPageProps) {
  const { id } = await params;
  const member = await getPublicMemberProfile(id);
  if (!member) notFound();

  const profileUrl = new URL(`/u/${encodeURIComponent(member.username)}`, siteUrl).toString();
  const location = [member.neighborhood, member.city, member.state].filter(Boolean).join(", ");
  const rating = member.review_count && member.rating ? {
    "@type": "AggregateRating",
    ratingValue: member.rating,
    reviewCount: member.review_count,
    bestRating: 5,
    worstRating: 1,
  } : undefined;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: profileUrl,
    name: `${member.display_name || member.username} (@${member.username}) on GetNeba`,
    description: profileDescription(member),
    mainEntity: {
      "@type": "Person",
      name: member.display_name || member.username,
      alternateName: `@${member.username}`,
      url: profileUrl,
      description: member.bio || undefined,
      knowsAbout: member.skills.map((skill) => categories.find((category) => category.value === skill)?.label).filter(Boolean),
      address: location ? { "@type": "PostalAddress", addressLocality: member.city || undefined, addressRegion: member.state || undefined } : undefined,
      aggregateRating: rating,
    },
  };

  const activeOffers = member.offers.filter((offer) => offer.active);
  const profileName = member.display_name || "Community member";

  return <main className="listing-page container member-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
    <Link className="back-link" href="/">Back to GetNeba</Link>
    <section className="member-showcase">
      <div className="member-showcase-identity"><MemberPhoto id={member.public_id} name={profileName} available={member.photo_available} /><div><h1>{profileName}</h1><p><MapPin size={18} />{location || "Nigeria"}</p><span className="availability-chip"><CalendarCheck2 size={15} />{availabilityLabels[member.availability]}</span>{member.identity_verified && <span className="member-verified"><ShieldCheck size={18} />Identity manually reviewed</span>}</div></div>
      {member.bio && <p className="member-bio">{member.bio}</p>}
      <div className="skill-tags">{member.skills.map((skill) => <span className="category-pill" key={skill}>{categories.find((category) => category.value === skill)?.label}</span>)}</div>
      <div className="member-scorecard"><div><CheckCircle2 size={25} /><strong>{member.completed_tasks}</strong><span>completed tasks</span></div><div><Star size={25} /><strong>{member.rating?.toFixed(1) || "New"}</strong><span>{member.review_count ? `from ${member.review_count} reviews` : "building reviews"}</span></div></div>
      <TrustBadges trust={member} />
      <p className="form-note">Skills and availability are provided by the member. Verification is not a guarantee of safe behaviour.</p>
      <SafetyActions member={member.id} name={member.display_name} />
    </section>
    <section className="member-section member-services"><div className="member-section-heading"><div><span className="eyebrow">HOW I CAN HELP</span><h2>Services from {profileName.split(" ")[0]}</h2></div></div>{activeOffers.length ? <div className="offer-grid">{activeOffers.map((offer) => <OfferCard key={offer.id} offer={offer} />)}</div> : <p>No active skill offers yet.</p>}</section>
    <section className="member-section member-reviews"><div className="member-section-heading"><div><span className="eyebrow">NEIGHBOR FEEDBACK</span><h2>Reviews</h2></div><span>{member.review_count || 0} {member.review_count === 1 ? "review" : "reviews"}</span></div>{member.reviews.length ? member.reviews.map((review, index) => <article className="member-review" key={`${review.created_at}-${index}`}><div className="member-review-heading"><div className="member-review-author"><MemberPhoto id={review.reviewer_public_id} name={review.reviewer_username} available={review.reviewer_photo_available} /><strong>@{review.reviewer_username}</strong></div><span><Star size={15} />{review.rating}/5</span></div><p>{review.comment || "A rating was left without a written comment."}</p><small>{new Date(review.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</small></article>) : <p>No completed-task reviews yet.</p>}</section>
  </main>;
}

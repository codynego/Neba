import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Star } from "lucide-react";
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

  return <main className="listing-page container">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
    <Link className="back-link" href="/">Back to GetNeba</Link>
    <section className="profile-card member-profile">
      <div className="profile-header"><MemberPhoto id={member.public_id} name={member.display_name || member.username} available={member.photo_available} /><div><span className="eyebrow">YOUR NEIGHBORHOOD, CONNECTED</span><h1>{member.display_name || "Community member"}</h1><p className="member-username">@{member.username}</p><p><MapPin size={14} />{location}</p></div></div>
      <TrustBadges trust={member} />
      <div className="member-facts"><span>{availabilityLabels[member.availability]}</span><span>{member.completed_tasks} completed helper {member.completed_tasks === 1 ? "job" : "jobs"}</span></div>
      {member.bio && <p className="member-bio">{member.bio}</p>}
      <div className="skill-tags">{member.skills.map((skill) => <span className="category-pill" key={skill}>{categories.find((category) => category.value === skill)?.label}</span>)}</div>
      <p className="form-note">Skills and availability are provided by the member. Verification is not a guarantee of safe behaviour.</p>
      <SafetyActions member={member.id} name={member.display_name} />
    </section>
    <section className="member-section"><h2>How I can help</h2>{member.offers.length ? <div className="offer-grid">{member.offers.map((offer) => <OfferCard key={offer.id} offer={offer} />)}</div> : <p>No active skill offers yet.</p>}</section>
    <section className="member-section"><h2>Completed-task reviews</h2>{member.reviews.length ? member.reviews.map((review, index) => <article className="member-review" key={`${review.created_at}-${index}`}><div className="member-review-heading"><div className="member-review-author"><MemberPhoto id={review.reviewer_public_id} name={review.reviewer_username} available={review.reviewer_photo_available} /><strong>@{review.reviewer_username}</strong></div><span><Star size={15} />{review.rating}/5</span></div><p>{review.comment || "A rating was left without a written comment."}</p><small>{new Date(review.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</small></article>) : <p>No completed-task reviews yet.</p>}</section>
  </main>;
}

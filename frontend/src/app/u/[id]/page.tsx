"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { MapPin, Star } from "lucide-react";
import { api } from "@/lib/api";
import { MemberProfile, categories, availabilityLabels } from "@/lib/types";
import { MemberPhoto, TrustBadges } from "@/components/trust";
import { OfferCard } from "@/components/offer-card";
import { SafetyActions } from "@/components/safety-actions";

export default function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setMember(null);
    setError("");
    api<MemberProfile>(`/auth/members/${id}/`, { signal: controller.signal })
      .then(setMember)
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      });
    return () => controller.abort();
  }, [id]);

  return <main className="listing-page container"><Link className="back-link" href="/offers">Back to helpers</Link>{error ? <p className="error-box" role="alert">{error}</p> : !member ? <p role="status">Loading profile...</p> : <><section className="profile-card member-profile"><div className="profile-header"><MemberPhoto id={member.id} name={member.display_name || "N"} available={member.photo_available} /><div><span className="eyebrow">YOUR NEIGHBORHOOD, CONNECTED</span><h1>{member.display_name || "Community member"}</h1><p><MapPin size={14} />{[member.neighborhood, member.city, member.state].filter(Boolean).join(", ")}</p></div></div><TrustBadges trust={member} /><div className="member-facts"><span>{availabilityLabels[member.availability]}</span><span>{member.completed_tasks} completed helper {member.completed_tasks === 1 ? "job" : "jobs"}</span></div>{member.bio && <p className="member-bio">{member.bio}</p>}<div className="skill-tags">{member.skills.map((skill) => <span className="category-pill" key={skill}>{categories.find((category) => category.value === skill)?.label}</span>)}</div><p className="form-note">Skills and availability are provided by the member. Verification is not a guarantee of safe behaviour.</p><SafetyActions member={member.id} name={member.display_name} /></section><section className="member-section"><h2>How I can help</h2>{member.offers.length ? <div className="offer-grid">{member.offers.map((offer) => <OfferCard key={offer.id} offer={offer} />)}</div> : <p>No active skill offers yet.</p>}</section><section className="member-section"><h2>Completed-task reviews</h2>{member.reviews.length ? member.reviews.map((review, index) => <article className="member-review" key={`${review.created_at}-${index}`}><span><Star size={15} />{review.rating}/5</span><p>{review.comment || "A rating was left without a written comment."}</p><small>{new Date(review.created_at).toLocaleDateString("en-NG")}</small></article>) : <p>No completed-task reviews yet.</p>}</section></>}</main>;
}

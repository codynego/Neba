"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, ShieldCheck, Phone, Star } from "lucide-react";
import { api, BASE, getToken } from "@/lib/api";
import { Trust, User } from "@/lib/types";

export function TrustBadges({ trust }: { trust?: Trust }) {
  if (!trust) return null;
  return <div className="trust-badges">{trust.identity_verified ? <span title="An admin reviewed the submitted ID and camera photos. This is not a background check."><ShieldCheck size={14} />Identity manually reviewed</span> : trust.phone_verified ? <span><Phone size={13} />Phone verified</span> : trust.profile_complete ? <span><CheckCircle2 size={14} />Profile complete</span> : <span className="trust-unverified">Profile incomplete</span>}{!!trust.review_count && <span><Star size={13} />{trust.rating?.toFixed(1)} ({trust.review_count} {trust.review_count === 1 ? "review" : "reviews"})</span>}</div>;
}

export function MemberPhoto({ id, name, available }: { id: number | string; name: string; available?: boolean }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const token = getToken();
    if (!available || !token) return;
    const controller = new AbortController();
    let objectUrl = "";
    fetch(`${BASE}/auth/members/${id}/photo/`, { headers: { Authorization: `Token ${token}` }, signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        if (response.headers.get("content-type")?.includes("application/json")) {
          const data = await response.json() as { url?: string };
          if (!controller.signal.aborted && data.url) setUrl(data.url);
          return;
        }
        const blob = await response.blob();
        if (!controller.signal.aborted) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }
      }).catch(() => {});
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); setUrl(""); };
  }, [id, available]);
  return <span className="member-photo">{url ? /* Authenticated blob URLs cannot use the image optimizer. */ <img src={url} alt={`${name}'s reviewed profile photo`} /> : name.charAt(0).toUpperCase()}</span>;
}

export function VerificationGate({ helper = false }: { helper?: boolean }) {
  const [needed, setNeeded] = useState(false);
  useEffect(() => { if (!getToken()) return; api<User>("/auth/me/").then((user) => setNeeded(!user.profile_complete)).catch(() => {}); }, [helper]);
  return needed ? <div className="verification-notice"><ShieldCheck size={22} /><div><strong>Complete your profile before continuing</strong><p>Add your phone number, profile picture, and location so neighbors know who and where they are connecting with.</p><Link href="/profile" target="_blank" rel="noopener" className="text-link">Complete profile in a new tab</Link><small>Your draft stays in this tab. Return after saving your profile to submit it.</small></div></div> : null;
}

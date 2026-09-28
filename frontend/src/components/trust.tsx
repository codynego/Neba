"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ShieldCheck, Phone, Star } from "lucide-react";
import { api, BASE, getToken } from "@/lib/api";
import { Trust, User } from "@/lib/types";

export function TrustBadges({ trust }: { trust?: Trust }) {
  if (!trust) return null;
  return <div className="trust-badges">{trust.identity_verified ? <span title="An admin reviewed the submitted ID and camera photos. This is not a background check."><ShieldCheck size={14} />Identity manually reviewed</span> : trust.phone_verified ? <span><Phone size={13} />Phone verified</span> : <span className="trust-unverified">Not verified yet</span>}{!!trust.review_count && <span><Star size={13} />{trust.rating?.toFixed(1)} ({trust.review_count} {trust.review_count === 1 ? "review" : "reviews"})</span>}</div>;
}

export function MemberPhoto({ id, name, available }: { id: number; name: string; available?: boolean }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const token = getToken();
    if (!available || !token) return;
    const controller = new AbortController();
    let objectUrl = "";
    fetch(`${BASE}/auth/members/${id}/photo/`, { headers: { Authorization: `Token ${token}` }, signal: controller.signal, cache: "no-store" })
      .then(async (response) => { if (response.ok) { const blob = await response.blob(); if (!controller.signal.aborted) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); } } }).catch(() => {});
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); setUrl(""); };
  }, [id, available]);
  return <span className="member-photo">{url ? /* Authenticated blob URLs cannot use the image optimizer. */ <img src={url} alt={`${name}'s reviewed profile photo`} /> : name.charAt(0).toUpperCase()}</span>;
}

export function VerificationGate({ helper = false }: { helper?: boolean }) {
  const [needed, setNeeded] = useState(false);
  useEffect(() => { if (!getToken()) return; api<User>("/auth/me/").then((user) => setNeeded(helper ? !user.identity_verified : !user.phone_verified)).catch(() => {}); }, [helper]);
  return needed ? <div className="verification-notice"><ShieldCheck size={22} /><div><strong>{helper ? "Verify your identity before offering help" : "Verify your phone before posting"}</strong><p>{helper ? "Phone, ID, and camera photos are reviewed before you can offer or accept work." : "Confirm your number so your chosen helper can coordinate with you."}</p><Link href="/verify" target="_blank" rel="noopener" className="text-link">Start verification in a new tab</Link><small>Your draft stays in this tab. Return after verification to submit it.</small></div></div> : null;
}

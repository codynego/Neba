"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, MapPin } from "lucide-react";
import { api, clearToken, getToken } from "@/lib/api";
import { Offer, Page, Task, User } from "@/lib/types";
import { ProfileEditor } from "@/components/profile-editor";
import { MemberPhoto, TrustBadges } from "@/components/trust";
import { PushNotificationSettings } from "@/components/push-notifications";
export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [taskCount, setTaskCount] = useState(0);
  const [offerCount, setOfferCount] = useState(0);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!getToken()) { router.replace("/login?next=/profile"); return; }
    const controller = new AbortController();
    const options = { signal: controller.signal };
    Promise.all([api<User>("/auth/me/", options), api<Page<Task>>("/tasks/?mine=true", options), api<Page<Offer>>("/offers/?mine=true", options)]).then(([me, mine, services]) => { setUser(me); setTaskCount(mine.count); setOfferCount(services.count); setOffers(services.results); }).catch((err) => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [router]);
  return <main className="listing-page container">{error ? <p className="error-box" role="alert">{error}</p> : user ? <section className="profile-card"><div className="profile-header"><MemberPhoto id={user.id} name={user.display_name || user.username} available={user.photo_available} /><div><span className="eyebrow">YOUR NEBA PROFILE</span><h1>{user.display_name || user.username}</h1><p><MapPin size={13} />{[user.neighborhood, user.city, user.state].filter(Boolean).join(", ") || "Your neighborhood awaits"}</p></div></div><div className="profile-stats"><div><strong>{taskCount}</strong><span>Tasks you’ve posted</span></div><div><strong>{offerCount}</strong><span>Skill offers you’ve shared</span></div></div><TrustBadges trust={user} /><div className="profile-trust-links"><Link href="/safety" className="text-link">Safety center</Link></div><Link className="text-link" href={`/u/${user.username}`}>View your member profile</Link><ProfileEditor user={user} onSaved={setUser} /><PushNotificationSettings /><h2>How you can help</h2>{offers.filter((offer) => offer.active).length ? offers.filter((offer) => offer.active).map((offer) => <div className="dash-row" key={offer.id}><Link href={`/offers/${offer.public_id || offer.id}`}><strong>{offer.title}</strong><p>{offer.city}</p></Link><ArrowUpRight size={17} /></div>) : <p className="form-note">Your neighbors haven’t met your skills yet. Share what you’re good at.</p>}<Link href="/offers/new" className="button button-dark">Offer your skills<ArrowUpRight size={17} /></Link><button className="profile-logout text-button" onClick={() => { clearToken(); router.push("/"); }}>Log out</button></section> : <div className="profile-card" role="status" aria-label="Loading profile"><div className="skeleton square" /><div className="skeleton line long" /><div className="skeleton line" /></div>}</main>;
}

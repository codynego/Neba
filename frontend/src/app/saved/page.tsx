"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Bookmark } from "lucide-react";
import { api } from "@/lib/api";
import { Page, SavedOpportunity } from "@/lib/types";
export default function SavedPage() { const [items, setItems] = useState<SavedOpportunity[]>([]); useEffect(() => { api<Page<SavedOpportunity>>("/saved-opportunities/").then((page) => setItems(page.results)).catch(() => {}); }, []); return <main className="tracker-page container"><header><span className="eyebrow">YOUR SHORTLIST</span><h1>Saved for later</h1><p>Keep promising opportunities close until you are ready to act.</p></header>{items.length ? <div className="tracker-list full">{items.map((item) => <Link href={`/opportunities/${item.opportunity_id}`} key={item.id}><Bookmark size={18} /><div><strong>{item.opportunity.title}</strong><small>{item.opportunity.provider}</small></div><span className={`application-status ${item.status}`}>{item.status}</span><ArrowRight size={16} /></Link>)}</div> : <div className="radar-empty"><Bookmark size={26} /><div><strong>Your shortlist is empty.</strong><p>Save opportunities while exploring so you can return when you are ready.</p></div><Link className="button button-dark compact" href="/opportunities">Explore opportunities <ArrowRight size={15} /></Link></div>}</main>; }

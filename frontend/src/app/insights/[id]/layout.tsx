import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/seo";

type InsightProfileSeo = { name: string; profile_type: string; summary: string; country: string; location_label: string };

async function getProfile(id: string): Promise<InsightProfileSeo | null> {
  try {
    const base = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api").replace(/\/$/, "");
    const response = await fetch(`${base}/insight-profiles/${id}/`, { next: { revalidate: 900 }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    return await response.json() as InsightProfileSeo;
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) return { title: "Insight profile not found | Neba", robots: { index: false, follow: false } };
  const location = [profile.location_label, profile.country].filter(Boolean).join(" · ");
  const description = `${profile.summary || `Community insights and opportunities connected to ${profile.name}.`} ${location}`.trim().slice(0, 160);
  return publicPageMetadata(`${profile.name} — Community Insights | Neba`, description, `/insights/${id}`);
}

export default function InsightProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}

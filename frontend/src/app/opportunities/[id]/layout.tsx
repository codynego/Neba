import type { Metadata } from "next";
import { indexPublicPages, siteUrl } from "@/lib/seo";

type OpportunitySummary = { title: string; provider: string; summary: string; category: string; country: string; location_label: string; is_remote: boolean; deadline: string | null; is_published?: boolean; review_status?: string };

async function getOpportunity(id: string): Promise<OpportunitySummary | null> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
  try {
    const response = await fetch(`${apiBase}/opportunities/${id}/`, { next: { revalidate: 300 } });
    return response.ok ? response.json() : null;
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const opportunity = await getOpportunity(id);
  if (!opportunity) return { title: "Opportunity not found", robots: { index: false, follow: false } };
  const location = opportunity.is_remote ? "Remote" : opportunity.location_label || opportunity.country || "Open location";
  const description = `${opportunity.summary.slice(0, 145)}${opportunity.summary.length > 145 ? "…" : ""}`;
  return { title: `${opportunity.title} · ${opportunity.provider}`, description, alternates: { canonical: new URL(`/opportunities/${id}`, siteUrl).toString() }, robots: { index: indexPublicPages, follow: true, "max-image-preview": "large" }, openGraph: { title: opportunity.title, description, type: "article", url: new URL(`/opportunities/${id}`, siteUrl).toString(), siteName: "GetNeba", locale: "en_NG" }, keywords: [opportunity.category, opportunity.provider, location, "opportunities", "GetNeba"] };
}

export default function OpportunityDetailLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }

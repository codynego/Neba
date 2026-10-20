import type { Metadata } from "next";
import { opportunityIdFromRoute, opportunityPath } from "@/lib/routes";
import { indexPublicPages, publicPageMetadata } from "@/lib/seo";

type OpportunitySeoRecord = {
  public_id: string;
  title: string;
  provider: string;
  summary: string;
  category: string;
  deadline: string | null;
  location_label: string;
  country: string;
  is_remote: boolean;
  application_mode: "internal" | "external";
  is_published?: boolean;
};

async function getOpportunity(id: string): Promise<OpportunitySeoRecord | null> {
  const apiBase = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api").replace(/\/$/, "");
  try {
    const response = await fetch(`${apiBase}/opportunities/${opportunityIdFromRoute(id)}/`, { next: { revalidate: 900 }, signal: AbortSignal.timeout(5000) });
    return response.ok ? await response.json() as OpportunitySeoRecord : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const opportunity = await getOpportunity(id);
  if (!opportunity) {
    return { title: "Opportunity not found", robots: { index: false, follow: false } };
  }
  const canonical = opportunityPath(opportunity.title, opportunity.public_id);
  const location = opportunity.is_remote ? "Remote" : opportunity.location_label || opportunity.country || "See eligibility details";
  const description = `${opportunity.summary || `Explore this ${opportunity.category} opportunity from ${opportunity.provider}.`} ${location}. Review eligibility, deadline, and how to apply on Neba.`.replace(/\s+/g, " ").slice(0, 160);
  const metadata = publicPageMetadata(`${opportunity.title} — ${opportunity.provider} | Neba Opportunities`, description, canonical);
  return { ...metadata, robots: { index: indexPublicPages, follow: true, "max-image-preview": "large" } };
}

export default function OpportunityLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}

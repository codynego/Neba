import type { Metadata } from "next";
import { indexPublicPages, jsonLd, siteUrl } from "@/lib/seo";
import { opportunityIdFromRoute, opportunityPath } from "@/lib/routes";

type OpportunitySummary = { public_id: string; title: string; provider: string; summary: string; category: string; country: string; location_label: string; is_remote: boolean; deadline: string | null; benefit?: string; eligibility_notes?: string; source_url?: string; updated_at?: string; is_published?: boolean; review_status?: string };

async function getOpportunity(id: string): Promise<OpportunitySummary | null> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
  try {
    const response = await fetch(`${apiBase}/opportunities/${id}/`, { next: { revalidate: 300 } });
    return response.ok ? response.json() : null;
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const opportunity = await getOpportunity(opportunityIdFromRoute(id));
  if (!opportunity) return { title: "Opportunity not found", robots: { index: false, follow: false } };
  const location = opportunity.is_remote ? "Remote" : opportunity.location_label || opportunity.country || "Open location";
  const description = `${opportunity.summary.slice(0, 145)}${opportunity.summary.length > 145 ? "…" : ""}`;
  const canonicalPath = opportunityPath(opportunity.title, opportunity.public_id);
  return { title: `${opportunity.title} | Getneba`, description, alternates: { canonical: new URL(canonicalPath, siteUrl).toString() }, robots: { index: indexPublicPages, follow: true, "max-image-preview": "large" }, openGraph: { title: `${opportunity.title} | Getneba`, description, type: "article", url: new URL(canonicalPath, siteUrl).toString(), siteName: "Getneba", locale: "en_NG", images: [{ url: new URL("/brand/getneba-social-preview-1200x630.png", siteUrl).toString(), width: 1200, height: 630, alt: `${opportunity.title} on Getneba` }] }, twitter: { card: "summary_large_image", title: `${opportunity.title} | Getneba`, description, images: [new URL("/brand/getneba-social-preview-1200x630.png", siteUrl).toString()] }, keywords: [opportunity.category, opportunity.provider, location, "opportunities", "Getneba"] };
}

export default async function OpportunityDetailLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const opportunity = await getOpportunity(opportunityIdFromRoute(id));
  if (!opportunity) return children;
  const canonical = new URL(opportunityPath(opportunity.title, opportunity.public_id), siteUrl).toString();
  const location = opportunity.is_remote ? "Remote" : opportunity.location_label || opportunity.country || "Open location";
  const schema: Record<string, unknown> = { "@context": "https://schema.org", "@graph": [
    { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: siteUrl.toString() }, { "@type": "ListItem", position: 2, name: "Opportunities", item: new URL("/opportunities", siteUrl).toString() }, { "@type": "ListItem", position: 3, name: opportunity.title, item: canonical }] },
    { "@type": "WebPage", "@id": canonical, url: canonical, name: opportunity.title, description: opportunity.summary, isPartOf: { "@id": new URL("/#website", siteUrl).toString() }, dateModified: opportunity.updated_at },
  ] };
  if (opportunity.category === "job") schema["@graph"] = [...schema["@graph"] as unknown[], { "@type": "JobPosting", title: opportunity.title, description: opportunity.summary, hiringOrganization: { "@type": "Organization", name: opportunity.provider }, datePosted: opportunity.updated_at, validThrough: opportunity.deadline, applicantLocationRequirements: location === "Remote" ? { "@type": "Country", name: "Nigeria" } : undefined, jobLocationType: location === "Remote" ? "TELECOMMUTE" : undefined }];
  return <><article className="seo-opportunity-summary container"><nav aria-label="Breadcrumb"><a href="/">Home</a><span> / </span><a href="/opportunities">Opportunities</a><span> / </span><span>{opportunity.title}</span></nav><h1>{opportunity.title}</h1><p>{opportunity.provider} · {location} · {opportunity.category}</p><p>{opportunity.summary}</p>{opportunity.deadline && <p><strong>Deadline:</strong> {new Intl.DateTimeFormat("en-NG", { dateStyle: "long" }).format(new Date(opportunity.deadline))}</p>} {opportunity.eligibility_notes && <p><strong>Eligibility:</strong> {opportunity.eligibility_notes}</p>}{opportunity.source_url && <p><strong>Official source:</strong> <a href={opportunity.source_url} rel="nofollow">View provider details</a></p>}</article><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />{children}</>;
}

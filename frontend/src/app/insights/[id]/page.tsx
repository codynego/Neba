import { notFound } from "next/navigation";
import { jsonLd, siteUrl } from "@/lib/seo";
import type { OpportunityProfile } from "@/lib/types";
import { opportunityPath } from "@/lib/routes";
import { InsightProfileView } from "@/components/insight-profile-view";

async function getProfile(id: string): Promise<OpportunityProfile | null> {
  try {
    const base = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api").replace(/\/$/, "");
    const response = await fetch(`${base}/insight-profiles/${id}/`, { next: { revalidate: 900 }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    return await response.json() as OpportunityProfile;
  } catch { return null; }
}

export default async function InsightProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) notFound();
  const profileUrl = new URL(`/insights/${profile.public_id}`, siteUrl).toString();
  const profileType = profile.profile_type === "school" ? "EducationalOrganization" : "Organization";
  const description = profile.summary || `Community insights, opportunities, and practical context about ${profile.name}.`;
  const structuredData = { "@context": "https://schema.org", "@graph": [
    { "@type": "ProfilePage", "@id": `${profileUrl}#profile-page`, url: profileUrl, name: `${profile.name} — Community Insights`, description, mainEntity: { "@id": `${profileUrl}#organization` }, isPartOf: { "@id": new URL("/insights", siteUrl).toString() } },
    { "@type": profileType, "@id": `${profileUrl}#organization`, name: profile.name, description, url: profile.website || profileUrl, location: [profile.location_label, profile.country].filter(Boolean).join(" · ") || undefined, sameAs: profile.website ? [profile.website] : undefined },
    { "@type": "ItemList", name: `Opportunities connected to ${profile.name}`, numberOfItems: profile.opportunities.length, itemListElement: profile.opportunities.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.title, url: new URL(opportunityPath(item.title, item.public_id), siteUrl).toString() })) },
    { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Neba Insights", item: new URL("/insights", siteUrl).toString() }, { "@type": "ListItem", position: 2, name: profile.name, item: profileUrl }] },
    { "@type": "FAQPage", mainEntity: [{ "@type": "Question", name: `What is ${profile.name}?`, acceptedAnswer: { "@type": "Answer", text: description } }, { "@type": "Question", name: `What opportunities are available through ${profile.name}?`, acceptedAnswer: { "@type": "Answer", text: profile.opportunities.length ? `${profile.name} has ${profile.opportunities.length} published opportunity${profile.opportunities.length === 1 ? "" : "ies"} listed on Neba. Review each opportunity's requirements and official source before applying.` : `Neba does not currently have a published opportunity linked to ${profile.name}.` } }, { "@type": "Question", name: `What do people say about ${profile.name}?`, acceptedAnswer: { "@type": "Answer", text: profile.insight_count ? `Neba has ${profile.insight_count} community insight${profile.insight_count === 1 ? "" : "s"} about ${profile.name}. These are community contributions and should be considered alongside the provider's official information.` : `There are no published community insights about ${profile.name} yet.` } }] },
  ] };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} /><InsightProfileView initialProfile={profile} profileId={id} /></>;
}

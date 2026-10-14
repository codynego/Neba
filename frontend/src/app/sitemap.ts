import type { MetadataRoute } from "next";
import { indexPublicPages, publicSearchPaths, siteUrl } from "@/lib/seo";
import { opportunityPath } from "@/lib/routes";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!indexPublicPages) return [];
  const entries: MetadataRoute.Sitemap = publicSearchPaths.map((path) => ({ url: new URL(path, siteUrl).toString() }));
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
  try {
    type OpportunitySitemapItem = { public_id: string; title: string; category: string; updated_at?: string; created_at?: string; deadline?: string | null };
    type OpportunityPage = { count?: number; next?: string | null; results?: OpportunitySitemapItem[] };
    let page = 1;
    let nextPage = true;
    while (nextPage && page <= 500) {
      const response = await fetch(`${apiBase}/opportunities/?page=${page}`, { next: { revalidate: 900 }, signal: AbortSignal.timeout(5000) });
      if (!response.ok) break;
      const data = await response.json() as OpportunityPage;
      const results = data.results || [];
      for (const opportunity of results) {
        entries.push({
          url: new URL(opportunityPath(opportunity.title, opportunity.public_id), siteUrl).toString(),
          lastModified: opportunity.updated_at || opportunity.created_at,
          changeFrequency: opportunity.deadline && new Date(opportunity.deadline) > new Date() ? "daily" : "weekly",
          priority: 0.8,
        });
      }
      nextPage = Boolean(data.next) || (typeof data.count === "number" && results.length > 0 && page * results.length < data.count);
      page += 1;
    }
  } catch { /* Keep the static sitemap available if the API is temporarily unavailable. */ }
  return entries;
}

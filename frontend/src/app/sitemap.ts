import type { MetadataRoute } from "next";
import { indexPublicPages, publicSearchPaths, siteUrl } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!indexPublicPages) return [];
  const entries: MetadataRoute.Sitemap = publicSearchPaths.map((path) => ({ url: new URL(path, siteUrl).toString() }));
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
  try {
    const response = await fetch(`${apiBase}/opportunities/?page_size=1000`, { next: { revalidate: 900 } });
    if (response.ok) {
      const data = await response.json() as { results?: { public_id: string; updated_at?: string; created_at?: string }[] };
      for (const opportunity of data.results || []) entries.push({ url: new URL(`/opportunities/${opportunity.public_id}`, siteUrl).toString(), lastModified: opportunity.updated_at || opportunity.created_at });
    }
  } catch { /* Keep the static sitemap available if the API is temporarily unavailable. */ }
  return entries;
}

import type { MetadataRoute } from "next";
import { indexPublicPages, publicSearchPaths, siteUrl } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!indexPublicPages) return [];
  const entries: MetadataRoute.Sitemap = publicSearchPaths.map((path) => ({ url: new URL(path, siteUrl).toString() }));
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
  try {
    const response = await fetch(`${apiBase}/opportunities/?page_size=1000`, { next: { revalidate: 900 } });
    if (response.ok) {
      const data = await response.json() as { results?: { public_id: string; category: string; updated_at?: string; created_at?: string }[] };
      const categories = new Set<string>();
      for (const opportunity of data.results || []) { categories.add(opportunity.category); entries.push({ url: new URL(`/opportunities/${opportunity.public_id}`, siteUrl).toString(), lastModified: opportunity.updated_at || opportunity.created_at }); }
      const categoryPaths: Record<string, string> = { job: "/opportunities/jobs", scholarship: "/opportunities/scholarships", grant: "/opportunities/grants", internship: "/opportunities/internships", fellowship: "/opportunities/fellowships", startup: "/opportunities/startup" };
      for (const category of categories) if (categoryPaths[category]) entries.push({ url: new URL(categoryPaths[category], siteUrl).toString() });
    }
  } catch { /* Keep the static sitemap available if the API is temporarily unavailable. */ }
  return entries;
}

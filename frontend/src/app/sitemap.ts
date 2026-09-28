import type { MetadataRoute } from "next";
import { indexPublicPages, publicSearchPaths, siteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return indexPublicPages ? publicSearchPaths.map((path) => ({ url: new URL(path, siteUrl).toString() })) : [];
}

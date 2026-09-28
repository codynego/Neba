import type { MetadataRoute } from "next";
import { indexPublicPages, siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  if (!indexPublicPages) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    // Private routes remain crawlable so their noindex directives can be read.
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin/"] },
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
  };
}

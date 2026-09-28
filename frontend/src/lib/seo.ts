import type { Metadata } from "next";

const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://neba.com";
export const siteUrl = new URL(configuredUrl);
if (siteUrl.protocol !== "https:" || siteUrl.username || siteUrl.password || siteUrl.pathname !== "/" || siteUrl.search || siteUrl.hash) {
  throw new Error("NEXT_PUBLIC_SITE_URL must be an HTTPS origin, for example https://neba.com.");
}
export const indexPublicPages = process.env.NODE_ENV === "production" && process.env.SEO_INDEXABLE !== "false" && (!process.env.VERCEL_ENV || process.env.VERCEL_ENV === "production");
export const publicSearchPaths = ["/", "/local-help", "/about", "/help", "/community-guidelines", "/privacy", "/terms"];
export const siteDescription = "Find local help and paid tasks in Nigeria. Post errands, moving, tutoring, tech and event tasks, or offer your skills to people in your city.";

export function publicPageMetadata(title: string, description: string, path: string): Metadata {
  const url = new URL(path, siteUrl).toString();
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: indexPublicPages, follow: true, "max-image-preview": "large" },
    openGraph: { title, description, url, type: "website", siteName: "Neba", locale: "en_NG", images: [{ url: new URL("/opengraph-image", siteUrl).toString(), width: 1200, height: 630, alt: "Neba — local help and paid tasks in Nigeria" }] },
    twitter: { card: "summary_large_image", title, description, images: [new URL("/opengraph-image", siteUrl).toString()] },
  };
}

export function jsonLd(data: unknown) { return JSON.stringify(data).replace(/</g, "\\u003c"); }

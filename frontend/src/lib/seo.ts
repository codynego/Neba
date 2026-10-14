import type { Metadata } from "next";

const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://getneba.app";
export const siteUrl = new URL(configuredUrl);
if (siteUrl.protocol !== "https:" || siteUrl.username || siteUrl.password || siteUrl.pathname !== "/" || siteUrl.search || siteUrl.hash) {
  throw new Error("NEXT_PUBLIC_SITE_URL must be an HTTPS origin, for example https://getneba.app.");
}
export const legalLaunchDetailsReady = Boolean(
  process.env.NEXT_PUBLIC_LEGAL_OPERATOR_NAME?.trim()
  && process.env.NEXT_PUBLIC_LEGAL_OPERATOR_ADDRESS?.trim()
  && process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim(),
);

// Keep production pages out of search until the real operator and contact
// details have been supplied. This protects a pilot from accidentally being
// presented as a completed public service.
export const indexPublicPages = process.env.NODE_ENV === "production"
  && process.env.SEO_INDEXABLE !== "false"
  && legalLaunchDetailsReady
  && (!process.env.VERCEL_ENV || process.env.VERCEL_ENV === "production");
export const publicSearchPaths = ["/", "/opportunities", "/schools", "/schools/pricing", "/install", "/about", "/stories", "/help", "/community-guidelines", "/privacy", "/terms"];
export const siteDescription = "Neba is an intelligence ecosystem for education—helping schools operate better, educators teach with clarity, and learners move forward with confidence.";

export function publicPageMetadata(title: string, description: string, path: string): Metadata {
  const url = new URL(path, siteUrl).toString();
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: indexPublicPages, follow: true, "max-image-preview": "large" },
    openGraph: { title, description, url, type: "website", siteName: "Neba", locale: "en_NG", images: [{ url: new URL("/brand/getneba-social-preview-1200x630.png", siteUrl).toString(), width: 1200, height: 630, alt: "Neba — intelligence for education" }] },
    twitter: { card: "summary_large_image", title, description, images: [new URL("/brand/getneba-social-preview-1200x630.png", siteUrl).toString()] },
  };
}

export async function categoryPageMetadata(category: string, title: string, description: string, path: string): Promise<Metadata> {
  const metadata = publicPageMetadata(title, description, path);
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
    const response = await fetch(`${apiBase}/opportunities/?category=${category}&page_size=1`, { next: { revalidate: 900 } });
    const data = response.ok ? await response.json() as { results?: unknown[] } : null;
    if (!data?.results?.length) metadata.robots = { index: false, follow: true };
  } catch { metadata.robots = { index: false, follow: true }; }
  return metadata;
}

export function jsonLd(data: unknown) { return JSON.stringify(data).replace(/</g, "\\u003c"); }

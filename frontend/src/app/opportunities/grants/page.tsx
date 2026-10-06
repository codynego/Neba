import type { Metadata } from "next";
import { SeoOpportunityCategory } from "@/components/seo-opportunity-category";
import { categoryPageMetadata } from "@/lib/seo";
export async function generateMetadata() { return categoryPageMetadata("grant", "Grants for Nigerian Businesses and African Founders | GetNeba", "Find business grants and funding opportunities for Nigerian businesses, African founders, and growing organizations.", "/opportunities/grants"); }
export default function GrantsPage() { return <SeoOpportunityCategory category="grant" heading="Grants for Nigerian businesses and African founders" description="Explore verified grants and funding opportunities for businesses, founders, nonprofits, and community projects." />; }

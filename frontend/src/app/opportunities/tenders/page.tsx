import { SeoOpportunityCategory } from "@/components/seo-opportunity-category";
import { categoryPageMetadata } from "@/lib/seo";

export async function generateMetadata() { return categoryPageMetadata("tender", "Tenders and Procurement Opportunities in Nigeria and Worldwide | Neba", "Browse published tenders, procurement calls, and supplier opportunities in Nigeria, across Africa, and worldwide.", "/opportunities/tenders"); }
export default function TendersPage() { return <SeoOpportunityCategory category="tender" heading="Tenders and procurement opportunities" description="Find published tenders, procurement calls, and supplier opportunities in Nigeria, across Africa, and worldwide, with location and eligibility details for each listing." />; }

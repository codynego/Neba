import { SeoOpportunityCategory } from "@/components/seo-opportunity-category";
import { categoryPageMetadata } from "@/lib/seo";

export async function generateMetadata() { return categoryPageMetadata("tender", "Tenders and Procurement Opportunities in Nigeria and Africa | Neba", "Browse published tenders, procurement calls, and supplier opportunities for businesses and organisations across Nigeria and Africa.", "/opportunities/tenders"); }
export default function TendersPage() { return <SeoOpportunityCategory category="tender" heading="Tenders and procurement opportunities" description="Find published tenders, procurement calls, and supplier opportunities for businesses and organisations across Nigeria and Africa." />; }

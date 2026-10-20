import { SeoOpportunityCategory } from "@/components/seo-opportunity-category";
import { categoryPageMetadata } from "@/lib/seo";

export async function generateMetadata() { return categoryPageMetadata("funding", "Funding Opportunities for Nigerians and African Founders | Neba", "Find grants, funding calls, and financial support opportunities for founders, projects, and organisations across Nigeria and Africa.", "/opportunities/funding"); }
export default function FundingPage() { return <SeoOpportunityCategory category="funding" heading="Funding opportunities for founders and projects" description="Explore published funding calls, support programmes, and financial opportunities for people building businesses and projects." />; }

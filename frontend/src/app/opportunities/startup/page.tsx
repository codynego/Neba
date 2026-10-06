import type { Metadata } from "next";
import { SeoOpportunityCategory } from "@/components/seo-opportunity-category";
import { categoryPageMetadata } from "@/lib/seo";
export async function generateMetadata() { return categoryPageMetadata("startup", "Startup Opportunities for African Founders | GetNeba", "Find startup programs, accelerators, competitions, and founder opportunities for Africans.", "/opportunities/startup"); }
export default function StartupPage() { return <SeoOpportunityCategory category="startup" heading="Startup opportunities for African founders" description="Find accelerators, founder programs, startup competitions, and opportunities to build and grow across Africa." />; }

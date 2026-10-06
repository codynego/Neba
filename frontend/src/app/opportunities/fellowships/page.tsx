import type { Metadata } from "next";
import { SeoOpportunityCategory } from "@/components/seo-opportunity-category";
import { categoryPageMetadata } from "@/lib/seo";
export async function generateMetadata() { return categoryPageMetadata("fellowship", "Fellowships for Africans | GetNeba", "Find fellowships, leadership programs, and professional development opportunities for Africans.", "/opportunities/fellowships"); }
export default function FellowshipsPage() { return <SeoOpportunityCategory category="fellowship" heading="Fellowships and leadership programs for Africans" description="Explore fellowships and cohort-based programs designed for African students, professionals, builders, and leaders." />; }

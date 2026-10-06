import type { Metadata } from "next";
import { SeoOpportunityCategory } from "@/components/seo-opportunity-category";
import { categoryPageMetadata } from "@/lib/seo";
export async function generateMetadata() { return categoryPageMetadata("scholarship", "Scholarships for Nigerians and African Students | GetNeba", "Find verified scholarships for Nigerian and African students, including funded study opportunities and education support.", "/opportunities/scholarships"); }
export default function ScholarshipsPage() { return <SeoOpportunityCategory category="scholarship" heading="Scholarships for Nigerians and African students" description="Find scholarships, study funding, and education opportunities with clear eligibility information and deadlines." />; }

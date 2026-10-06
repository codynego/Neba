import type { Metadata } from "next";
import { SeoOpportunityCategory } from "@/components/seo-opportunity-category";
import { categoryPageMetadata } from "@/lib/seo";
export async function generateMetadata() { return categoryPageMetadata("internship", "Internships for Nigerians and African Students | GetNeba", "Find internships, early-career roles, and practical experience opportunities for Nigerian and African students.", "/opportunities/internships"); }
export default function InternshipsPage() { return <SeoOpportunityCategory category="internship" heading="Internships for Nigerians and African students" description="Find internships and early-career opportunities that help you build experience, skills, and professional direction." />; }

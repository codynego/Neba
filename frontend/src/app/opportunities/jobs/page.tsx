import type { Metadata } from "next";
import { SeoOpportunityCategory } from "@/components/seo-opportunity-category";
import { categoryPageMetadata } from "@/lib/seo";
export async function generateMetadata() { return categoryPageMetadata("job", "Jobs in Nigeria and Remote Jobs | GetNeba", "Find verified jobs in Nigeria and remote roles relevant to African professionals.", "/opportunities/jobs"); }
export default function JobsPage() { return <SeoOpportunityCategory category="job" heading="Jobs in Nigeria and remote jobs for Africans" description="Explore published jobs and remote roles that are relevant to people building their careers in Nigeria and across Africa." />; }

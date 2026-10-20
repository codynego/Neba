import { SeoOpportunityCategory } from "@/components/seo-opportunity-category";
import { categoryPageMetadata } from "@/lib/seo";

export async function generateMetadata() { return categoryPageMetadata("competition", "Competitions and Challenges in Nigeria and Africa | Neba", "Find competitions, challenges, prizes, and programmes for people building ideas, skills, and impact across Nigeria and Africa.", "/opportunities/competitions"); }
export default function CompetitionsPage() { return <SeoOpportunityCategory category="competition" heading="Competitions and challenges for Nigerians and Africans" description="Explore published competitions, challenges, prizes, and programmes for people with ideas, skills, and ambition." />; }

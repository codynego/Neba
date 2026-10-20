import { SeoOpportunityCategory } from "@/components/seo-opportunity-category";
import { categoryPageMetadata } from "@/lib/seo";

export async function generateMetadata() { return categoryPageMetadata("training", "Training Programmes and Courses in Nigeria and Africa | Neba", "Discover training programmes, courses, bootcamps, and learning opportunities that help Nigerians and Africans build useful skills.", "/opportunities/training"); }
export default function TrainingPage() { return <SeoOpportunityCategory category="training" heading="Training programmes and courses for your next skill" description="Find published training programmes, bootcamps, courses, and learning pathways for people across Nigeria and Africa." />; }

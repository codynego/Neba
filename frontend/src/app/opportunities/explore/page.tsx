import { OpportunityList } from "@/components/opportunity-list";
import { publicPageMetadata } from "@/lib/seo";

export const metadata = publicPageMetadata(
  "Explore scholarships, grants, jobs and programmes",
  "Browse Neba Opportunities for scholarships, grants, internships, jobs, fellowships, and education pathways.",
  "/opportunities/explore",
);

export default function ExploreOpportunitiesPage() {
  return <OpportunityList />;
}

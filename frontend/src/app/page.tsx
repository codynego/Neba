import OpportunitiesPage, { description } from "./opportunities/page";
import { publicPageMetadata } from "@/lib/seo";

export const metadata = publicPageMetadata("Find your next opportunity, together", description, "/");

export default function HomePage() {
  return <OpportunitiesPage canonicalPath="/" />;
}

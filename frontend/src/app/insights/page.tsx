import type { Metadata } from "next";
import { InsightsBrowser } from "@/components/insights-browser";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata("Neba Insights — Know Before You Apply", "Explore companies, schools, bootcamps, programmes, and training providers through community knowledge on Neba.", "/insights");

export default function InsightsPage() {
  return <InsightsBrowser />;
}

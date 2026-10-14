import { PricingClient } from "@/components/pricing-client";
import { publicPageMetadata } from "@/lib/seo";

export const metadata = publicPageMetadata(
  "Pricing",
  "Explore Neba Opportunities plans for finding, saving, and preparing for opportunities.",
  "/pricing",
);

export default function PricingPage() {
  return <PricingClient />;
}

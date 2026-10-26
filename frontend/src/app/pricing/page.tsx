import { PricingClient } from "@/components/pricing-client";
import { publicPageMetadata } from "@/lib/seo";

export const metadata = publicPageMetadata(
  "Pricing",
  "Explore Neba plans for focused learning, exam preparation, and finding opportunities.",
  "/pricing",
);

export default function PricingPage() {
  return <PricingClient />;
}

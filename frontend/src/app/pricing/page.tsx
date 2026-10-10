import type { Metadata } from "next";
import { PricingClient } from "@/components/pricing-client";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Choose how far you want GetNeba to help with your opportunity search. Start free or add deeper intelligence with GetNeba Plus.",
  robots: { index: true, follow: true },
};

export default function PricingPage() {
  return <PricingClient />;
}

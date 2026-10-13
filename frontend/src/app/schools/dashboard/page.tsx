import type { Metadata } from "next";
import { SchoolsDashboard } from "@/components/schools-dashboard";

export const metadata: Metadata = {
  title: "Pilot workspace | Neba for Schools",
  description: "Empty school workspace for Neba for Schools pilot onboarding.",
  robots: { index: false, follow: false },
};

export default function SchoolsDashboardPage() {
  return <SchoolsDashboard />;
}

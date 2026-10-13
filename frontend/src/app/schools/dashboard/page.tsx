import type { Metadata } from "next";
import { SchoolsDashboard } from "@/components/schools-dashboard";

export const metadata: Metadata = {
  title: "School workspace | Neba for Schools",
  description: "Private academic workspace for a Neba for Schools member.",
  robots: { index: false, follow: false },
};

export default function SchoolsDashboardPage() {
  return <SchoolsDashboard />;
}

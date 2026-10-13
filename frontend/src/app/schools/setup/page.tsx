import type { Metadata } from "next";
import { SchoolsSetup } from "@/components/schools-setup";

export const metadata: Metadata = { title: "Set up your school | Neba for Schools", robots: { index: false, follow: false } };

export default function SchoolsSetupPage() { return <SchoolsSetup />; }

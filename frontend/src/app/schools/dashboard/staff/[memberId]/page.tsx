import type { Metadata } from "next";
import { StaffDetail } from "@/components/school-person-detail";

export const metadata: Metadata = { title: "Staff access | Neba for Schools", robots: { index: false, follow: false } };
export default async function StaffDetailPage({ params }: { params: Promise<{ memberId: string }> }) { const { memberId } = await params; return <StaffDetail memberId={memberId} />; }

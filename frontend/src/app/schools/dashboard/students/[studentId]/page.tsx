import type { Metadata } from "next";
import { StudentDetail } from "@/components/school-person-detail";

export const metadata: Metadata = { title: "Student record | Neba for Schools", robots: { index: false, follow: false } };
export default async function StudentDetailPage({ params }: { params: Promise<{ studentId: string }> }) { const { studentId } = await params; return <StudentDetail studentId={studentId} />; }

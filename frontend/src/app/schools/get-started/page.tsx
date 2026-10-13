"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, getToken } from "@/lib/api";
export default function SchoolsGetStartedPage() {
  const router = useRouter();
  useEffect(() => { if (!getToken()) { router.replace(`/login?next=${encodeURIComponent("/schools/get-started")}`); return; } api<{ workspace: { id: number } | null }>("/schools/workspace/").then(({ workspace }) => router.replace(workspace ? "/schools/dashboard" : "/schools/setup")).catch(() => router.replace("/schools/setup")); }, [router]);
  return <main className="school-app-loading"><p>Preparing your school workspace…</p></main>;
}

"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
export default function SchoolsGetStartedPage() {
  const router = useRouter();
  useEffect(() => {
    api<{ workspace: { id: number } | null }>("/schools/workspace/")
      .then(({ workspace }) => router.replace(workspace ? "/schools/dashboard" : "/schools/setup"))
      .catch((error) => router.replace(error instanceof ApiError && error.status === 401 ? `/login?next=${encodeURIComponent("/schools/get-started")}` : "/schools/setup"));
  }, [router]);
  return <main className="school-app-loading"><p>Preparing your school workspace…</p></main>;
}

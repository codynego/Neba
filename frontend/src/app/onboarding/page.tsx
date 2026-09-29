"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding-form";
import { api, getToken } from "@/lib/api";
import { User } from "@/lib/types";

export default function OnboardingPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [nextPath, setNextPath] = useState<string | undefined>();
  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    setNextPath(new URLSearchParams(window.location.search).get("next") || undefined);
    api<User>("/auth/me/").then(setUser).catch(() => router.replace("/login"));
  }, [router]);
  if (!user) return <main className="onboarding-page container"><div className="account-check" role="status" aria-label="Loading your onboarding"><span aria-hidden="true" /></div></main>;
  return <OnboardingForm initialUser={user} nextPath={nextPath} />;
}

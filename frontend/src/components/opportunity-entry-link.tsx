"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { getToken } from "@/lib/api";

export function OpportunityEntryLink({ className }: { className: string }) {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    const sync = () => setSignedIn(Boolean(getToken()));
    sync();
    window.addEventListener("nearwork_auth", sync);
    return () => window.removeEventListener("nearwork_auth", sync);
  }, []);
  return <Link href={signedIn ? "/dashboard" : "/login?next=%2Fdashboard"} className={className}>Find your next move <ArrowUpRight size={20} /></Link>;
}

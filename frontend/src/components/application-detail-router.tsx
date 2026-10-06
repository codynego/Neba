"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { OpportunityApplication } from "@/lib/types";
import { CandidateWorkspace } from "./candidate-workspace";
import { OpportunityApplicationWorkspace } from "./opportunity-application-workspace";

export function ApplicationDetailRouter({ applicationId }: { applicationId: string }) {
  const [kind, setKind] = useState<"opportunity" | "legacy" | null>(null);
  useEffect(() => { api<OpportunityApplication>(`/opportunity-applications/${applicationId}/`).then(() => setKind("opportunity")).catch(() => setKind("legacy")); }, [applicationId]);
  if (kind === "opportunity") return <OpportunityApplicationWorkspace applicationId={applicationId} />;
  if (kind === "legacy") return <CandidateWorkspace applicationId={applicationId} />;
  return <main className="container application-workspace-page"><p role="status">Loading application...</p></main>;
}

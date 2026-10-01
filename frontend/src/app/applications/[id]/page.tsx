"use client";

import { use } from "react";
import { CandidateWorkspace } from "@/components/candidate-workspace";

export default function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <CandidateWorkspace key={id} applicationId={id} />;
}

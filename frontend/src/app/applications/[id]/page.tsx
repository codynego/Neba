"use client";

import { use } from "react";
import { OpportunityApplicationWorkspace } from "@/components/opportunity-application-workspace";

export default function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <OpportunityApplicationWorkspace key={id} applicationId={id} />;
}

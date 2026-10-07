"use client";

import { use } from "react";
import { OpportunityApplicationWorkspace } from "@/components/opportunity-application-workspace";

export default function OpportunityApplicationReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <OpportunityApplicationWorkspace key={id} applicationId={id} view="poster" />;
}

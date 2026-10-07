"use client";

import { use } from "react";
import { OpportunityApplicationMessages } from "@/components/opportunity-application-messages";

export default function OpportunityApplicationMessagesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <OpportunityApplicationMessages applicationId={id} />;
}

"use client";

import { use } from "react";
import { ApplicationDetailRouter } from "@/components/application-detail-router";

export default function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ApplicationDetailRouter key={id} applicationId={id} />;
}

import { ShieldCheck } from "lucide-react";

export function VerificationBadge({ verification }: { verification?: { kind: "neba" | "organization" | "member"; label: string } | null }) {
  if (!verification) return null;
  return <span className={`verification-badge verification-badge-${verification.kind}`} title={`${verification.label}. Getneba has reviewed this account or publisher status.`}><ShieldCheck size={13} />{verification.label}</span>;
}

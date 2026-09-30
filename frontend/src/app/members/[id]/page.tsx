import { permanentRedirect } from "next/navigation";

export default async function LegacyMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  permanentRedirect(`/u/${encodeURIComponent(id)}`);
}

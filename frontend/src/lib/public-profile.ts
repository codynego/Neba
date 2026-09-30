import "server-only";
import { MemberProfile } from "@/lib/types";

const apiBase = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api").replace(/\/$/, "");

export async function getPublicMemberProfile(identifier: string): Promise<MemberProfile | null> {
  const response = await fetch(`${apiBase}/auth/members/${encodeURIComponent(identifier)}/`, {
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Could not load public member profile (${response.status}).`);
  return response.json() as Promise<MemberProfile>;
}

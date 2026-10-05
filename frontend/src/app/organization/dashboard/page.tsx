"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Building2, CheckCircle2, FileText, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

type Organization = { name: string; organization_type: string; country: string; description: string; contact_email: string; status: "draft" | "pending" | "verified" };

const statusCopy = { draft: "Complete your profile before submitting for review.", pending: "Your organization profile is with the Getneba team for review.", verified: "Your organization is verified and ready to publish." };

export default function OrganizationDashboardPage() {
  const router = useRouter();
  const [organization, setOrganization] = useState<Organization | null>(null);
  useEffect(() => { api<Organization>("/auth/organization/").then((data) => data.name ? setOrganization(data) : router.replace("/organization/onboarding")).catch(() => router.replace("/organization/onboarding")); }, [router]);

  if (!organization) return <main className="organization-dashboard container"><div className="account-check" role="status" aria-label="Loading organization dashboard"><span aria-hidden="true" /></div></main>;
  const verified = organization.status === "verified";
  return <main className="organization-dashboard container"><header className="organization-dashboard-header"><div><span className="eyebrow">ORGANIZATION DASHBOARD</span><h1>{organization.name}</h1><p>{organization.country} · {organization.organization_type}</p></div><Link className="button button-dark" href="/organization/onboarding">Edit profile <ArrowRight size={16} /></Link></header><section className={`organization-status organization-status-${organization.status}`}><span>{organization.status === "verified" ? <CheckCircle2 size={21} /> : <ShieldCheck size={21} />}</span><div><strong>{organization.status === "verified" ? "Verified organization" : organization.status === "pending" ? "Verification in progress" : "Finish your organization profile"}</strong><p>{statusCopy[organization.status]}</p></div>{organization.status !== "verified" && <Link href="/organization/onboarding">Review profile <ArrowRight size={15} /></Link>}</section><div className="organization-dashboard-grid"><section className="organization-dashboard-card organization-publish-card"><span className="organization-card-icon"><FileText size={20} /></span><span className="eyebrow">OPPORTUNITY PIPELINE</span><h2>Share opportunities with the right people.</h2><p>Submit scholarships, grants, jobs, programs, and other opportunities. Getneba reviews each submission before it is published.</p><button className="button button-dark" type="button" disabled={!verified}>{verified ? "Create an opportunity" : "Available after verification"}<ArrowRight size={16} /></button></section><section className="organization-dashboard-card"><span className="organization-card-icon"><Building2 size={20} /></span><span className="eyebrow">ORGANIZATION PROFILE</span><h2>{organization.status === "verified" ? "Your profile is ready." : "A little more trust, first."}</h2><p>{organization.description || "Add a clear description so applicants understand who is behind your opportunities."}</p><Link className="text-link" href="/organization/onboarding">Manage profile <ArrowRight size={15} /></Link></section></div></main>;
}

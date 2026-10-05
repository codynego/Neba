"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Globe2, MapPin, ShieldCheck, UserRound } from "lucide-react";
import { api } from "@/lib/api";

type Organization = {
  name: string;
  organization_type: string;
  website: string;
  country: string;
  location: string;
  description: string;
  contact_name: string;
  contact_email: string;
};

const emptyOrganization: Organization = { name: "", organization_type: "company", website: "", country: "", location: "", description: "", contact_name: "", contact_email: "" };

export default function OrganizationOnboardingPage() {
  const router = useRouter();
  const [organization, setOrganization] = useState<Organization>(emptyOrganization);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { api<Organization>("/auth/organization/").then((data) => setOrganization({ ...emptyOrganization, ...data })).catch(() => setError("We could not load your organization setup.")); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try { const data = Object.fromEntries(new FormData(event.currentTarget)); await api("/auth/organization/", { method: "PATCH", body: JSON.stringify(data) }); router.push("/organization/dashboard"); }
    catch (submitError) { setError((submitError as Error).message); setBusy(false); }
  }

  return <main className="organization-flow container"><div className="organization-flow-rail"><span className="eyebrow">ORGANIZATION SETUP</span><strong>Step 1 of 2</strong><div className="organization-progress"><span className="active" /><span /></div><p>Tell us who is behind the opportunities you want to share.</p></div><section className="organization-form-card"><div className="organization-form-heading"><span className="organization-icon"><Building2 size={22} /></span><span className="landing-eyebrow"><ShieldCheck size={14} /> BUILT FOR TRUSTED PUBLISHERS</span><h1>Set up your organization.</h1><p>These details help Getneba review your profile before your opportunities reach matched people.</p></div><form className="organization-form" onSubmit={submit}><label><span>Organization name</span><span className="auth-input"><Building2 size={17} /><input name="name" defaultValue={organization.name} required maxLength={180} placeholder="e.g. Acme Foundation" /></span></label><label><span>Organization type</span><select name="organization_type" defaultValue={organization.organization_type} required><option value="company">Company</option><option value="university">University</option><option value="ngo">NGO / Foundation</option><option value="government">Government</option><option value="startup">Startup</option><option value="other">Other</option></select></label><div className="form-row"><label><span>Website <small>Optional</small></span><span className="auth-input"><Globe2 size={17} /><input name="website" type="url" defaultValue={organization.website} placeholder="https://example.org" /></span></label><label><span>Country</span><span className="auth-input"><MapPin size={17} /><input name="country" defaultValue={organization.country} required placeholder="Nigeria" /></span></label></div><label><span>Organization description</span><textarea name="description" defaultValue={organization.description} required maxLength={1200} placeholder="What does your organization do, and what opportunities do you offer?" /></label><div className="form-row"><label><span>Contact person</span><span className="auth-input"><UserRound size={17} /><input name="contact_name" defaultValue={organization.contact_name} required placeholder="Your name" /></span></label><label><span>Organization email</span><span className="auth-input"><input name="contact_email" type="email" defaultValue={organization.contact_email} required placeholder="hello@example.org" /></span></label></div>{error && <p className="error-box" role="alert">{error}</p>}<button className="button button-dark" disabled={busy}>{busy ? "Saving organization…" : "Continue to dashboard"}<ArrowRight size={17} /></button></form></section></main>;
}

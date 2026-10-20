"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";

export function SchoolsPilotForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await api("/auth/school-pilot-interest/", {
        method: "POST",
        body: JSON.stringify({
          school_name: data.get("school_name"),
          contact_name: data.get("contact_name"),
          role: data.get("role"),
          email: data.get("email"),
          phone: data.get("phone"),
          student_count: data.get("student_count"),
          pilot_goal: data.get("pilot_goal"),
          assessment_format: data.get("assessment_format"),
          can_provide_sample: data.get("can_provide_sample") === "on",
          consent_to_contact: data.get("consent_to_contact") === "on",
        }),
      });
      setComplete(true);
      form.reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not send your request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (complete) return <div className="schools-form-success" role="status"><CheckCircle2 size={28} /><div><strong>Your pilot request is in.</strong><p>Next, we will review your school context, contact you, and agree on one class or subject for the first workflow.</p></div></div>;

  return <form className="schools-pilot-form" onSubmit={submit}>
    <div className="schools-form-row"><label><span>School name</span><input name="school_name" required maxLength={180} autoComplete="organization" /></label><label><span>Your name</span><input name="contact_name" required maxLength={120} autoComplete="name" /></label></div>
    <div className="schools-form-row"><label><span>Your role</span><select name="role" required defaultValue=""><option value="" disabled>Select your role</option><option>Proprietor / owner</option><option>Principal</option><option>Head of academics</option><option>Teacher</option><option>Other school leader</option></select></label><label><span>Number of students</span><select name="student_count" required defaultValue=""><option value="" disabled>Select a range</option><option value="under_100">Under 100</option><option value="100_299">100-299</option><option value="300_599">300-599</option><option value="600_999">600-999</option><option value="1000_plus">1,000+</option></select></label></div>
    <div className="schools-form-row"><label><span>What should the pilot help with?</span><select name="pilot_goal" required defaultValue=""><option value="" disabled>Choose a starting goal</option><option value="class_performance">Understand class performance</option><option value="assessment_workflow">Set up assessment workflows</option><option value="import_results">Import existing results</option><option value="teacher_support">Support teachers with teaching insights</option></select></label><label><span>How are results kept today?</span><select name="assessment_format" required defaultValue=""><option value="" disabled>Choose your current format</option><option value="spreadsheet">Spreadsheet</option><option value="paper_spreadsheet">Paper and spreadsheet</option><option value="school_system">Another school system</option><option value="not_sure">Not sure yet</option></select></label></div>
    <div className="schools-form-row"><label><span>Work email</span><input name="email" type="email" maxLength={254} autoComplete="email" placeholder="you@school.edu" /></label><label><span>Phone number</span><input name="phone" type="tel" maxLength={32} autoComplete="tel" placeholder="Optional if email is provided" /></label></div>
    <label className="schools-check"><input name="can_provide_sample" type="checkbox" /><span>Our school can provide a sample assessment spreadsheet for the pilot.</span></label>
    <label className="schools-check"><input name="consent_to_contact" type="checkbox" required /><span>Neba may contact me about this pilot. See the <Link href="/privacy">privacy notice</Link>.</span></label>
    {error && <p className="schools-form-error" role="alert">{error}</p>}
    <button className="schools-button schools-button-light" disabled={busy}>{busy ? "Sending request..." : "Request a pilot"}<ArrowRight size={18} /></button>
    <small>No purchase commitment. We will first check whether the pilot fits your school.</small>
  </form>;
}

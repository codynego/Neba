# GetNeba legal launch checklist

The product copy and controls reduce obvious legal risk, but they do not replace advice from a Nigerian lawyer or a licensed Data Protection Compliance Organisation. Complete this checklist before opening GetNeba beyond a limited test group.

## Required operator details

- Confirm the registered individual or company that operates GetNeba.
- Set `NEXT_PUBLIC_LEGAL_OPERATOR_NAME`, `NEXT_PUBLIC_LEGAL_OPERATOR_ADDRESS`, and `NEXT_PUBLIC_LEGAL_CONTACT_EMAIL` in the production frontend environment.
- Keep the privacy/legal inbox monitored and document the response workflow.
- Confirm whether a Data Protection Officer is required and publish that contact where applicable.

## Data protection

- Map every production data flow, including frontend/backend hosting, database, logs, Cloudflare R2, Twilio Verify, email, monitoring, backups, and staff access.
- Record each purpose, data category, lawful basis, recipient, processing country, transfer safeguard, retention period, and deletion method.
- Obtain processor agreements and document any processing outside Nigeria.
- Complete a Data Protection Impact Assessment before collecting real identity documents, face/gesture images, precise coordinates, or other high-risk data.
- Determine whether GetNeba is a Data Controller or Processor of Major Importance and complete NDPC registration/audit duties if applicable.
- Schedule `python manage.py purge_verification_evidence` daily and separately configure backup expiry/deletion.
- Test access, correction, export, objection, consent withdrawal, account deletion, breach response, and regulator-complaint workflows.
- Confirm that only trained, specifically authorized reviewers can access identity evidence and that access/audit logs are reviewed.

## Terms and consumer protection

- Have Nigerian counsel review the marketplace-role, payment, consumer-rights, liability, moderation, governing-law, and dispute provisions.
- Decide whether existing members must accept version `2026-09-30`; new registrations now record acceptance time and version.
- Define a customer-support and complaint-resolution process with target response times and escalation to the FCCPC where appropriate.
- Confirm the cancellation, refund, transaction-record, tax, insurance, licensing, and incident-handling responsibilities that apply to the final business model.
- Ensure marketing, badges, safety claims, prices, and availability claims are accurate and can be substantiated.

## Product and operations

- Do not enable real SMS or identity collection until the operator details, processor list, DPIA, retention job, staff security, and incident process are complete.
- Test that public profiles never expose phone numbers, saved addresses, coordinates, identity evidence, private messages, or private reports.
- Test the public-photo control for onboarding, profile editing, reviews, and public profiles.
- Keep policy versions and acceptance evidence immutable enough to demonstrate which terms a member accepted.
- Review the policies whenever product behaviour, providers, data uses, safety limits, or law changes.

## Official references used for the 2026-09-30 draft

- Nigeria Data Protection Act 2023 and NDP Act General Application and Implementation Directive 2025 (Nigeria Data Protection Commission).
- Federal Competition and Consumer Protection Act 2018 and FCCPC consumer-rights/complaint guidance.

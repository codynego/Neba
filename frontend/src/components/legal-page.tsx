import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, ExternalLink, ShieldCheck } from "lucide-react";

const POLICY_DATE = "30 September 2026";
const operatorName = process.env.NEXT_PUBLIC_LEGAL_OPERATOR_NAME?.trim();
const operatorAddress = process.env.NEXT_PUBLIC_LEGAL_OPERATOR_ADDRESS?.trim();
const legalEmail = process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim();

type LegalSection = { id: string; title: string; content: ReactNode };

const privacySections: LegalSection[] = [
  {
    id: "scope",
    title: "1. Who this notice applies to",
    content: <><p>This notice explains how the operator of GetNeba collects and uses personal data when people visit the public website, create an account, publish a profile, post or apply for tasks, offer skills, exchange messages, complete verification, leave reviews, or use safety tools.</p><p>For purposes of the Nigeria Data Protection Act 2023, the GetNeba operator is the data controller for this processing. The controller details appear in “Contact and complaints” below.</p></>,
  },
  {
    id: "data-collected",
    title: "2. Information GetNeba collects",
    content: <><ul><li><strong>Account and profile:</strong> username, email, display name, password hash, phone number, profile photo, biography, skills, availability, and account status.</li><li><strong>Location:</strong> address or landmark, neighborhood, city, state, and optional coordinates supplied by the member or device.</li><li><strong>Marketplace activity:</strong> tasks, offers, applications, invitations, agreed timing and rewards, booking changes, messages, reviews, notifications, blocks, disputes, no-show reports, and safety reports.</li><li><strong>Verification:</strong> SMS challenge records; declared legal name; document type and image; live portrait and prompted gesture image; consent, adult-confirmation, review decision, reviewer, and audit records.</li><li><strong>Technical and security data:</strong> authentication token stored in the browser, standard request information such as IP address and user agent that hosting or security systems may log, and a small public offline cache used by the installable web app.</li></ul><p>Do not place phone numbers, passwords, financial-account details, identity documents, or exact home addresses in public text, reviews, or task descriptions.</p></>,
  },
  {
    id: "purposes",
    title: "3. Why the information is used",
    content: <><p>GetNeba uses this information to create and secure accounts; provide public profiles and signed-in marketplace features; match activity by location; verify phone numbers and helper identities; enable applications, bookings and private coordination; show eligible reviews; operate reporting, blocking and moderation; prevent fraud and abuse; communicate service updates; troubleshoot and improve the service; and comply with lawful obligations.</p><p>GetNeba does not sell personal data or use identity evidence for advertising.</p></>,
  },
  {
    id: "legal-bases",
    title: "4. Legal bases",
    content: <><p>Depending on the activity, processing is based on performance of the service agreement, steps requested before entering an agreement, GetNeba’s legitimate interests in operating a safe and reliable marketplace, compliance with legal obligations, protection of vital interests in a genuine emergency, or consent where the law requires it.</p><p>Consent is requested separately for identity evidence and for publishing an approved portrait. A member may hide their profile photo or withdraw identity consent, although helper features that require verification will then be unavailable. Withdrawal does not make earlier lawful processing unlawful.</p></>,
  },
  {
    id: "visibility",
    title: "5. What other people can see",
    content: <><ul><li><strong>Public profile:</strong> the <code>/u/username</code> page can be viewed without signing in and may appear in search engines. It may show display name, username, area, city, state, biography, self-reported skills and availability, verification status, completed-helper count, active offers, visible reviews, and a photo only when public-photo visibility is enabled.</li><li><strong>Reviews:</strong> a visible completed-task review shows its author’s username and, if enabled, profile photo. The author details are displayed as attribution and are not linked from the review.</li><li><strong>Signed-in marketplace:</strong> tasks, offers, applications and related member summaries are shown according to product access and blocking rules.</li><li><strong>Accepted work:</strong> an accepted participant can receive the other participant’s contact phone. Participants decide what additional address or coordination details to share in their private conversation.</li></ul><p>Blocking prevents new marketplace interactions and hides listings in both directions, but it does not remove a public profile from the open web or erase an existing agreement or record.</p></>,
  },
  {
    id: "sharing",
    title: "6. Service providers and lawful disclosure",
    content: <><p>GetNeba shares only the information needed with providers that support hosting, databases, private media storage, SMS delivery, security, and maintenance. Current product integrations include Cloudflare R2 for private profile-photo storage and Twilio Verify for SMS verification. The production hosting/database providers, processing locations, and processor list must be confirmed before public launch.</p><p>Information may also be disclosed to authorized reviewers and support personnel, professional advisers bound by confidentiality, a successor in a lawful business transfer, or a court, regulator, law-enforcement body, or emergency service when disclosure is legally required or reasonably necessary to protect rights, safety, and the integrity of the service.</p></>,
  },
  {
    id: "transfers",
    title: "7. Processing outside Nigeria",
    content: <p>Some service providers may process data outside Nigeria. Before any such production transfer, the operator must document the destination, transfer basis, contractual and technical safeguards, and any relevant adequacy decision or permitted exception under the Nigeria Data Protection Act. Members may request information about applicable safeguards.</p>,
  },
  {
    id: "retention",
    title: "8. How long information is kept",
    content: <><p>Raw identity documents, declared legal names, portrait captures, and gesture captures are scheduled for deletion 30 days after submission by default; an undecided submission then expires. Minimal verification decisions and audit records are retained for accountability. A separately approved, publicly enabled portrait is retained until it is replaced or consent is withdrawn.</p><p>Phone challenge data and send-attempt hashes are kept only as long as needed for verification, rate limiting, and abuse prevention. Account, marketplace, message, review, report, block, notification, and trust records are kept while the account is active and afterwards only as reasonably needed for disputes, safety, fraud prevention, legal duties, or legal claims. Backup deletion can occur later than deletion from the live service.</p><p>The 30-day verification purge must be scheduled in production, and a complete maximum-retention schedule must be approved before public launch.</p></>,
  },
  {
    id: "automation",
    title: "9. Screening and human review",
    content: <p>Task wording and item details can be checked by rules that approve a post or hold it for moderation. Identity approval is a manual reviewer decision. Members may ask for human review of a moderation or verification decision through the contact route below. GetNeba does not claim that its identity review is certified liveness detection, a criminal-record check, or a guarantee of conduct.</p>,
  },
  {
    id: "security",
    title: "10. Security and device storage",
    content: <><p>Controls include access restrictions, private signed media links, encryption of identity evidence, metadata removal from verification images, rate limits, evidence-access auditing, and separation of public and private fields. No internet service can promise absolute security.</p><p>The browser stores an authentication token so a signed-in session works. The installable web app caches only the public offline explanation and brand assets; authenticated pages, API responses, conversations, and identity data are not intentionally cached for offline use. GetNeba does not currently use advertising or cross-site tracking cookies.</p></>,
  },
  {
    id: "rights",
    title: "11. Your data-protection rights",
    content: <><p>Subject to lawful limits, a person may request information and access, correction, deletion, restriction, portability, or objection; withdraw consent; and request human intervention concerning solely automated decisions. GetNeba may need to verify the requester’s identity and may retain information where law or a valid legal claim requires it.</p><p>Send a request using the contact below. If a concern is not resolved, a complaint may be filed with the <a href="https://services.ndpc.gov.ng/breach/" target="_blank" rel="noreferrer">Nigeria Data Protection Commission <ExternalLink size={14} /></a>.</p></>,
  },
  {
    id: "children-changes",
    title: "12. Age limit and changes",
    content: <><p>GetNeba is for adults aged 18 or over and is not directed to children. If the operator learns that a child’s data was collected, it will be investigated and deleted where appropriate.</p><p>This notice may change when the service or law changes. Material changes will be presented in the service and, where required, fresh consent or acceptance will be requested. The effective date at the top identifies the current version.</p></>,
  },
];

const termsSections: LegalSection[] = [
  {
    id: "agreement",
    title: "1. Agreement and eligibility",
    content: <><p>These Terms govern access to GetNeba. By creating an account or using member features, a person agrees to these Terms, the Privacy Notice, and the Community Guidelines. If they do not agree, they must not use the service.</p><p>Members must be at least 18, legally able to enter agreements, use their own account, provide accurate information, and keep login credentials secure. One person must not impersonate another, evade a suspension, or transfer an account without permission.</p></>,
  },
  {
    id: "platform-role",
    title: "2. GetNeba’s role",
    content: <><p>GetNeba provides a technology marketplace where people can request local help or offer skills. Unless expressly stated otherwise, GetNeba is not the requester or helper, is not an employer, recruitment agency, agent, insurer, payment provider, or escrow service, and is not a party to the agreement between members.</p><p>GetNeba does not guarantee that a listing is accurate, a member is suitable, work will be available or completed, or a particular outcome will occur.</p></>,
  },
  {
    id: "member-agreement",
    title: "3. Agreements between members",
    content: <><p>Before work begins, requester and helper must agree directly on scope, location, timing, reward, expenses, payment method, materials, access, and any cancellation arrangement. Members are responsible for written transaction records, taxes, permits, licences, insurance, and other obligations that apply to them.</p><p>GetNeba does not collect, hold, release, refund, or guarantee payments. Never send money merely to apply for a task, share bank credentials, or permit another member to control a financial account.</p></>,
  },
  {
    id: "verification",
    title: "4. Profiles, verification and reviews",
    content: <><p>A verified-phone badge means the configured SMS check completed. Identity approval means an authorized reviewer completed the stated pilot checks. Neither is a criminal-record check, professional licence check, financial check, certified document-authenticity test, insurance policy, or guarantee of identity, skill, safety, or conduct.</p><p>Profile skills and availability are self-reported. Reviews may be submitted only by eligible participants after confirmed completed work. Reviews must be truthful, relevant, and respectful. GetNeba may hide or remove reviews that violate these Terms while preserving moderation records.</p></>,
  },
  {
    id: "acceptable-use",
    title: "5. Acceptable use",
    content: <><p>Members must follow the Community Guidelines and applicable law. They must not harass, discriminate, threaten, exploit, defraud, stalk, spam, scrape, reverse engineer, introduce malware, misuse another person’s data, manipulate reviews, interfere with security, or use GetNeba for unlawful activity.</p><p>Listings must describe real, lawful work accurately. GetNeba may use automated rules and human review to hold, reject, remove, or restrict content and activity.</p></>,
  },
  {
    id: "prohibited-tasks",
    title: "6. Prohibited and restricted tasks",
    content: <><p>Members must not request or offer work involving weapons, illegal drugs, stolen goods, fraudulent documents, sexual services, exploitation, unsupervised childcare, cash collection, financial transactions, access to financial accounts, or another illegal or unreasonably dangerous activity.</p><p>Item pickup is limited to goods already paid for with a declared value of ₦50,000 or less. A helper must not be required to use personal funds. GetNeba may change or tighten safety limits and will communicate material changes.</p></>,
  },
  {
    id: "content",
    title: "7. Member content and privacy",
    content: <><p>Members keep ownership of content they submit. They grant the operator a non-exclusive, worldwide, royalty-free licence to host, copy, process, display, adapt for technical formatting, and moderate that content only as needed to operate, secure, and improve the service. This licence ends when the content is deleted, except for copies reasonably retained in backups, safety records, legal claims, or content another member is entitled to retain.</p><p>A member must have the right to submit their content and must not expose another person’s private information without authority. Public profiles are open to the web and may be indexed by search engines. The Privacy Notice explains visibility in detail.</p></>,
  },
  {
    id: "safety",
    title: "8. Safety, disputes and emergencies",
    content: <><p>Members must use judgment, keep early meetings and handovers appropriately safe, protect private information, and stop if circumstances differ materially from the listing. Reporting and blocking tools support moderation but do not replace police, medical, or emergency services.</p><p>After acceptance, completion, cancellation, and rescheduling may require confirmation by both participants. A no-show or dispute may be reported for review. GetNeba may help document or moderate an issue but does not act as a court or promise recovery of money or property.</p></>,
  },
  {
    id: "enforcement",
    title: "9. Suspension and termination",
    content: <><p>GetNeba may warn, restrict, hide content, pause verification, suspend, or terminate an account when reasonably necessary to enforce these Terms, protect people or the service, investigate suspected fraud or abuse, comply with law, or address risk. Where appropriate and lawful, the member will receive a reason and a route to request review.</p><p>A member may stop using the service and request account deletion. Some records may remain where the Privacy Notice permits retention for safety, disputes, legal duties, or claims. Blocking or account closure does not automatically cancel an existing agreement between members.</p></>,
  },
  {
    id: "availability",
    title: "10. Service and third parties",
    content: <><p>GetNeba may add, change, suspend, or discontinue features and may be unavailable during maintenance, outages, provider failures, or events outside reasonable control. The installable web app is still a web service and most member features require an internet connection.</p><p>Third-party services, external links, SMS networks, devices, and payment arrangements between members are governed by their own terms. GetNeba is not responsible for a third party merely because the service links to or interoperates with it.</p></>,
  },
  {
    id: "liability",
    title: "11. Consumer rights, disclaimers and liability",
    content: <><p>Nothing in these Terms excludes or restricts a right or remedy that cannot lawfully be excluded under the Federal Competition and Consumer Protection Act or other applicable law. Any important limitation must be read with those mandatory rights.</p><p>To the extent permitted by law, GetNeba is provided on an “as available” basis, and the operator is not liable for indirect or consequential loss, loss caused solely by another member, or loss that was not reasonably foreseeable. No provision excludes liability for fraud, wilful misconduct, gross negligence, death or personal injury caused by negligence, or another liability that law does not permit the operator to exclude.</p></>,
  },
  {
    id: "law-complaints",
    title: "12. Complaints, governing law and changes",
    content: <><p>These Terms are governed by the laws of the Federal Republic of Nigeria. Members should first send a complaint using the contact below so it can be investigated. If it is not resolved, either party may use a court or regulator with lawful jurisdiction in Nigeria. Consumers may also use the <a href="https://fccpc.gov.ng/consumers/complaint-handling/" target="_blank" rel="noreferrer">FCCPC complaint process <ExternalLink size={14} /></a>.</p><p>If one provision is unenforceable, the remaining provisions continue. A failure to enforce a provision once is not a waiver. Material changes will be notified, and continued member use may require acceptance of the new version.</p></>,
  },
];

function ControllerDetails() {
  const ready = Boolean(operatorName && operatorAddress && legalEmail);
  return <>
    {!ready && <aside className="legal-readiness-notice" role="note"><AlertTriangle size={21} /><div><strong>Public-launch details are incomplete</strong><p>The operator’s legal name, service address, and dedicated legal/privacy email have not been configured. GetNeba should remain a limited pilot and must not be presented as legally launch-ready until these details and the production processor list are completed.</p></div></aside>}
    <section className="legal-contact" id="contact"><h2>Contact and complaints</h2><dl><div><dt>Data controller / service operator</dt><dd>{operatorName || "To be confirmed before public launch"}</dd></div><div><dt>Service address</dt><dd>{operatorAddress || "To be confirmed before public launch"}</dd></div><div><dt>Legal and privacy email</dt><dd>{legalEmail ? <a href={`mailto:${legalEmail}`}>{legalEmail}</a> : "To be confirmed before public launch"}</dd></div></dl><p>Safety concerns can also be submitted through GetNeba’s in-app reporting tools. Those tools are not an emergency service.</p></section>
  </>;
}

export function LegalPage({ kind }: { kind: "privacy" | "terms" }) {
  const privacy = kind === "privacy";
  const sections = privacy ? privacySections : termsSections;
  return <main className="public-info legal-page landing-container">
    <span className="landing-eyebrow"><ShieldCheck size={15} />{privacy ? "PRIVACY NOTICE" : "TERMS OF SERVICE"}</span>
    <h1>{privacy ? "Your information, explained clearly." : "Clear terms for local help."}</h1>
    <p className="public-info-intro">{privacy ? "What GetNeba collects, why it is used, who can see it, and the choices and rights available to you." : "The rules that apply when you use GetNeba to request help, offer skills, or connect with another member."}</p>
    <div className="legal-meta"><span>Effective {POLICY_DATE}</span><span>Version 2026-09-30</span></div>
    <ControllerDetails />
    <nav className="legal-contents" aria-label={`${privacy ? "Privacy notice" : "Terms"} contents`}><strong>On this page</strong><ol>{sections.map((section) => <li key={section.id}><a href={`#${section.id}`}>{section.title.replace(/^\d+\.\s*/, "")}</a></li>)}</ol></nav>
    {sections.map((section) => <section id={section.id} key={section.id}><h2>{section.title}</h2>{section.content}</section>)}
    <div className="public-info-links"><Link href={privacy ? "/terms" : "/privacy"}>{privacy ? "Terms of service" : "Privacy notice"}</Link><Link href="/community-guidelines">Community guidelines</Link><Link href="/safety">Safety center</Link></div>
  </main>;
}

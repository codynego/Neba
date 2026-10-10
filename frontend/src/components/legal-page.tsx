import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, ExternalLink, ShieldCheck } from "lucide-react";

const POLICY_DATE = "10 October 2026";
const operatorName = process.env.NEXT_PUBLIC_LEGAL_OPERATOR_NAME?.trim();
const operatorAddress = process.env.NEXT_PUBLIC_LEGAL_OPERATOR_ADDRESS?.trim();
const legalEmail = process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim();

type LegalSection = { id: string; title: string; content: ReactNode };

const privacySections: LegalSection[] = [
  {
    id: "scope",
    title: "1. Who this notice applies to",
    content: <><p>This notice explains how the operator of GetNeba collects and uses personal data when people visit the public website, create an account, build an opportunity profile, discover, save, share, submit, or apply for opportunities, use matching and preparation features, exchange messages, complete verification, or use safety tools.</p><p>For purposes of the Nigeria Data Protection Act 2023, the GetNeba operator is the data controller for this processing. The controller details appear in “Contact and complaints” below.</p></>,
  },
  {
    id: "data-collected",
    title: "2. Information GetNeba collects",
    content: <><ul><li><strong>Account and profile:</strong> username, email, display name, password hash, phone number, profile photo, biography, skills, education, experience, interests, goals, location, and account status.</li><li><strong>Opportunity activity:</strong> opportunities viewed, saved, shared, submitted, reported, checked, or applied for; application messages and status; reminders; preparation notes; match signals; and messages with organizations or other members.</li><li><strong>Opportunity content:</strong> titles, descriptions, eligibility, deadlines, source links, organization details, documents, pasted adverts or messages submitted for an Opportunity Check, evidence reports, and other information supplied by users or providers.</li><li><strong>Verification and trust:</strong> SMS challenge records; declared legal name; document type and image; live portrait and prompted gesture image; consent, review decision, reviewer, and audit records where verification is offered.</li><li><strong>Technical and security data:</strong> authentication token stored in the browser, standard request information such as IP address and user agent that hosting or security systems may log, and a small public offline cache used by the installable web app.</li></ul><p>Do not place phone numbers, passwords, financial-account details, identity documents, or exact home addresses in public text, applications, reviews, opportunity descriptions, or Opportunity Check submissions.</p></>,
  },
  {
    id: "purposes",
    title: "3. Why the information is used",
    content: <><p>GetNeba uses this information to create and secure accounts; publish and organize opportunity information; personalize discovery and matching; support saves, reminders, applications, preparation, sharing, and private coordination; verify submissions and organizations; operate reporting, blocking, moderation, and trust features; prevent fraud and abuse; communicate service updates; troubleshoot and improve the service; and comply with lawful obligations.</p><p>AI-assisted features may extract, categorize, summarize, compare, or help users prepare for opportunity content. They do not decide whether a person is accepted, eligible, or entitled to an opportunity. GetNeba does not sell personal data or use identity evidence for advertising.</p></>,
  },
  {
    id: "legal-bases",
    title: "4. Legal bases",
    content: <><p>Depending on the activity, processing is based on performance of the service agreement, steps requested before entering an agreement, GetNeba’s legitimate interests in operating a safe and reliable marketplace, compliance with legal obligations, protection of vital interests in a genuine emergency, or consent where the law requires it.</p><p>Consent is requested separately for identity evidence and for publishing an approved portrait. A member may hide their profile photo or withdraw identity consent, although helper features that require verification will then be unavailable. Withdrawal does not make earlier lawful processing unlawful.</p></>,
  },
  {
    id: "visibility",
    title: "5. What other people can see",
    content: <><ul><li><strong>Public opportunities:</strong> published opportunity pages may be visible without signing in and may appear in search engines. They can include the title, provider, description, location, deadline, eligibility, benefits, source link, verification status, and update information.</li><li><strong>Public profiles:</strong> where enabled, a member profile may show selected identity, skills, experience, location, and contribution information. Account and application details remain private unless a member chooses to share them.</li><li><strong>Applications and messages:</strong> information shared in an application is visible to the relevant provider or opportunity poster, and messages are visible to their intended participants and authorized support personnel.</li><li><strong>Organization submissions:</strong> an approved opportunity may identify the submitting organization or contributor. Unverified submissions are not intended to become public SEO pages.</li></ul><p>Do not assume that information entered into a public opportunity, profile, or shared application is private.</p></>,
  },
  {
    id: "sharing",
    title: "6. Service providers and lawful disclosure",
    content: <><p>GetNeba shares only the information needed with providers that support hosting, databases, private media storage, SMS delivery, AI-assisted analysis, web search, security, and maintenance. Opportunity Check links, pasted text, and extracted public-page content are sent to the configured AI and web-search provider to research sources and produce the private evidence report. Current product integrations include OpenAI for AI-assisted features and web search, Cloudflare R2 for private profile-photo storage, and Twilio Verify for SMS verification. The production hosting/database providers, processing locations, and processor list must be confirmed before public launch.</p><p>Information may also be disclosed to authorized reviewers and support personnel, professional advisers bound by confidentiality, a successor in a lawful business transfer, or a court, regulator, law-enforcement body, or emergency service when disclosure is legally required or reasonably necessary to protect rights, safety, and the integrity of the service.</p></>,
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
    content: <p>Opportunity submissions and content can be checked by rules or AI-assisted tools that extract fields, categorize content, detect duplicates, search for corroborating sources, compare claims, flag missing information, or hold a submission for moderation. Opportunity Check reports are informational evidence summaries, not guarantees that an opportunity is genuine or fraudulent, and their confidence and risk labels may be incomplete or wrong. Publication, verification, and enforcement decisions may include human review. Matching and preparation outputs do not determine eligibility, selection, or acceptance. Members may ask for human review of a moderation or verification decision through the contact route below. GetNeba does not claim that its identity review is certified liveness detection, a criminal-record check, or a guarantee of conduct.</p>,
  },
  {
    id: "security",
    title: "10. Security and device storage",
    content: <><p>Controls include access restrictions, private signed media links, encryption of identity evidence, metadata removal from verification images, rate limits, evidence-access auditing, short-lived access tokens, rotating refresh tokens in secure HTTP-only cookies, and separation of public and private fields. No internet service can promise absolute security.</p><p>The browser stores only a non-sensitive session marker; authentication tokens are not persisted in local storage. The installable web app caches only the public offline explanation and brand assets; authenticated pages, API responses, conversations, and identity data are not intentionally cached for offline use. GetNeba does not currently use advertising or cross-site tracking cookies.</p></>,
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
    content: <><p>GetNeba provides a technology platform where people discover, share, understand, prepare for, save, and pursue opportunities, including jobs, internships, scholarships, grants, fellowships, training, funding, projects, and collaborations. Unless expressly stated otherwise, GetNeba is not the opportunity provider, employer, recruiter, grant-maker, admissions body, agent, insurer, payment provider, or decision-maker, and is not a party to an agreement between a user and a provider.</p><p>GetNeba does not guarantee that a listing is accurate, current, eligible for a particular person, available, funded, or successful. The provider’s official source controls.</p></>,
  },
  {
    id: "member-agreement",
    title: "3. Agreements between members",
    content: <><p>Before pursuing an opportunity, the user must review the provider’s official source and independently confirm the scope, eligibility, deadline, compensation or funding, fees, documents, privacy terms, and application requirements. Users are responsible for the accuracy of information they submit and for their own applications, taxes, permits, licences, and other obligations.</p><p>GetNeba does not collect, hold, release, refund, or guarantee payments or awards. Never send money merely to access an opportunity, share bank credentials, or give an untrusted person control of a financial account.</p></>,
  },
  {
    id: "verification",
    title: "4. Profiles, verification and reviews",
    content: <><p>A verified-phone badge means the configured SMS check completed. Identity approval means an authorized reviewer completed the stated pilot checks. Neither is a criminal-record check, professional licence check, financial check, certified document-authenticity test, insurance policy, or guarantee of identity, skill, safety, or conduct.</p><p>Profile skills and availability are self-reported. Reviews may be submitted only by eligible participants after confirmed completed work. Reviews must be truthful, relevant, and respectful. GetNeba may hide or remove reviews that violate these Terms while preserving moderation records.</p></>,
  },
  {
    id: "acceptable-use",
    title: "5. Acceptable use",
    content: <><p>Members must follow the Community Guidelines and applicable law. They must not harass, discriminate, threaten, exploit, defraud, stalk, spam, scrape, reverse engineer, introduce malware, misuse another person’s data, manipulate opportunity information, interfere with security, or use GetNeba for unlawful activity.</p><p>Opportunity submissions must describe real programs, roles, or resources accurately and must not invent deadlines, eligibility, organizations, funding, testimonials, or application outcomes. GetNeba may use automated rules, AI-assisted checks, and human review to hold, reject, remove, or restrict content and activity.</p></>,
  },
  {
    id: "prohibited-tasks",
    title: "6. Prohibited and restricted tasks",
    content: <><p>Members must not request or offer work involving weapons, illegal drugs, stolen goods, fraudulent documents, sexual services, exploitation, unsupervised childcare, cash collection, financial transactions, access to financial accounts, or another illegal or unreasonably dangerous activity.</p><p>Item pickup is limited to goods already paid for with a declared value of ₦50,000 or less. A helper must not be required to use personal funds. GetNeba may change or tighten safety limits and will communicate material changes.</p></>,
  },
  {
    id: "content",
    title: "7. Member content and privacy",
    content: <><p>Members keep ownership of content they submit. They grant the operator a non-exclusive, worldwide, royalty-free licence to host, copy, process, display, adapt for technical formatting, generate structured metadata, and moderate that content only as needed to operate, secure, improve, and make the service discoverable. This licence ends when the content is deleted, except for copies reasonably retained in backups, safety records, legal claims, or content another member is entitled to retain.</p><p>A member must have the right to submit their content and must not expose another person’s private information without authority. Public opportunity pages and selected profiles may be open to the web and indexed by search engines. The Privacy Notice explains visibility in detail.</p></>,
  },
  {
    id: "safety",
    title: "8. Safety, disputes and emergencies",
    content: <><p>Members must use judgment, protect private information, verify providers and sources, and stop if an opportunity or application request differs materially from the published information. Reporting tools support moderation but do not replace police, medical, legal, or emergency services.</p><p>A misleading, expired, fraudulent, or unsafe opportunity may be reported for review. GetNeba may help document or moderate an issue but does not act as a court, application evaluator, or guarantor of money, access, or outcomes.</p></>,
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
    <h1>{privacy ? "Your information, explained clearly." : "Clear terms for discovering opportunities."}</h1>
    <p className="public-info-intro">{privacy ? "What GetNeba collects, why it is used, who can see it, and the choices and rights available to you." : "The rules that apply when you use GetNeba to discover, share, prepare for, save, and pursue opportunities."}</p>
    <div className="legal-meta"><span>Effective {POLICY_DATE}</span><span>Version 2026-10-08</span></div>
    <ControllerDetails />
    <nav className="legal-contents" aria-label={`${privacy ? "Privacy notice" : "Terms"} contents`}><strong>On this page</strong><ol>{sections.map((section) => <li key={section.id}><a href={`#${section.id}`}>{section.title.replace(/^\d+\.\s*/, "")}</a></li>)}</ol></nav>
    {sections.map((section) => <section id={section.id} key={section.id}><h2>{section.title}</h2>{section.content}</section>)}
    <div className="public-info-links"><Link href={privacy ? "/terms" : "/privacy"}>{privacy ? "Terms of service" : "Privacy notice"}</Link><Link href="/community-guidelines">Community guidelines</Link><Link href="/safety">Safety center</Link></div>
  </main>;
}

import Link from "next/link";
import { notFound } from "next/navigation";
const pages = {
  about: { title: "Good help. Close by.", label: "ABOUT NEBA", intro: "Neba connects people who need a little help with people nearby who have time or a useful skill.", sections: [
    ["Everyday needs, local people", "Post an errand, moving task, tech request, or event job. Helpers in your city can apply, and you choose who fits your request."],
    ["Clear agreements", "Describe the work, timing, and reward before choosing a helper. Coordinate directly after acceptance and mark the task complete when it is done. Payments are agreed directly between participants in this pilot."],
    ["A community built with care", "Posting requires a verified phone. Helpers also need manual identity review. Reporting, blocking, and completed-task reviews help members hold each other accountable."],
  ] },
  help: { title: "A little guidance.", label: "HELP CENTER", intro: "Understand how Neba works and where to find help with your account.", sections: [
    ["Finding and posting tasks", "Create an account or sign in to browse your neighborhood. Verify your phone before posting. To offer skills or apply for work, complete the identity and camera-photo review too."],
    ["After you apply", "The requester reviews applications and selects a helper. A private task conversation opens after acceptance, and verified contact numbers are shared for coordination. Agree on the exact work, address, timing, and payment before starting. Completion, cancellation after acceptance, and rescheduling need the other participant’s confirmation."],
    ["Reporting a problem", "Use Report or block on a task, offer, or received application. Describe what happened for the moderation team. Your safety center shows report status and lets you manage blocked members."],
    ["Verification status", "SMS and private uploads must be configured before they can be used. Pending submissions are waiting for manual review. If a submission is rejected, your verification page shows the reviewer’s correction note."],
  ] },
  "community-guidelines": { title: "Look out for each other.", label: "COMMUNITY GUIDELINES", intro: "Treat your neighbors with respect. Identity checks help establish who someone is; they do not guarantee safe behaviour.", sections: [
    ["Be honest and respectful", "Use your own identity and accurate skills. Do not impersonate another person, harass, discriminate, threaten, or pressure someone to do work they did not agree to."],
    ["Keep tasks safe", "Offer lawful work you can do safely. Do not request dangerous or exploitative tasks. This pilot is for adults aged 18 and over. Explain the task and agree on the reward before work begins."],
    ["Protect personal information", "Keep phone numbers, identity documents, and exact addresses out of task descriptions and reviews. Share coordination details only with your selected participant."],
    ["Report worrying behaviour", "Send a private report and block unwanted interactions. Admins can review reports, hide abusive reviews, and suspend accounts. The moderation queue is not an emergency service; contact local emergency services if you are in immediate danger."],
  ] },
  privacy: { title: "Your information, handled with care.", label: "PRIVACY IN THE PILOT", intro: "How the current Neba pilot uses information you provide.", sections: [
    ["Account and task information", "Neba stores account details, cities, tasks, offers, applications, and reviews to operate the service. Task and offer information is visible to signed-in members. Keep private contact details and exact addresses out of descriptions."],
    ["Phone verification", "Verification uses Twilio Verify when configured. Your number is sent to that service to deliver and check the SMS code. Your verified number is shared for coordination after a task application is accepted."],
    ["ID and camera photos", "Identity evidence is encrypted and restricted to authorized staff reviewers. Showing an approved portrait to signed-in members is optional. Identity documents and camera challenge photos are not published on profiles."],
    ["Retention and consent", "Default evidence retention is 30 days from submission, removed when the scheduled purge runs. An opted-in approved portrait remains until consent withdrawal. Manage verification lets you withdraw consent and remove stored identity photos; this also removes identity approval. Minimal review and audit records remain. Backup deletion requires a separate retention process."],
    ["Reports and blocks", "Reports are available to the reporting member and authorized moderators. Members can manage blocks in their safety center. Verification and moderation decisions are recorded to support accountability."],
  ] },
  terms: { title: "Using the Neba pilot.", label: "PILOT TERMS", intro: "Operating rules for the current pilot. Read the community guidelines and privacy information before taking part.", sections: [
    ["Accounts and eligibility", "Use your own account and keep its information accurate. Offering help requires phone verification and approved manual identity review. The review flow requires confirmation that you are at least 18."],
    ["Agree before starting", "Participants agree directly on the work, timing, location, reward, and payment method. Neba does not process payments or provide escrow in this pilot. Only accept work you understand and can perform safely."],
    ["Verification and reviews", "A badge confirms the stated checks were completed. Manual review is not automated document-authenticity testing, certified liveness, or a background check. Reviews are limited to participants in completed tasks."],
    ["Community standards", "Follow the community guidelines. Report fraud, harassment, or unsafe conduct using the reporting controls. Admins can moderate reviews and suspend accounts. Blocking prevents new interactions; it does not resolve an existing work agreement."],
  ] },
};
export const dynamicParams = false;
export function generateStaticParams() { return Object.keys(pages).map((info) => ({ info })); }
export default async function InfoPage({ params }: { params: Promise<{ info: string }> }) {
  const { info } = await params;
  if (!Object.hasOwn(pages, info)) notFound();
  const page = pages[info as keyof typeof pages];
  return <main className="public-info landing-container"><span className="landing-eyebrow">{page.label}</span><h1>{page.title}</h1><p className="public-info-intro">{page.intro}</p>{page.sections.map(([title, text]) => <section key={title}><h2>{title}</h2><p>{text}</p></section>)}<div className="public-info-links"><Link href="/#how-it-works">How Neba works</Link><Link href="/community-guidelines">Community guidelines</Link><Link href="/privacy">Privacy information</Link><Link href="/safety">Your safety center</Link></div></main>;
}

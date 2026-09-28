import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { publicPageMetadata } from "@/lib/seo";
import { ArrowRight, ArrowUpRight, Check, ClipboardCheck, HandHeart, MapPin, MessageCircle, ShieldCheck, UsersRound } from "lucide-react";
const pages = {
  about: { title: "A little help can change the shape of a day.", label: "ABOUT GETNEBA", intro: "GetNeba helps people find useful, practical help from others nearby—and gives local skills a place to be seen.", sections: [] },
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
export async function generateMetadata({ params }: { params: Promise<{ info: string }> }) {
  const { info } = await params;
  if (!Object.hasOwn(pages, info)) notFound();
  const page = pages[info as keyof typeof pages];
  const titles: Record<string, string> = { about: "About GetNeba: local help and neighborhood skills", help: "Help center: posting tasks, offering skills and verification", "community-guidelines": "Community guidelines for safe, respectful tasks", privacy: "Privacy and personal information", terms: "Pilot terms and task agreements" };
  return publicPageMetadata(titles[info], page.intro, `/${info}`);
}

function AboutPage() {
  const principles = [
    { icon: MapPin, label: "Close enough to understand", title: "Local by design", text: "A task makes more sense when the person helping understands the city, the distance, and the everyday reality around it." },
    { icon: ClipboardCheck, label: "Clear before work begins", title: "Details over guesswork", text: "The work, timing, location and reward should be understood before anyone commits. Clear expectations make better outcomes." },
    { icon: ShieldCheck, label: "Care, backed by controls", title: "Trust is built", text: "Verification, private conversations, reporting, blocking and completed-task reviews give the community practical ways to look out for itself." },
  ];
  return <main className="about-page">
    <section className="about-hero landing-container">
      <div className="about-hero-copy"><span className="landing-eyebrow"><HandHeart size={15} /> ABOUT GETNEBA</span><h1>A little help can change the <em>shape of a day.</em></h1><p>GetNeba helps people find useful, practical help from others nearby—and gives local skills a place to be seen.</p><div className="about-actions"><Link className="button button-dark" href="/tasks/new">Ask for help<ArrowRight size={18} /></Link><Link className="button button-outline" href="/offers/new">Offer your skills<ArrowUpRight size={18} /></Link></div></div>
      <div className="about-hero-visual"><Image src="/images/neba-neighbors.png" alt="Two neighbors helping move a fridge outside a home." fill priority sizes="(max-width: 760px) calc(100vw - 40px), 48vw" /><div className="about-photo-note"><Image src="/brand/getneba-mark.svg" alt="" width={48} height={48} unoptimized /><div><small>THE IDEA IS SIMPLE</small><strong>A need nearby.<br />A person who can help.</strong></div></div></div>
    </section>

    <section className="about-thesis"><div className="landing-container"><span className="about-thesis-mark">“</span><div><span className="landing-eyebrow">WHY GETNEBA EXISTS</span><h2>For the space between<br /><em>“I need a hand”</em> and<br /><em>“I know someone.”</em></h2></div><div className="about-thesis-copy"><p>Life is full of jobs that are too small for a company, too urgent to postpone, or simply easier with another pair of hands.</p><p>At the same time, people in every city have useful skills, practical experience and time they are willing to offer. GetNeba gives those two sides a clear place to meet.</p><p className="about-name-note"><strong>GetNeba</strong> is a nod to the neighbour you can call on—the person close enough to make help feel possible.</p></div></div></section>

    <section className="about-principles landing-container"><div className="about-section-heading"><div><span className="landing-eyebrow">WHAT GUIDES THE PRODUCT</span><h2>Built around how local help actually works.</h2></div><p>Not anonymous listings. Not vague promises. A clearer way for people nearby to understand the task and decide whether they fit.</p></div><div className="about-principle-grid">{principles.map(({ icon: Icon, label, title, text }) => <article key={title}><div className="about-principle-top"><span><Icon size={23} /></span><small>{label}</small></div><h3>{title}</h3><p>{text}</p></article>)}</div></section>

    <section className="about-two-sides"><div className="landing-container"><div className="about-section-heading"><div><span className="landing-eyebrow">TWO SIDES. ONE COMMUNITY.</span><h2>Come with a need.<br />Come with a skill.</h2></div><p>The same account can ask for help today and offer it tomorrow.</p></div><div className="about-side-grid"><article className="about-side-card requester"><span className="about-side-icon"><MessageCircle size={28} /></span><small>WHEN YOU NEED HELP</small><h3>Turn the job in your head into a clear request.</h3><ul><li><Check size={16} />Describe what needs doing</li><li><Check size={16} />Add the place, timing and reward</li><li><Check size={16} />Review people who apply</li><li><Check size={16} />Choose who feels right for the task</li></ul><Link href="/tasks/new">Post a task<ArrowRight size={17} /></Link></article><article className="about-side-card helper"><span className="about-side-icon"><UsersRound size={28} /></span><small>WHEN YOU CAN HELP</small><h3>Put useful time and experience to work nearby.</h3><ul><li><Check size={16} />Create a profile people can understand</li><li><Check size={16} />Offer a skill or browse open tasks</li><li><Check size={16} />Apply only where you are a good fit</li><li><Check size={16} />Agree on details before starting</li></ul><Link href="/offers/new">Offer your skills<ArrowUpRight size={17} /></Link></article></div></div></section>

    <section className="about-honesty landing-container"><div className="about-honesty-intro"><span className="landing-eyebrow">HONEST FROM THE START</span><h2>Trust matters most when the work is real.</h2><p>GetNeba is being built carefully. The current pilot provides practical trust tools, while keeping its limits clear.</p></div><div className="about-honesty-list"><div><strong>What the pilot supports</strong><p>Phone verification, manual identity review for helpers, private task conversations, mutual task decisions, reporting, blocking and reviews after confirmed work.</p></div><div><strong>What participants agree directly</strong><p>The exact work, address, timing, reward and payment method. GetNeba does not collect or hold payments during the pilot.</p></div><div><strong>What verification does not mean</strong><p>A verification badge is not a background check, insurance policy or guarantee. Members still need to use judgment and keep arrangements clear.</p></div></div></section>

    <section className="about-final landing-container"><Image src="/brand/getneba-mark.svg" alt="" width={90} height={90} unoptimized /><div><span className="landing-eyebrow">GOOD HELP. CLOSE BY.</span><h2>Start with the thing<br />you need done.</h2><p>Or start with the skill you already have. Either way, your next useful connection could be closer than you think.</p></div><div className="about-final-actions"><Link className="button button-dark" href="/register">Join GetNeba<ArrowRight size={18} /></Link><Link href="/community-guidelines">Read our community guidelines<ArrowUpRight size={16} /></Link></div></section>
  </main>;
}

export default async function InfoPage({ params }: { params: Promise<{ info: string }> }) {
  const { info } = await params;
  if (!Object.hasOwn(pages, info)) notFound();
  if (info === "about") return <AboutPage />;
  const page = pages[info as keyof typeof pages];
  return <main className="public-info landing-container"><span className="landing-eyebrow">{page.label}</span><h1>{page.title}</h1><p className="public-info-intro">{page.intro}</p>{page.sections.map(([title, text]) => <section key={title}><h2>{title}</h2><p>{text}</p></section>)}<div className="public-info-links"><Link href="/#how-it-works">How GetNeba works</Link><Link href="/community-guidelines">Community guidelines</Link><Link href="/privacy">Privacy information</Link><Link href="/safety">Your safety center</Link></div></main>;
}

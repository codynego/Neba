import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { publicPageMetadata } from "@/lib/seo";
import { LegalPage } from "@/components/legal-page";
import { ArrowRight, ArrowUpRight, Check, ClipboardCheck, HandHeart, MapPin, MessageCircle, ShieldCheck, UsersRound } from "lucide-react";
const pages = {
  about: { title: "A little help can change the shape of a day.", label: "ABOUT GETNEBA", intro: "GetNeba helps people find useful, practical help from others nearby—and gives local skills a place to be seen.", sections: [] },
  help: { title: "A little guidance.", label: "HELP CENTER", intro: "Understand how Neba works and where to find help with your account.", sections: [
    ["Finding and posting tasks", "Create an account or sign in to browse your neighborhood. Before posting, applying, or offering help, complete your profile with a phone number, profile photo, and location."],
    ["After you apply", "The requester reviews applications and selects a helper. A private task conversation opens after acceptance, and contact numbers are shared privately for coordination. Agree on the exact work, address, timing, and payment before starting. Completion, cancellation after acceptance, and rescheduling need the other participant’s confirmation."],
    ["Reporting a problem", "Use Report or block on a task, offer, or received application. Describe what happened for the moderation team. Your safety center shows report status and lets you manage blocked members."],
    ["Profile and verification requirements", "A phone number, profile picture, and location complete your profile. A verified phone is required to post. A verified phone and approved identity review are required to offer skills, apply, or be accepted as a helper. Verification is not a background check or a guarantee."],
  ] },
  "community-guidelines": { title: "Look out for each other.", label: "COMMUNITY GUIDELINES", intro: "Treat your neighbors with respect. Identity checks help establish who someone is; they do not guarantee safe behaviour.", sections: [
    ["Be honest and respectful", "Use your own identity and accurate skills. Do not impersonate another person, harass, discriminate, threaten, or pressure someone to do work they did not agree to."],
    ["Keep tasks safe", "Offer lawful work you can do safely. Do not request dangerous or exploitative tasks. This pilot is for adults aged 18 and over. Explain the task and agree on the reward before work begins."],
    ["Use the MVP item limits", "Item pickup is limited to already-paid goods with a declared value of ₦50,000 or less. Helpers must not be asked to use their own money. Cash collection, financial transactions, high-value goods, weapons, illegal drugs, stolen goods, fraudulent documents, sexual services, and unsupervised childcare are not allowed."],
    ["Protect personal information", "Keep phone numbers, identity documents, and exact addresses out of task descriptions and reviews. Share coordination details only with your selected participant."],
    ["Report worrying behaviour", "Send a private report and block unwanted interactions. Admins can review reports, hide abusive reviews, and suspend accounts. The moderation queue is not an emergency service; contact local emergency services if you are in immediate danger."],
  ] },
  privacy: { title: "Your information, explained clearly.", label: "PRIVACY NOTICE", intro: "What GetNeba collects, why it is used, who can see it, and the choices and rights available to you.", sections: [] },
  terms: { title: "Clear terms for local help.", label: "TERMS OF SERVICE", intro: "The rules that apply when you use GetNeba to request help, offer skills, or connect with another member.", sections: [] },
};
export const dynamicParams = false;
export function generateStaticParams() { return Object.keys(pages).map((info) => ({ info })); }
export async function generateMetadata({ params }: { params: Promise<{ info: string }> }) {
  const { info } = await params;
  if (!Object.hasOwn(pages, info)) notFound();
  const page = pages[info as keyof typeof pages];
  const titles: Record<string, string> = { about: "About GetNeba: local help and neighborhood skills", help: "Help center: posting tasks, offering skills and verification", "community-guidelines": "Community guidelines for safe, respectful tasks", privacy: "Privacy notice", terms: "Terms of service" };
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
  if (info === "privacy" || info === "terms") return <LegalPage kind={info} />;
  const page = pages[info as keyof typeof pages];
  return <main className="public-info landing-container"><span className="landing-eyebrow">{page.label}</span><h1>{page.title}</h1><p className="public-info-intro">{page.intro}</p>{page.sections.map(([title, text]) => <section key={title}><h2>{title}</h2><p>{text}</p></section>)}<div className="public-info-links"><Link href="/#how-it-works">How GetNeba works</Link><Link href="/community-guidelines">Community guidelines</Link><Link href="/privacy">Privacy information</Link><Link href="/safety">Your safety center</Link></div></main>;
}

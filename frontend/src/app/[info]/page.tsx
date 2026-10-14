import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowUpRight, BookOpenCheck, Building2, ShieldCheck } from "lucide-react";
import { LegalPage } from "@/components/legal-page";
import { publicPageMetadata } from "@/lib/seo";

const pages = {
  about: {
    title: "Education works better when everything works together.",
    label: "ABOUT NEBA",
    intro: "Neba connects school operations, classroom evidence, and learner opportunity into one education ecosystem.",
    sections: [
      ["Start with the school", "Neba for Schools gives administrators and teachers a focused place to manage classes, student records, assessment work, and the academic evidence behind each next step."],
      ["Keep intelligence explainable", "Academic Intelligence surfaces patterns from recorded assessment evidence. It shows the topic, the scores behind the signal, and leaves the teaching decision with the school team."],
      ["Grow with the learner", "Neba Opportunities connects learners to scholarships, grants, academic programmes, and other pathways when they are ready to explore beyond the classroom."],
    ],
  },
  help: {
    title: "Help for your Neba workspace.",
    label: "HELP AND SUPPORT",
    intro: "Start with a school workspace, invite the right people, and use assessment evidence to guide the next conversation.",
    sections: [
      ["Set up a school", "Create the school workspace, add your current classes and subjects, then invite colleagues with the access they need."],
      ["Record assessment evidence", "Create an assessment, enter or import scores, and map questions to topics when you want more specific academic signals."],
      ["Use Academic Intelligence", "Review the evidence and coverage behind each topic signal before creating an intervention. Neba supports a teacher-led decision; it does not grade students or make outcomes decisions automatically."],
    ],
  },
  "community-guidelines": {
    title: "A trustworthy education ecosystem.",
    label: "COMMUNITY GUIDELINES",
    intro: "Schools and education partners share responsibility for accurate information, appropriate access, and respect for every learner.",
    sections: [
      ["Protect student information", "Add only the information your school is authorized to use. Do not share student records outside the appropriate school workspace or use another person’s account."],
      ["Keep records accurate", "Enter assessment and school information carefully. Review source evidence before acting on a topic signal or sharing an opportunity with learners."],
      ["Use appropriate access", "School administrators should give staff the minimum access needed for their work and remove access when a staff member’s role changes."],
    ],
  },
} as const;

type PublicInfo = keyof typeof pages;

export async function generateMetadata({ params }: { params: Promise<{ info: string }> }): Promise<Metadata> {
  const { info } = await params;
  if (info === "privacy" || info === "terms") {
    const title = info === "privacy" ? "Privacy notice" : "Terms of service";
    return publicPageMetadata(title, "Neba’s public service information.", `/${info}`);
  }
  if (!Object.hasOwn(pages, info)) return {};
  const page = pages[info as PublicInfo];
  return publicPageMetadata(page.title, page.intro, `/${info}`);
}

export default async function InfoPage({ params }: { params: Promise<{ info: string }> }) {
  const { info } = await params;
  if (info === "privacy" || info === "terms") return <LegalPage kind={info} />;
  if (!Object.hasOwn(pages, info)) notFound();
  const page = pages[info as PublicInfo];
  const Icon = info === "about" ? Building2 : info === "help" ? BookOpenCheck : ShieldCheck;

  return <main className="public-info landing-container">
    <span className="landing-eyebrow"><Icon size={15} /> {page.label}</span>
    <h1>{page.title}</h1>
    <p className="public-info-intro">{page.intro}</p>
    {page.sections.map(([title, text]) => <section key={title}><h2>{title}</h2><p>{text}</p></section>)}
    <div className="public-info-links">
      <Link href="/schools">Explore Neba for Schools <ArrowUpRight size={15} /></Link>
      <Link href="/schools/get-started">Set up a school workspace <ArrowUpRight size={15} /></Link>
      <Link href="/privacy">Privacy information</Link>
    </div>
  </main>;
}

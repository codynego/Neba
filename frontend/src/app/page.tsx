import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  Check,
  FileSpreadsheet,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { jsonLd, publicPageMetadata, siteUrl } from "@/lib/seo";

const homeDescription =
  "Neba for Schools is evidence-grounded AI academic intelligence that turns assessment data into better teaching decisions.";

export const metadata = publicPageMetadata(
  "AI academic intelligence for schools",
  homeDescription,
  "/",
);

const capabilities = [
  {
    icon: BarChart3,
    label: "01 · ANALYSE",
    title: "AI academic insights",
    copy: "See learning gaps by topic, subject, class, and learner from the assessment evidence your school already records.",
  },
  {
    icon: Bot,
    label: "02 · RESPOND",
    title: "A teaching assistant grounded in your data",
    copy: "Create revision activities, lesson ideas, practice questions, and intervention drafts for teacher review.",
  },
  {
    icon: TrendingUp,
    label: "03 · MEASURE",
    title: "Track progress that means something",
    copy: "Compare results over time, see where understanding is improving, and identify what still needs attention.",
  },
  {
    icon: MessageSquareText,
    label: "04 · ASK",
    title: "Ask your school’s data",
    copy: "Let authorised staff ask clear questions and get answers grounded in the records they are allowed to access.",
  },
];

const workflow = [
  ["Bring in what you have", "Use your existing assessment spreadsheets or enter results as your teachers work."],
  ["Make the evidence explainable", "Map questions to topics so every signal has a visible source and a clear limit."],
  ["Choose the next action", "Use the insight to plan reteaching, practice, intervention, or a comparable follow-up assessment."],
  ["Measure the change", "Return to the evidence and see whether the next result shows meaningful progress."],
];

export default function HomePage() {
  return (
    <main className="nh-home">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Organization",
                "@id": new URL("/#organization", siteUrl).toString(),
                name: "Neba",
                url: siteUrl.toString(),
                description: homeDescription,
              },
              {
                "@type": "WebSite",
                "@id": new URL("/#website", siteUrl).toString(),
                name: "Neba for Schools",
                url: siteUrl.toString(),
                description: homeDescription,
                publisher: { "@id": new URL("/#organization", siteUrl).toString() },
              },
            ],
          }),
        }}
      />

      <section className="nh-hero">
        <div className="nb-wrap nh-hero-grid">
          <div className="nh-hero-copy">
            <span className="nh-kicker"><i /> NEBA FOR SCHOOLS · AI-POWERED</span>
            <h1>Your school’s data holds the answers. <em>Find them.</em></h1>
            <p>Turn assessment results into explainable learning insights, teacher-reviewed recommendations, and measurable academic progress.</p>
            <div className="nh-actions">
              <Link href="/schools/get-started" className="nh-button nh-button-primary">Request a pilot <ArrowUpRight size={17} /></Link>
              <Link href="#how-it-works" className="nh-text-link">See how it works <ArrowRight size={16} /></Link>
            </div>
            <small className="nh-hero-note"><FileSpreadsheet size={14} /> Works with the assessment spreadsheets your school already has.</small>
          </div>

          <div className="nh-board" aria-label="Illustrative Neba academic intelligence analysis">
            <div className="nh-board-top"><span>AI ACADEMIC INSIGHTS</span><b><i /> ANALYSIS READY</b></div>
            <div className="nh-board-context"><span>JSS 2 MATHEMATICS</span><small>Sample analysis · First term</small></div>
            <div className="nh-board-flow">
              <div className="nh-board-evidence"><small>RECORDED EVIDENCE</small><strong>28</strong><span>students assessed</span><div className="nh-board-bars"><i /><i /><i /><i /><i /></div></div>
              <ArrowRight className="nh-board-arrow" size={22} />
              <div className="nh-board-signal"><small>PRIORITY LEARNING GAP</small><strong>Fractions</strong><span>52% class average</span><div className="nh-signal-line"><i /></div></div>
            </div>
            <div className="nh-board-recommendation"><span><Sparkles size={15} /> AI RECOMMENDATION</span><p>Prioritise fractions revision, then reassess understanding with a comparable check.</p><small><Check size={13} /> Teacher review required before action</small></div>
            <div className="nh-board-foot"><span>Illustrative sample data</span><ShieldCheck size={14} /> Evidence-grounded · Not a real school report</div>
          </div>
        </div>
      </section>

      <section className="nh-proof"><div className="nb-wrap nh-proof-grid"><div><span>THE PROBLEM</span><strong>Results are recorded. The next decision is still unclear.</strong></div><div><span>THE SHIFT</span><strong>Neba connects the result to the topic, the action, and the progress check.</strong></div><div><span>THE PRINCIPLE</span><strong>AI assists the people closest to the learner. Teachers remain in control.</strong></div></div></section>

      <section className="nb-wrap nh-capabilities" id="capabilities">
        <div className="nh-section-heading"><div><span className="nh-kicker">WHAT NEBA ACTUALLY DOES</span><h2>From marks on a spreadsheet to <em>better teaching decisions.</em></h2></div><p>Academic intelligence is useful when it is specific enough to act on and honest enough to show its limits.</p></div>
        <div className="nh-capability-grid">{capabilities.map(({ icon: Icon, label, title, copy }) => <article key={title}><div className="nh-capability-icon"><Icon size={20} /></div><span>{label}</span><h3>{title}</h3><p>{copy}</p><ArrowRight size={16} /></article>)}</div>
      </section>

      <section className="nh-workflow" id="how-it-works"><div className="nb-wrap"><div className="nh-section-heading nh-section-heading-light"><div><span className="nh-kicker">A COMPLETE ACADEMIC LOOP</span><h2>Analyse. Act. <em>Measure again.</em></h2></div><p>Neba is built around the real rhythm of school work—not a separate AI experiment your teachers have to learn around.</p></div><div className="nh-workflow-grid">{workflow.map(([title, copy], index) => <article key={title}><b>0{index + 1}</b><div><h3>{title}</h3><p>{copy}</p></div>{index < workflow.length - 1 && <ArrowRight size={17} />}</article>)}</div></div></section>

      <section className="nb-wrap nh-audience"><div className="nh-section-heading"><div><span className="nh-kicker">MADE FOR THE PEOPLE USING THE EVIDENCE</span><h2>One intelligence layer. <em>Different views.</em></h2></div></div><div className="nh-audience-grid"><article><UsersRound size={21} /><span>SCHOOL LEADERS</span><h3>See where the school needs attention.</h3><p>Compare classes, subjects, terms, and interventions without losing the detail behind the numbers.</p></article><article><Target size={21} /><span>TEACHERS</span><h3>Know what to do next.</h3><p>Move from a topic signal to a reviewable teaching draft and a follow-up assessment.</p></article><article><ShieldCheck size={21} /><span>TRUST BY DESIGN</span><h3>Useful, private, and reviewable.</h3><p>Access follows school roles. Recommendations show their evidence and stay under teacher judgement.</p></article></div></section>

      <section className="nh-cta"><div className="nb-wrap nh-cta-inner"><div><span className="nh-kicker">START WITH THE DATA YOU ALREADY HAVE</span><h2>Give every learner a <em>clearer next step.</em></h2></div><div><p>Bring Neba into your school’s existing assessment workflow and build an evidence base your team can actually use.</p><Link href="/schools/get-started" className="nh-button nh-button-light">Request a pilot <ArrowUpRight size={17} /></Link></div></div></section>

      <section className="nb-wrap nh-final"><span className="nh-kicker">NEBA FOR SCHOOLS</span><h2>AI-powered academic intelligence for schools.</h2><p>Better data. Better questions. Better teaching decisions.</p></section>
    </main>
  );
}

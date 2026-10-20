import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpenCheck,
  Check,
  ClipboardCheck,
  FileSpreadsheet,
  LockKeyhole,
  School,
  ShieldCheck,
  Sparkles,
  Target,
  UsersRound,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { SchoolsPilotForm } from "@/components/schools-pilot-form";
import { jsonLd, publicPageMetadata, siteUrl } from "@/lib/seo";

const description = "Academic intelligence for schools: turn assessment results into learning insights, targeted teaching resources, and measurable student progress.";
export const metadata = publicPageMetadata("Academic intelligence for schools", description, "/schools");

const steps = [
  { number: "01", icon: FileSpreadsheet, title: "Bring in assessment results", copy: "Start with the spreadsheets your school already uses. Neba works alongside your existing academic process." },
  { number: "02", icon: Target, title: "Identify learning gaps", copy: "Connect performance to the topics, learners, and classes that deserve closer attention." },
  { number: "03", icon: Sparkles, title: "Turn insights into teaching plans", copy: "Teachers review the evidence, then use targeted revision activities and practice to respond." },
  { number: "04", icon: BarChart3, title: "Measure progress", copy: "Compare follow-up assessments to understand what improved and what needs another response." },
];

export default function SchoolsPage() {
  return <main className="schools-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd({ "@context": "https://schema.org", "@type": "SoftwareApplication", name: "Neba for Schools", applicationCategory: "EducationalApplication", operatingSystem: "Web", url: new URL("/schools", siteUrl).toString(), description }) }} />

    <section className="schools-hero">
      <div className="schools-shell schools-hero-grid">
        <div className="schools-hero-copy">
          <span className="schools-product"><School size={17} /> ACADEMIC INTELLIGENCE FOR SCHOOLS <b>NEBA FOR SCHOOLS</b></span>
          <h1>Know what students missed.<br />Know what to <em>teach next.</em></h1>
          <p>Turn assessment results into learning insights, targeted teaching resources, and a clearer picture of student progress—so educators can make better academic decisions with confidence.</p>
          <div className="schools-actions">
            <Link className="schools-button schools-button-primary" href="#pilot">Request a pilot <ArrowUpRight size={19} /></Link>
            <a className="schools-text-link" href="#how-it-works">See how it works <ArrowRight size={17} /></a>
          </div>
          <p className="schools-demo-note">Already exploring Neba? <Link href="/schools/get-started">Create a workspace and explore the demo.</Link></p>
          <small className="schools-hero-note"><Check size={15} /> Built for school leaders and teachers. Start with results you already collect.</small>
        </div>

        <div className="schools-evidence-wrap"><span className="schools-example-label">ILLUSTRATIVE EXAMPLE - NOT PILOT RESULTS</span><div className="schools-evidence-board" aria-label="Illustrative class learning-gap analysis">
          <header>
            <div><span className="schools-board-mark"><BookOpenCheck size={18} /></span><div><strong>JSS 2 Mathematics</strong><small>Mid-term assessment</small></div></div>
            <span className="schools-board-status">ANALYSIS READY</span>
          </header>
          <div className="schools-board-summary">
            <div><small>CLASS</small><strong>28 students</strong></div>
            <div><small>QUESTIONS</small><strong>25 mapped</strong></div>
            <div><small>PRIORITY</small><strong className="schools-alert-text">2 topic gaps</strong></div>
          </div>
          <div className="schools-topic-heading"><span>TOPIC EVIDENCE</span><span>MASTERY</span></div>
          <div className="schools-topic-list">
            <div className="schools-topic-row"><span className="schools-topic-signal signal-low" /><div><strong>Fractions</strong><small>12 students need support</small></div><div className="schools-meter"><span style={{ width: "42%" }} /></div><b>42%</b></div>
            <div className="schools-topic-row"><span className="schools-topic-signal signal-mid" /><div><strong>Linear equations</strong><small>7 students need support</small></div><div className="schools-meter"><span style={{ width: "61%" }} /></div><b>61%</b></div>
            <div className="schools-topic-row"><span className="schools-topic-signal signal-high" /><div><strong>Geometry</strong><small>On track</small></div><div className="schools-meter"><span style={{ width: "79%" }} /></div><b>79%</b></div>
          </div>
          <div className="schools-intervention">
            <span><ClipboardCheck size={18} /></span>
            <div><small>RECOMMENDED NEXT STEP</small><strong>Run a focused fractions revision</strong><p>Review equivalent fractions, then reassess with 8 mapped questions.</p></div>
            <ArrowRight size={18} />
          </div>
          <footer><span>ILLUSTRATIVE FOLLOW-UP</span><div><strong>42%</strong><ArrowRight size={15} /><strong>71%</strong></div><b>+29 points</b></footer>
        </div></div>
      </div>
    </section>

    <section className="schools-proof-line"><div className="schools-shell"><span>BUILT FOR THE PEOPLE RESPONSIBLE FOR PROGRESS</span><div><strong>Proprietors</strong><i /> <strong>Principals</strong><i /> <strong>Heads of academics</strong></div></div></section>

    <section className="schools-problem schools-shell">
      <div className="schools-section-heading"><span>RESULTS SHOULD LEAD SOMEWHERE</span><h2>A score tells you what happened.<br /><em>Neba helps you decide what happens next.</em></h2></div>
      <div className="schools-problem-copy"><p>Assessment data often ends its journey in a spreadsheet or report card. The harder work is finding the pattern: which topic held a class back, who needs support, and whether the response actually worked.</p><p>Neba makes that evidence useful without asking teachers to become data analysts.</p></div>
    </section>

    <section className="schools-process" id="how-it-works"><div className="schools-shell">
      <div className="schools-section-heading"><span>FROM ASSESSMENT TO ACTION</span><h2>From result sheet<br />to better next lesson.</h2></div>
      <div className="schools-steps">{steps.map(({ number, icon: Icon, title, copy }) => <article key={number}><div><span>{number}</span><Icon size={23} /></div><h3>{title}</h3><p>{copy}</p></article>)}</div>
    </div></section>

    <section className="schools-outcomes schools-shell">
      <div className="schools-section-heading"><span>USEFUL AT EVERY LEVEL</span><h2>One view of progress.<br />Different decisions.</h2></div>
      <div className="schools-outcome-grid">
        <article><UsersRound size={24} /><span>FOR TEACHERS</span><h3>Know what to reteach.</h3><p>Spend less time interpreting scores and more time acting on the concepts students missed.</p></article>
        <article><BookOpenCheck size={24} /><span>FOR ACADEMIC HEADS</span><h3>See patterns across classes.</h3><p>Compare topics, cohorts, and follow-up outcomes without rebuilding the same workbook every term.</p></article>
        <article><School size={24} /><span>FOR SCHOOL LEADERS</span><h3>See whether intervention worked.</h3><p>Review concise evidence of the action taken, the students reached, and the improvement recorded.</p></article>
      </div>
    </section>

    <section className="schools-trust"><div className="schools-shell schools-trust-grid">
      <div><span className="schools-trust-icon"><LockKeyhole size={25} /></span><span className="schools-section-label">DESIGNED FOR RESPONSIBLE USE</span><h2>Student data deserves careful boundaries.</h2></div>
      <div className="schools-trust-points"><p><ShieldCheck size={18} /><span><strong>Access designed around school roles</strong>Teachers and school leaders see only the records they are authorised to use.</span></p><p><ShieldCheck size={18} /><span><strong>Evidence before automation</strong>Teachers review learning-gap evidence and remain responsible for every intervention.</span></p><p><ShieldCheck size={18} /><span><strong>Start without replacing everything</strong>Use assessment data you already collect, then grow the workspace as it becomes useful.</span></p></div>
    </div></section>

    <section className="schools-final schools-shell" id="pilot">
      <div className="schools-final-copy"><span>START WITH A PILOT</span><h2>Make every assessment more useful.</h2><p>Tell us where your school is today. We will help you choose one class or subject, prepare the data, and complete the first analyse-to-action workflow with your team.</p><p className="schools-pilot-steps">Request received → school context reviewed → pilot workspace prepared → first academic workflow completed.</p></div>
      <div><SchoolsPilotForm /><p className="schools-direct-start">Prefer to explore first? <Link href="/schools/get-started">Create a workspace with sample data.</Link></p></div>
    </section>

    <footer className="schools-footer"><div className="schools-shell"><div><Brand /><span>Neba for Schools</span></div><nav aria-label="Neba for Schools footer links"><a href="#how-it-works">How it works</a><Link href="/schools/pricing">Pricing</Link><a href="#setup">Set up a school</a><Link href="/privacy">Privacy</Link><a href="mailto:support@getneba.com">Contact</a></nav><small>Early access by GetNeba. School leaders control workspace access and data setup.</small></div></footer>
  </main>;
}

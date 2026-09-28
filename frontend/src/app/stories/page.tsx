import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpenText,
  BriefcaseBusiness,
  Check,
  Clock3,
  HandHeart,
  MapPin,
  PackageCheck,
  PartyPopper,
  Sparkles,
  Wrench,
} from "lucide-react";
import { publicPageMetadata } from "@/lib/seo";

export const metadata = publicPageMetadata(
  "GetNeba stories: everyday needs, useful local skills",
  "See illustrative stories of people using GetNeba to find practical help nearby, offer useful skills and make everyday tasks easier.",
  "/stories",
);

const stories = [
  {
    name: "Zainab",
    place: "Wuse, Abuja",
    role: "A busy new parent",
    initials: "ZA",
    icon: PackageCheck,
    tone: "mint",
    challenge: "The baby finally fell asleep—and the week’s groceries were still waiting across town.",
    detail: "Zainab does not need a delivery subscription. She needs one reliable person nearby who can collect a prepared order this afternoon.",
    steps: ["Posts the pickup details and timing", "Adds the neighborhood and a clear reward", "Reviews nearby people who apply", "Shares the exact pickup details privately"],
    outcome: "One errand off her mind, without losing the whole afternoon.",
    action: ["Post an errand", "/tasks/new"],
  },
  {
    name: "Tunde",
    place: "Surulere, Lagos",
    role: "Good with tools, free on Saturdays",
    initials: "TU",
    icon: Wrench,
    tone: "gold",
    challenge: "He has practical skills people need, but word of mouth only travels so far.",
    detail: "Tunde can mount shelves, replace simple fittings and assemble furniture. He wants nearby work that fits around his weekday job.",
    steps: ["Creates a clear offer for the work he does", "Sets his area, availability and starting price", "Responds only to tasks that fit", "Agrees on the full job before travelling"],
    outcome: "Useful Saturdays, new local connections and a reputation built one completed task at a time.",
    action: ["Offer a practical skill", "/offers/new"],
  },
  {
    name: "Amaka",
    place: "Independence Layout, Enugu",
    role: "Running a growing food business",
    initials: "AM",
    icon: BriefcaseBusiness,
    tone: "coral",
    challenge: "A large lunch order came in. Her regular assistant is unavailable and prep starts tomorrow morning.",
    detail: "She needs an extra pair of hands for washing, packing and labeling—not a permanent hire or a long recruitment process.",
    steps: ["Explains the shift, tasks and expected hours", "Sets the reward before anyone applies", "Chooses someone with the right availability", "Keeps coordination in the task conversation"],
    outcome: "The order leaves on time, and a capable local helper gets a fair short job.",
    action: ["Find an extra pair of hands", "/tasks/new"],
  },
  {
    name: "David",
    place: "GRA, Benin City",
    role: "New to the neighborhood",
    initials: "DA",
    icon: BookOpenText,
    tone: "blue",
    challenge: "His daughter needs help with maths, but he does not yet know the local tutors families recommend.",
    detail: "David wants to understand who is available nearby, what they teach and what a first session would cost before making contact.",
    steps: ["Browses tutoring offers in his city", "Reads profiles and relevant task reviews", "Sends a private request with the learning goal", "Confirms timing, location and price directly"],
    outcome: "A clearer first introduction—and one less thing that feels unfamiliar in a new city.",
    action: ["Explore nearby people", "/offers"],
  },
  {
    name: "Ivie",
    place: "Lekki, Lagos",
    role: "Planning a family celebration",
    initials: "IV",
    icon: PartyPopper,
    tone: "violet",
    challenge: "The decorator is ready, but thirty chairs, welcome packs and table settings will not arrange themselves.",
    detail: "Ivie needs two dependable people for a defined three-hour setup window—then the job is done and everyone can enjoy the day.",
    steps: ["Posts one specific setup task", "States the number of helpers and finish time", "Reviews applications before choosing", "Confirms completion with the selected helpers"],
    outcome: "The room is ready before the first guest arrives, without calling every cousin in her phone.",
    action: ["Post an event task", "/tasks/new"],
  },
];

export default function StoriesPage() {
  return <main className="stories-page">
    <section className="stories-hero landing-container">
      <div className="stories-hero-copy">
        <span className="landing-eyebrow"><Sparkles size={15} /> PEOPLE OF GETNEBA</span>
        <h1>Everybody arrives with a different kind of <em>Tuesday.</em></h1>
        <p>A small job that suddenly feels big. A useful skill with nowhere to go. A busy day that needs one more pair of hands. GetNeba helps those stories meet nearby.</p>
        <div className="stories-hero-actions"><Link className="button button-dark" href="/tasks/new">Ask for help<ArrowRight size={18} /></Link><Link href="/offers/new">Or offer what you know <ArrowUpRight size={16} /></Link></div>
      </div>
      <div className="stories-stack" aria-label="A neighborhood full of different needs and skills">
        <div className="story-slip story-slip-one"><span>ZA</span><div><small>NEEDS A HAND</small><strong>One grocery pickup.<br />This afternoon.</strong></div><PackageCheck size={22} /></div>
        <div className="story-slip story-slip-two"><span>TU</span><div><small>HAS A SKILL</small><strong>Furniture assembly.<br />Free on Saturdays.</strong></div><Wrench size={22} /></div>
        <div className="story-slip story-slip-three"><span>AM</span><div><small>NEEDS A TEAMMATE</small><strong>Lunch order prep.<br />Tomorrow, 8am.</strong></div><BriefcaseBusiness size={22} /></div>
        <div className="stories-stack-center"><HandHeart size={30} /><strong>Different days.<br />One neighborhood.</strong></div>
      </div>
    </section>

    <section className="stories-note"><div className="landing-container"><strong>These are illustrative stories.</strong><p>They are realistic examples of how GetNeba can help—not quotes or claims from actual members. Real names, availability and outcomes will vary.</p></div></section>

    <section className="stories-intro landing-container">
      <div><span className="landing-eyebrow">FIVE PEOPLE. FIVE STARTING POINTS.</span><h2>Help looks different<br />from every front door.</h2></div>
      <p>Some people arrive with a task. Others arrive with time, experience or a skill. One GetNeba account can do both.</p>
    </section>

    <section className="story-trail landing-container">
      {stories.map(({ name, place, role, initials, icon: Icon, tone, challenge, detail, steps, outcome, action }, index) => <article className={`story-chapter story-${tone}`} key={name}>
        <div className="story-person">
          <div className="story-avatar" aria-hidden="true"><span>{initials}</span><Icon size={28} /></div>
          <div><small>STORY {String(index + 1).padStart(2, "0")}</small><h2>{name}</h2><p>{role}</p><span><MapPin size={13} />{place}</span></div>
        </div>
        <div className="story-body">
          <span className="story-kicker">THE CHALLENGE</span>
          <h3>{challenge}</h3>
          <p>{detail}</p>
          <div className="story-help"><div className="story-help-heading"><span><HandHeart size={18} /></span><strong>How GetNeba helps</strong></div><ol>{steps.map((step) => <li key={step}><Check size={15} />{step}</li>)}</ol></div>
        </div>
        <div className="story-outcome">
          <Clock3 size={20} />
          <span>WHAT A GOOD OUTCOME LOOKS LIKE</span>
          <blockquote>“{outcome}”</blockquote>
          <Link href={action[1]}>{action[0]}<ArrowUpRight size={16} /></Link>
        </div>
      </article>)}
    </section>

    <section className="stories-bridge"><div className="landing-container"><div><span className="landing-eyebrow">YOUR STORY CAN START EITHER WAY</span><h2>“I need a hand.”<br /><em>“I can help with that.”</em></h2></div><div><p>GetNeba gives both sentences somewhere useful to go. Describe the task you need done, or make the skills you already have easier to find.</p><div className="stories-bridge-actions"><Link className="button button-light" href="/register">Join GetNeba<ArrowRight size={18} /></Link><Link href="/about">Why we built GetNeba<ArrowUpRight size={16} /></Link></div></div></div></section>
  </main>;
}

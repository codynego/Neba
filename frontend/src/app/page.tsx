"use client";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, MapPin, Search, ShieldCheck, Users, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Offer, Page, Task } from "@/lib/types";
import { TaskCard } from "@/components/task-card";
import { OfferCard } from "@/components/offer-card";

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [city, setCity] = useState("");
  useEffect(() => {
    api<Page<Task>>("/tasks/").then((data) => setTasks(data.results.slice(0, 3))).catch(() => {});
    api<Page<Offer>>("/offers/").then((data) => setOffers(data.results.slice(0, 2))).catch(() => {});
  }, []);
  return <main>
    <section className="hero"><div className="container hero-grid">
      <div className="hero-copy">
        <div className="hero-kicker"><span className="pulse-dot" /> YOUR CITY. YOUR COMMUNITY. YOUR NEXT CONNECTION.</div>
        <h1>Good help is <span>closer</span> than you think.</h1>
        <p>Got something that needs doing? Have a skill to share? Find people and opportunities in your city.</p>
        <form className="hero-search" onSubmit={(event) => { event.preventDefault(); location.href = `/tasks?city=${encodeURIComponent(city)}`; }}>
          <MapPin size={21} /><input aria-label="Your city" placeholder="Enter your city" value={city} onChange={(event) => setCity(event.target.value)} />
          <button aria-label="Find tasks" type="submit"><Search size={21} /></button>
        </form>
        <div className="hero-actions"><Link href="/tasks/new" className="button button-dark">Post a task <ArrowUpRight size={18} /></Link><Link href="/offers/new" className="button button-outline">Offer your skills <ArrowUpRight size={18} /></Link></div>
      </div>
      <div className="hero-visual" aria-label="Example of a task post">
        <div className="visual-top"><span>NEARWORK / YOUR CITY</span><span className="visual-live"><span /> OPEN TO NEW TASKS</span></div>
        <div className="visual-main"><div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" /><div className="visual-pin pin-one"></div><div className="visual-pin pin-two"></div><div className="visual-pin pin-three"></div><div className="visual-center">YOU<br />ARE<br />HERE<span>.</span></div></div>
        <div className="visual-bottom"><span>POST A NEED</span><span>FIND A PERSON</span><span>GET IT DONE</span></div>
      </div>
    </div></section>
    <section className="ticker" aria-label="How Nearwork works"><div className="container ticker-inner"><span>Real tasks.</span><span className="ticker-symbol"></span><span>Real people.</span><span className="ticker-symbol"></span><span>Right around you.</span></div></section>
    <section className="section"><div className="container">
      <div className="section-heading"><div><span className="eyebrow">OPPORTUNITIES</span><h2>Things people need<br /><em>help with.</em></h2></div><Link href="/tasks" className="section-link">Explore all tasks <ArrowUpRight size={18} /></Link></div>
      {tasks.length ? <div className="task-grid">{tasks.map((task) => <TaskCard task={task} key={task.id} />)}</div> : <div className="empty-feature"><div><h3>Be the first to post a task.</h3><p>Tell your community what needs doing and what you can pay.</p></div><Link href="/tasks/new" className="button button-dark">Post a task <ArrowUpRight size={18} /></Link></div>}
    </div></section>
    <section className="how-section"><div className="container how-grid"><div><span className="eyebrow">SIMPLE BY DESIGN</span><h2>From I need help<br />to <em>handled.</em></h2><p>Post the details, hear from interested people, then choose who feels right for the job.</p><Link href="/tasks/new" className="button button-light">Get started <ArrowRight size={17} /></Link></div><div className="steps"><div><span className="step-number">01</span><div><h3>Describe the task</h3><p>Add a clear description, location, time, and reward.</p></div></div><div><span className="step-number">02</span><div><h3>Connect locally</h3><p>People in your city can apply with a short introduction.</p></div></div><div><span className="step-number">03</span><div><h3>Choose and complete</h3><p>Pick an applicant and mark the task complete when it is done.</p></div></div></div></div></section>
    <section className="section people-section"><div className="container"><div className="section-heading"><div><span className="eyebrow">PEOPLE WHO CAN HELP</span><h2>Skills in your<br /><em>neighborhood.</em></h2></div><Link href="/offers" className="section-link">Browse all offers <ArrowUpRight size={18} /></Link></div>{offers.length ? <div className="offer-grid">{offers.map((offer) => <OfferCard offer={offer} key={offer.id} />)}</div> : <div className="empty-feature"><div><h3>Have a skill people need?</h3><p>Create an offer so nearby people can discover you.</p></div><Link href="/offers/new" className="button button-dark">Create an offer <ArrowUpRight size={18} /></Link></div>}</div></section>
    <section className="trust-strip"><div className="container trust-grid"><div><Users size={26} /><span>People in your community</span></div><div><Zap size={26} /><span>Small tasks, real impact</span></div><div><ShieldCheck size={26} /><span>Clear agreements upfront</span></div></div></section>
    <section className="bottom-cta"><div className="container bottom-cta-inner"><div><span className="eyebrow">START LOCAL</span><h2>Your next connection<br />could be <em>around the corner.</em></h2></div><Link href="/tasks/new" className="button button-yellow">Post your first task <ArrowUpRight size={18} /></Link></div></section>
  </main>;
}


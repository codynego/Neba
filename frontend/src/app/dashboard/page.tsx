"use client";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, MapPin, Search, ChevronDown, HandHeart, Plus, LocateFixed, Check, Users, Package } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getToken } from "@/lib/api";
import { Category, Offer, Page, Task, User, categories } from "@/lib/types";
import { TaskCard } from "@/components/task-card";
import { OfferCard } from "@/components/offer-card";
import { CategoryIcon } from "@/components/category-icon";
import { LoadingCards } from "@/components/loading-cards";
const quickActions: { category: Category; label: string }[] = [{ category: "moving", label: "Move something" }, { category: "errands", label: "Run an errand" }, { category: "tech", label: "Need a skill" }, { category: "events", label: "Help at an event" }];
export default function DashboardPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [city, setCity] = useState("");
  const [cityDraft, setCityDraft] = useState("");
  const [locationOpen, setLocationOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [mode, setMode] = useState<"tasks" | "people">("tasks");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!getToken()) { router.replace("/login?next=/dashboard"); return; }
    let current = true;
    const savedCity = localStorage.getItem("neba_city");
    setCity(savedCity || ""); setCityDraft(savedCity || "");
    if (getToken()) api<User>("/auth/me/").then((user) => { if (current) { setName(user.display_name || user.username); if (savedCity === null) { setCity(user.city); setCityDraft(user.city); } } }).catch(() => {}).finally(() => { if (current) setReady(true); });
    else setReady(true);
    return () => { current = false; };
  }, [router]);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    const query = new URLSearchParams();
    if (city) query.set("city", city);
    if (category && mode === "tasks") query.set("category", category);
    setLoading(true); setError("");
    const load = mode === "tasks" ? api<Page<Task>>(`/tasks/?${query}`, { signal: controller.signal }).then((data) => setTasks(data.results.slice(0, 6))) : api<Page<Offer>>(`/offers/?${query}`, { signal: controller.signal }).then((data) => setOffers(data.results.slice(0, 6)));
    load.catch((err) => { if (!controller.signal.aborted) setError(err instanceof TypeError ? "We couldn’t load your neighborhood. Try again in a moment." : err.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [city, category, mode, ready, retry]);
  function setLocation(event: FormEvent) {
    event.preventDefault(); const value = cityDraft.trim(); setCity(value); localStorage.setItem("neba_city", value); setLocationOpen(false);
  }
  function startTask(event: FormEvent) {
    event.preventDefault(); router.push(`/tasks/new?description=${encodeURIComponent(description.trim())}`);
  }
  return <main className="home-page container">
    <div className="welcome-row"><div><p className="welcome-label">YOUR EVERYDAY, A LITTLE EASIER</p><h1>{name ? `Hello, ${name}.` : "Hello, neighbor."}<span className="greeting-dot" /></h1><p>Good help is closer than you think.</p></div><div className="location-control"><button className="location-button" onClick={() => setLocationOpen(!locationOpen)} aria-expanded={locationOpen}><MapPin size={17} /><span>{city || "Choose your city"}</span><ChevronDown size={15} /></button>{locationOpen && <form className="location-popover" onSubmit={setLocation}><label htmlFor="home-city">Where should we look?</label><input id="home-city" autoFocus placeholder="e.g. Benin City" value={cityDraft} onChange={(event) => setCityDraft(event.target.value)} /><button className="button button-dark compact" type="submit">Save city <Check size={15} /></button><button className="text-button" type="button" onClick={() => { setCity(""); setCityDraft(""); localStorage.setItem("neba_city", ""); setLocationOpen(false); }}>Browse all cities</button></form>}</div></div>
    <div className="home-columns"><div className="home-primary">
      <section className="need-panel"><span className="need-eyebrow"><span className="availability-dot" /> BIG OR SMALL. ASK YOUR NEIGHBORS.</span><h2>What do you need<br /><span>help with?</span></h2><p>From a quick errand to an extra pair of hands.<br className="desktop-break" /> There’s someone who can help.</p><form className="need-input" onSubmit={startTask}><Search size={21} /><input aria-label="Describe what you need help with" placeholder="Describe what you need done…" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} /><button type="submit" aria-label="Start posting a task"><ArrowRight size={21} /></button></form><div className="need-footer"><span>Less searching. More getting things done.</span><span className="need-small-mark"><HandHeart size={19} /></span></div></section>
      <section className="quick-section" aria-label="Quick actions"><div className="quick-heading"><h2>A little help with…</h2><span>Pick a starting point</span></div><div className="quick-actions">{quickActions.map((action) => <Link key={action.category} href={`/tasks/new?category=${action.category}`}><CategoryIcon category={action.category} /><span>{action.label}</span><ArrowUpRight size={15} /></Link>)}</div></section>
      <section className="neighborhood-section"><div className="section-heading"><div><span className="eyebrow">AROUND THE CORNER</span><h2>{mode === "tasks" ? "Tasks" : "People"} {city ? `in ${city}` : "in your community"}</h2></div><Link className="section-link" href={`/${mode === "tasks" ? "tasks" : "offers"}${city ? `?city=${encodeURIComponent(city)}` : ""}`}>View all <ArrowRight size={16} /></Link></div><div className="browse-controls"><div className="segmented-control" aria-label="Browse your community"><button className={mode === "tasks" ? "active" : ""} aria-pressed={mode === "tasks"} onClick={() => setMode("tasks")}>I can help</button><button className={mode === "people" ? "active" : ""} aria-pressed={mode === "people"} onClick={() => setMode("people")}>I need help</button></div>{mode === "tasks" && <select aria-label="Task category" value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>}</div>
      {error ? <div className="load-error" role="alert"><p>{error}</p><button className="button button-outline compact" onClick={() => setRetry((value) => value + 1)}>Try again</button></div> : loading ? <LoadingCards people={mode === "people"} /> : mode === "tasks" && tasks.length ? <div className="task-grid">{tasks.map((task) => <TaskCard task={task} key={task.id} />)}</div> : mode === "people" && offers.length ? <div className="offer-grid">{offers.map((offer) => <OfferCard offer={offer} key={offer.id} />)}</div> : <div className="empty-list"><span className="empty-icon">{mode === "tasks" ? <HandHeart size={27} /> : <Users size={27} />}</span><h3>{mode === "tasks" ? "Nothing nearby yet." : "No helpers listed here yet."}</h3><p>{mode === "tasks" ? "Be the first to ask for a little help in your neighborhood." : "Try another city, or share a skill your neighbors might need."}</p><Link className="button button-dark" href={mode === "tasks" ? "/tasks/new" : "/offers/new"}>{mode === "tasks" ? "Post a task" : "Offer your skills"}<Plus size={17} /></Link></div>}</section>
    </div><aside className="home-secondary"><section className="neighborhood-note"><div className="note-top"><LocateFixed size={19} /><span>CLOSER IS BETTER</span></div><div className="proximity-art" aria-hidden="true"><span className="proximity-ring ring-outer" /><span className="proximity-ring ring-inner" /><span className="neighbor-point point-one"><Package size={17} /></span><span className="neighbor-point point-two"><HandHeart size={17} /></span><span className="neighbor-point point-three"><Users size={17} /></span><span className="proximity-center"><MapPin size={28} /></span><span className="proximity-label">your neighborhood</span></div><h3>Good people.<br />Right around you.</h3><p>Choose your city to discover tasks and skills in your community.</p><button className="note-link" onClick={() => setLocationOpen(true)}>{city ? "Change your city" : "Explore your neighborhood"}<ArrowRight size={17} /></button></section><section className="helper-invite"><span className="invite-icon"><HandHeart size={24} /></span><span className="eyebrow">GOT A LITTLE TIME?</span><h3>Someone needs<br />a hand like yours.</h3><p>Put your skills to work and earn by helping people close by.</p><Link className="button button-outline full-width" href="/offers/new">I can help <ArrowUpRight size={17} /></Link></section><div className="community-tip"><span className="tip-line" /><p>Moving a fridge. Picking up groceries. Setting up a party.</p><strong>Everyday things.<br />Extraordinary neighbors.</strong></div></aside></div>
  </main>;
}

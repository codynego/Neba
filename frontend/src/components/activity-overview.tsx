"use client";

import Link from "next/link";
import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { api } from "@/lib/api";
import { Application, Offer, Page, Task, naira, rewardLabel } from "@/lib/types";
import { TrustBadges } from "./trust";
import { SafetyActions } from "./safety-actions";

type Section = "bookings" | "invitations" | "tasks" | "received" | "sent" | "offers";
type ActivityItem = Task | Offer | Application;

const sections: { id: Section; tab: string; title: string; description: string; placeholder: string }[] = [
  { id: "bookings", tab: "Bookings", title: "My bookings", description: "Accepted work you’re coordinating or completing.", placeholder: "Search bookings" },
  { id: "invitations", tab: "Skill requests", title: "Requests for my skills", description: "Private requests sent directly to you.", placeholder: "Search skill requests" },
  { id: "tasks", tab: "My tasks", title: "My tasks", description: "Requests you’ve posted for your neighborhood.", placeholder: "Search my tasks" },
  { id: "received", tab: "Applicants", title: "Applications received", description: "People who have offered to help with your tasks.", placeholder: "Search applicants or tasks" },
  { id: "sent", tab: "Applications", title: "My applications", description: "Tasks you’ve applied to help with.", placeholder: "Search my applications" },
  { id: "offers", tab: "Offers", title: "My skill offers", description: "Skills you’ve shared with people nearby.", placeholder: "Search my offers" },
];

const blankPage = (): Page<ActivityItem> => ({ count: 0, next: null, previous: null, results: [] });
const initialNumbers = (): Record<Section, number | null> => ({ bookings: null, invitations: null, tasks: null, received: null, sent: null, offers: null });
const initialText = (): Record<Section, string> => ({ bookings: "", invitations: "", tasks: "", received: "", sent: "", offers: "" });
const initialData = (): Record<Section, Page<ActivityItem>> => ({ bookings: blankPage(), invitations: blankPage(), tasks: blankPage(), received: blankPage(), sent: blankPage(), offers: blankPage() });
const endpoints: Record<Section, string> = {
  bookings: "/tasks/?bookings=true",
  invitations: "/tasks/?invitations=true",
  tasks: "/tasks/?mine=true",
  received: "/applications/?received=true",
  sent: "/applications/?mine=true",
  offers: "/offers/?mine=true",
};

const applicationStatus: Record<Application["status"], string> = {
  pending: "Awaiting review",
  shortlisted: "Shortlisted · chat open",
  offered: "Booking offer awaiting reply",
  accepted: "Booked",
  declined: "Closed",
  withdrawn: "Withdrawn",
};

export function ActivityOverview() {
  const [active, setActive] = useState<Section>("bookings");
  const [pages, setPages] = useState<Record<Section, number>>({ bookings: 1, invitations: 1, tasks: 1, received: 1, sent: 1, offers: 1 });
  const [counts, setCounts] = useState(initialNumbers);
  const [drafts, setDrafts] = useState(initialText);
  const [queries, setQueries] = useState(initialText);
  const [datasets, setDatasets] = useState(initialData);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const currentPage = pages[active];
  const currentQuery = queries[active];
  const currentData = datasets[active];
  const section = sections.find((item) => item.id === active) ?? sections[0];

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const search = currentQuery ? `&search=${encodeURIComponent(currentQuery)}` : "";
      const result = await api<Page<ActivityItem>>(`${endpoints[active]}&page=${currentPage}${search}`, { signal });
      setDatasets((current) => ({ ...current, [active]: result }));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [active, currentPage, currentQuery]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).catch((err) => { if (!controller.signal.aborted) setError(err.message); });
    const timer = setInterval(() => { if (!document.hidden) load().catch(() => {}); }, 20000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [load]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all(sections.map((item) => api<Page<ActivityItem>>(`${endpoints[item.id]}&active=true&page=1`, { signal: controller.signal }).then((result) => [item.id, result.count] as const)))
      .then((results) => setCounts((current) => ({ ...current, ...Object.fromEntries(results) as Record<Section, number> })))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  function selectSection(sectionId: Section) {
    setActive(sectionId);
    setError("");
  }

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? sections.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + sections.length) % sections.length;
    selectSection(sections[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = drafts[active].trim();
    if (next === currentQuery && currentPage === 1) { load().catch((err) => setError(err.message)); return; }
    setPages((current) => ({ ...current, [active]: 1 }));
    setQueries((current) => ({ ...current, [active]: next }));
  }

  function clearSearch() {
    setDrafts((current) => ({ ...current, [active]: "" }));
    setPages((current) => ({ ...current, [active]: 1 }));
    setQueries((current) => ({ ...current, [active]: "" }));
  }

  function pagination() {
    if (!currentData.previous && !currentData.next) return null;
    return <nav className="pagination-controls" aria-label={`${section.title} pages`}><button className="small-button" disabled={!currentData.previous || loading} onClick={() => setPages((current) => ({ ...current, [active]: current[active] - 1 }))}>Previous</button><span>Page {currentPage}</span><button className="small-button" disabled={!currentData.next || loading} onClick={() => setPages((current) => ({ ...current, [active]: current[active] + 1 }))}>Next</button></nav>;
  }

  function taskRows(data: Page<ActivityItem>) {
    return (data.results as Task[]).map((task) => <div className="dash-row" key={task.id}><div><Link href={`/tasks/${task.public_id || task.id}`}><strong>{task.title}</strong></Link><p>{task.city} · {rewardLabel(task)} · {task.is_private ? "Private request" : "Neighborhood task"}</p>{task.scheduled_for ? <p>{new Date(task.scheduled_for).toLocaleString("en-NG")}</p> : null}</div><Link className="small-button" href={`/tasks/${task.public_id || task.id}`}>{task.status === "assigned" ? "Open booking" : task.status === "open" ? "View request" : task.status}</Link></div>);
  }

  function receivedRows(data: Page<ActivityItem>) {
    return (data.results as Application[]).map((application) => <div className="dash-row application-row" key={application.id}><div><Link href={`/u/${application.applicant_username || application.applicant_public_id || application.applicant}`}><strong>{application.applicant_name || "Applicant"}</strong></Link><p><Link href={`/tasks/${application.task_public_id || application.task}`}>{application.task_title}</Link> · {applicationStatus[application.status]}</p><TrustBadges trust={application.applicant_trust} /><p>{application.message}</p><SafetyActions member={application.applicant} name={application.applicant_name} task={application.task} /></div><div className="application-actions"><Link className="small-button" href={application.status === "accepted" ? `/tasks/${application.task_public_id || application.task}` : `/applications/${application.id}`}>{application.status === "pending" ? "Review applicant" : application.status === "shortlisted" ? "Open candidate chat" : application.status === "offered" ? "Review offer" : application.status === "accepted" ? "Open booking" : "View details"}</Link></div></div>);
  }

  function sentRows(data: Page<ActivityItem>) {
    return (data.results as Application[]).map((application) => <div className="dash-row" key={application.id}><div><Link href={`/tasks/${application.task_public_id || application.task}`}><strong>{application.task_title}</strong></Link><p>{applicationStatus[application.status]}</p></div><Link className="small-button" href={application.status === "accepted" ? `/tasks/${application.task_public_id || application.task}` : `/applications/${application.id}`}>{application.status === "accepted" ? "Open booking" : application.status === "offered" ? "Review booking offer" : application.status === "shortlisted" ? "Open candidate chat" : "View application"}</Link></div>);
  }

  function offerRows(data: Page<ActivityItem>) {
    return (data.results as Offer[]).map((offer) => <div className="dash-row" key={offer.id}><div><Link href={`/offers/${offer.public_id || offer.id}`}><strong>{offer.title}</strong></Link><p>{offer.city} · From {naira(offer.starting_price)} · {offer.active ? "Active" : "Closed"}</p></div></div>);
  }

  const actions: Partial<Record<Section, { href: string; label: string }>> = { tasks: { href: "/tasks/new", label: "New task" }, sent: { href: "/tasks", label: "Find tasks" }, offers: { href: "/offers/new", label: "New offer" } };
  const emptyMessages: Record<Section, string> = {
    bookings: "Accepted work appears here. Open a booking to message, reschedule, or confirm completion.",
    invitations: "Private helper requests will appear here. You choose whether to accept.",
    tasks: "No tasks posted yet.",
    received: "No applications received yet.",
    sent: "You haven’t applied to any tasks yet.",
    offers: "No offers yet. Add your skills and availability on your profile.",
  };
  const action = actions[active];
  const rows = active === "received" ? receivedRows(currentData) : active === "sent" ? sentRows(currentData) : active === "offers" ? offerRows(currentData) : taskRows(currentData);

  return <main className="dashboard-page container activity-page">
    <div className="listing-heading"><div><span className="eyebrow">KEEP THINGS MOVING</span><h1>Your <em>activity.</em></h1><p>Bookings, helper requests, applications, and offers—one clear view at a time.</p></div><Link className="button button-outline" href="/notifications">View notifications</Link></div>
    <div className="activity-tabs" role="tablist" aria-label="Activity sections">{sections.map((item, index) => <button key={item.id} ref={(element) => { tabRefs.current[index] = element; }} id={`activity-tab-${item.id}`} role="tab" aria-selected={active === item.id} aria-controls="activity-panel" aria-label={`${item.tab}: ${counts[item.id] ?? "loading"}`} tabIndex={active === item.id ? 0 : -1} onClick={() => selectSection(item.id)} onKeyDown={(event) => handleTabKey(event, index)}><span className="activity-tab-label">{item.tab}</span><span className="activity-tab-badge" aria-hidden="true">{counts[item.id] ?? "…"}</span></button>)}</div>
    {error ? <p className="error-box" role="alert">{error}</p> : null}
    <section className="dash-panel activity-panel" id="activity-panel" role="tabpanel" aria-labelledby={`activity-tab-${active}`} tabIndex={0}>
      <div className="activity-panel-heading"><div><span className="activity-count">{currentData.count}</span><div><h2>{section.title}</h2><p>{section.description}</p>{active === "received" && <small className="candidate-list-note">Shortlist to chat. A booking starts only after the helper confirms your offer.</small>}</div></div>{action ? <Link href={action.href}>{action.label}</Link> : null}</div>
      <form className="activity-search" role="search" onSubmit={search}><Search size={18} aria-hidden="true" /><label className="sr-only" htmlFor={`activity-search-${active}`}>{section.placeholder}</label><input id={`activity-search-${active}`} value={drafts[active]} onChange={(event) => setDrafts((current) => ({ ...current, [active]: event.target.value }))} placeholder={section.placeholder} />{drafts[active] ? <button className="activity-search-clear" type="button" aria-label={`Clear ${section.placeholder.toLowerCase()}`} onClick={clearSearch}><X size={16} /></button> : null}<button className="small-button" type="submit" disabled={loading}>Search</button></form>
      <div className="activity-results" aria-live="polite" aria-busy={loading}>{loading ? <p className="panel-empty" role="status">Loading {section.title.toLowerCase()}…</p> : rows.length ? rows : <p className="panel-empty">{currentQuery ? `No results for “${currentQuery}”.` : emptyMessages[active]}</p>}</div>
      {pagination()}
    </section>
  </main>;
}

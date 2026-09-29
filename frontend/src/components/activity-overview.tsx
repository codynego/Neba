"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Application, Offer, Page, Task, naira } from "@/lib/types";
import { TrustBadges } from "./trust";
import { SafetyActions } from "./safety-actions";
type Section = "bookings" | "invitations" | "tasks" | "offers" | "sent" | "received";
const empty = <T,>(): Page<T> => ({ count: 0, next: null, previous: null, results: [] });
export function ActivityOverview() {
  const [pages, setPages] = useState<Record<Section, number>>({ bookings: 1, invitations: 1, tasks: 1, offers: 1, sent: 1, received: 1 });
  const [bookings, setBookings] = useState<Page<Task>>(empty());
  const [invitations, setInvitations] = useState<Page<Task>>(empty());
  const [tasks, setTasks] = useState<Page<Task>>(empty());
  const [offers, setOffers] = useState<Page<Offer>>(empty());
  const [sent, setSent] = useState<Page<Application>>(empty());
  const [received, setReceived] = useState<Page<Application>>(empty());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const [jobs, requests, mine, services, applied, applicants] = await Promise.all([
      api<Page<Task>>(`/tasks/?bookings=true&page=${pages.bookings}`), api<Page<Task>>(`/tasks/?invitations=true&page=${pages.invitations}`), api<Page<Task>>(`/tasks/?mine=true&page=${pages.tasks}`),
      api<Page<Offer>>(`/offers/?mine=true&page=${pages.offers}`), api<Page<Application>>(`/applications/?page=${pages.sent}`), api<Page<Application>>(`/applications/?received=true&page=${pages.received}`),
    ]); setBookings(jobs); setInvitations(requests); setTasks(mine); setOffers(services); setSent(applied); setReceived(applicants); setLoading(false);
  }, [pages]);
  useEffect(() => { load().catch((err) => { setError(err.message); setLoading(false); }); const timer = setInterval(() => { if (!document.hidden) load().catch(() => {}); }, 20000); return () => clearInterval(timer); }, [load]);
  async function act(path: string) { if (busy) return; setBusy(true); setError(""); try { await api(path, { method: "POST" }); await load(); window.dispatchEvent(new Event("neba_notifications")); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }
  function pagination(section: Section, data: Page<unknown>) { return data.count > 20 ? <div className="pagination-controls"><button className="small-button" disabled={!data.previous || busy} onClick={() => setPages((current) => ({ ...current, [section]: current[section] - 1 }))}>Previous</button><span>Page {pages[section]}</span><button className="small-button" disabled={!data.next || busy} onClick={() => setPages((current) => ({ ...current, [section]: current[section] + 1 }))}>Next</button></div> : null; }
  function rows(data: Page<Task>) { return data.results.map((task) => <div className="dash-row" key={task.id}><div><Link href={`/tasks/${task.public_id || task.id}`}><strong>{task.title}</strong></Link><p>{task.city} · {naira(task.reward_amount)} · {task.is_private ? "Private request" : "Neighborhood task"}</p>{task.scheduled_for && <p>{new Date(task.scheduled_for).toLocaleString("en-NG")}</p>}</div><Link className="small-button" href={`/tasks/${task.public_id || task.id}`}>{task.status === "assigned" ? "Open booking" : task.status === "open" ? "View request" : task.status}</Link></div>); }
  return <main className="dashboard-page container"><div className="listing-heading"><div><span className="eyebrow">KEEP THINGS MOVING</span><h1>Your <em>activity.</em></h1><p>Bookings, conversations, helper requests, and applications.</p></div><Link className="button button-outline" href="/notifications">View notifications</Link></div>{error && <p className="error-box" role="alert">{error}</p>}{loading && <p role="status">Loading your activity...</p>}<div className="dashboard-grid">
    <section className="dash-panel"><div className="panel-heading"><h2>My bookings ({bookings.count})</h2></div>{bookings.results.length ? rows(bookings) : <p className="panel-empty">Accepted work appears here. Open a booking to message, reschedule, or confirm completion.</p>}{pagination("bookings", bookings)}</section>
    <section className="dash-panel"><div className="panel-heading"><h2>Requests for my skills ({invitations.count})</h2></div>{invitations.results.length ? rows(invitations) : <p className="panel-empty">Private helper requests will appear here. You choose whether to accept.</p>}{pagination("invitations", invitations)}</section>
    <section className="dash-panel"><div className="panel-heading"><h2>My tasks ({tasks.count})</h2><Link href="/tasks/new">New task</Link></div>{tasks.results.length ? rows(tasks) : <p className="panel-empty">No tasks posted yet.</p>}{pagination("tasks", tasks)}</section>
    <section className="dash-panel"><div className="panel-heading"><h2>Applications received ({received.count})</h2></div>{received.results.length ? received.results.map((application) => <div className="dash-row application-row" key={application.id}><div><Link href={`/members/${application.applicant_username || application.applicant_public_id || application.applicant}`}><strong>{application.applicant_name || "Applicant"}</strong></Link><p><Link href={`/tasks/${application.task_public_id || application.task}`}>{application.task_title}</Link> · {application.status}</p><TrustBadges trust={application.applicant_trust} /><p>{application.message}</p><SafetyActions member={application.applicant} name={application.applicant_name} task={application.task} /></div>{application.status === "pending" && <div className="application-actions"><button className="small-button" disabled={busy} onClick={() => act(`/applications/${application.id}/accept/`)}>Accept helper</button><button className="text-button" disabled={busy} onClick={() => act(`/applications/${application.id}/decline/`)}>Decline</button></div>}</div>) : <p className="panel-empty">No applications yet.</p>}{pagination("received", received)}</section>
    <section className="dash-panel"><div className="panel-heading"><h2>My applications ({sent.count})</h2><Link href="/tasks">Find tasks</Link></div>{sent.results.length ? sent.results.map((application) => <div className="dash-row" key={application.id}><div><Link href={`/tasks/${application.task_public_id || application.task}`}><strong>{application.task_title}</strong></Link><p>{application.status}</p></div>{application.status === "pending" && <button className="small-button" disabled={busy} onClick={() => act(`/applications/${application.id}/withdraw/`)}>Withdraw</button>}</div>) : <p className="panel-empty">No applications yet.</p>}{pagination("sent", sent)}</section>
    <section className="dash-panel"><div className="panel-heading"><h2>My skill offers ({offers.count})</h2><Link href="/offers/new">New offer</Link></div>{offers.results.length ? offers.results.map((offer) => <div className="dash-row" key={offer.id}><div><Link href={`/offers/${offer.public_id || offer.id}`}><strong>{offer.title}</strong></Link><p>{offer.city} · From {naira(offer.starting_price)} · {offer.active ? "Active" : "Closed"}</p></div></div>) : <p className="panel-empty">No offers yet. Add your skills and availability on your profile.</p>}{pagination("offers", offers)}</section>
  </div></main>;
}

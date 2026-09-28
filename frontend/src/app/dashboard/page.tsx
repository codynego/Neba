"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { api, getToken } from "@/lib/api";
import { Application, Offer, Page, Task, User, naira } from "@/lib/types";
export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [sent, setSent] = useState<Application[]>([]);
  const [received, setReceived] = useState<Application[]>([]);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const [me, mine, services, applied, applicants] = await Promise.all([
        api<User>("/auth/me/"), api<Page<Task>>("/tasks/?mine=true"),
        api<Page<Offer>>("/offers/?mine=true"), api<Page<Application>>("/applications/"),
        api<Page<Application>>("/applications/?received=true"),
      ]);
      setUser(me); setTasks(mine.results); setOffers(services.results);
      setSent(applied.results); setReceived(applicants.results);
    } catch (error) { setError((error as Error).message); }
  }, []);
  useEffect(() => { if (!getToken()) router.replace("/login?next=/dashboard"); else load(); }, [router, load]);
  async function act(path: string) {
    try { await api(path, { method: "POST" }); await load(); }
    catch (error) { setError((error as Error).message); }
  }
  return <main className="dashboard-page"><div className="container">
    <div className="listing-heading"><div><span className="eyebrow">YOUR SPACE</span><h1>Welcome, <em>{user?.display_name || user?.username || "friend"}.</em></h1><p>Your tasks, offers, and applications in one place.</p></div><Link href="/tasks/new" className="button button-dark">Post a task <ArrowUpRight size={18} /></Link></div>
    {error && <p className="error-box">{error}</p>}
    <div className="dashboard-grid"><section className="dash-panel"><div className="panel-heading"><h2>My tasks</h2><Link href="/tasks/new">New task â†—</Link></div>{tasks.length ? tasks.map((task) => <div className="dash-row" key={task.id}><div><Link href={`/tasks/${task.id}`}><strong>{task.title}</strong></Link><p>{task.city} Â· {naira(task.reward_amount)} Â· <span className="status">{task.status}</span></p></div>{task.status === "assigned" && <button className="small-button" onClick={() => act(`/tasks/${task.id}/complete/`)}>Mark complete</button>}</div>) : <p className="panel-empty">No tasks posted yet.</p>}</section>
      <section className="dash-panel"><div className="panel-heading"><h2>My offers</h2><Link href="/offers/new">New offer â†—</Link></div>{offers.length ? offers.map((offer) => <div className="dash-row" key={offer.id}><div><Link href={`/offers/${offer.id}`}><strong>{offer.title}</strong></Link><p>{offer.city} Â· From {naira(offer.starting_price)} Â· {offer.active ? "Active" : "Closed"}</p></div></div>) : <p className="panel-empty">No offers published yet.</p>}</section>
      <section className="dash-panel"><div className="panel-heading"><h2>People interested in my tasks</h2></div>{received.length ? received.map((application) => <div className="dash-row" key={application.id}><div><strong>{application.applicant_name || "Applicant"}</strong><p>For {application.task_title} Â· <span className="status">{application.status}</span></p><p className="application-message">{application.message}</p><p>Contact: {application.contact_phone}</p></div>{application.status === "pending" && <button className="small-button" onClick={() => act(`/applications/${application.id}/accept/`)}>Accept</button>}</div>) : <p className="panel-empty">Applications to your tasks will appear here.</p>}</section>
      <section className="dash-panel"><div className="panel-heading"><h2>My applications</h2><Link href="/tasks">Find tasks â†—</Link></div>{sent.length ? sent.map((application) => <div className="dash-row" key={application.id}><div><strong>{application.task_title}</strong><p><span className="status">{application.status}</span></p></div></div>) : <p className="panel-empty">You have not applied to a task yet.</p>}</section></div>
  </div></main>;
}


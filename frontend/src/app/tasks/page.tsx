"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { api } from "@/lib/api";
import { categories, Page, Task } from "@/lib/types";
import { TaskCard } from "@/components/task-card";
export default function TasksPage() {
  const [city, setCity] = useState("");
  useEffect(() => { setCity(new URLSearchParams(window.location.search).get("city") || ""); }, []);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const query = new URLSearchParams();
    if (city) query.set("city", city);
    if (category) query.set("category", category);
    if (search) query.set("search", search);
    const timer = setTimeout(() => {
      setLoading(true);
      api<Page<Task>>(`/tasks/?${query}`).then((data) => { setTasks(data.results); setError(""); }).catch((err) => setError(err.message)).finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [city, category, search]);
  return <main className="listing-page"><div className="container">
    <div className="listing-heading"><div><span className="eyebrow">FIND YOUR NEXT OPPORTUNITY</span><h1>Tasks near <em>you.</em></h1><p>Explore real requests from people in your city.</p></div><Link className="button button-dark" href="/tasks/new">Post a task <ArrowUpRight size={18} /></Link></div>
    <div className="filters"><label className="filter-search"><Search size={18} /><input placeholder="Search tasks" value={search} onChange={(e) => setSearch(e.target.value)} /></label><input aria-label="Filter by city" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} /><select aria-label="Filter by category" value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
    {error ? <p className="error-box">{error}. Make sure the Django server is running.</p> : loading ? <p className="loading">Finding tasks...</p> : tasks.length ? <div className="task-grid">{tasks.map((task) => <TaskCard task={task} key={task.id} />)}</div> : <div className="empty-list"><h2>No open tasks found.</h2><p>Try another city or category, or be the first to post here.</p><Link href="/tasks/new" className="button button-dark">Post a task <ArrowUpRight size={18} /></Link></div>}
  </div></main>;
}


"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, Plus, SlidersHorizontal } from "lucide-react";
import { api } from "@/lib/api";
import { categories, Offer, Page, Task, availabilityLabels } from "@/lib/types";
import { TaskCard } from "./task-card";
import { OfferCard } from "./offer-card";
import { LoadingCards } from "./loading-cards";
import { LocationSuggestionInput } from "./location-suggestion-input";
type Filters = { city: string; neighborhood: string; category: string; search: string; timing: string; availability: string; sort: string; min_reward: string; max_reward: string };
const defaults: Filters = { city: "", neighborhood: "", category: "", search: "", timing: "", availability: "", sort: "newest", min_reward: "", max_reward: "" };
export function NearbyList({ people = false }: { people?: boolean }) {
  const params = useSearchParams();
  const [filters, setFilters] = useState<Filters>(defaults);
  const [ready, setReady] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [page, setPage] = useState(1);
  const [next, setNext] = useState(false);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(true);
  useEffect(() => { const value = { ...defaults }; (Object.keys(value) as (keyof Filters)[]).forEach((key) => { value[key] = params.get(key) || (key === "city" && !params.has("city") ? localStorage.getItem("neba_city") || "" : defaults[key]); }); setFilters(value); setPage(1); setReady(true); }, [params]);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController(); setLoading(true); setError("");
    const query = new URLSearchParams();
    const keys: (keyof Filters)[] = people ? ["city", "neighborhood", "category", "search", "availability", "sort"] : ["city", "neighborhood", "category", "search", "timing", "sort", "min_reward", "max_reward"];
    keys.forEach((key) => { if (filters[key].trim()) query.set(key, filters[key].trim()); }); query.set("page", String(page));
    const timer = setTimeout(() => {
      const request = people ? api<Page<Offer>>(`/offers/?${query}`, { signal: controller.signal }).then((data) => { setOffers(data.results); setNext(!!data.next); setCount(data.count); }) : api<Page<Task>>(`/tasks/?${query}`, { signal: controller.signal }).then((data) => { setTasks(data.results); setNext(!!data.next); setCount(data.count); });
      request.catch((err) => { if (!controller.signal.aborted) setError(err.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [filters, ready, people, page, retry]);
  function update(key: keyof Filters, value: string) { setFilters((previous) => ({ ...previous, [key]: value })); setPage(1); }
  function reset() { setFilters({ ...defaults, city: filters.city }); setPage(1); }
  const cityQuery = `?city=${encodeURIComponent(filters.city)}`;
  return <main className="listing-page container"><div className="listing-heading"><div><span className="eyebrow">YOUR NEIGHBORHOOD, CONNECTED</span><h1>{people ? <>Find someone <em>nearby.</em></> : <>A little help. <em>A little extra.</em></>}</h1><p>{people ? "Find skills, availability, and completed-task reviews." : "Find work that fits your neighborhood, time, and reward."}</p></div><Link className="button button-dark" href={people ? "/offers/new" : "/tasks/new"}>{people ? "Offer your skills" : "Post a task"}<Plus size={17} /></Link></div><div className="segmented-control listing-tabs"><Link className={!people ? "active" : ""} href={`/tasks${cityQuery}`}>Tasks</Link><Link className={people ? "active" : ""} href={`/offers${cityQuery}`}>People</Link></div><button type="button" className={`filter-toggle${filtersOpen ? "" : " is-collapsed"}`} onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen}> {filtersOpen ? "Hide filters" : "Show filters"} </button>
    <section className="discovery-filters" aria-label="Filter nearby listings"><div className="filter-search"><Search size={18} /><input aria-label={people ? "Search helpers" : "Search tasks"} placeholder={people ? "Search skills or a helper’s name" : "Search a task, skill, or keyword"} value={filters.search} onChange={(event) => update("search", event.target.value)} /></div><div className="filter-section"><div className="filter-section-heading"><span>Where</span><small>Start close to home</small></div><div className="filter-fields"><LocationSuggestionInput kind="city" label="City" placeholder="Choose a city" value={filters.city} onChange={(value) => update("city", value)} /><LocationSuggestionInput kind="neighborhood" city={filters.city} label="Neighborhood" placeholder={filters.city ? "Choose an area" : "Choose a city first"} value={filters.neighborhood} onChange={(value) => update("neighborhood", value)} /></div></div><div className="filter-section"><div className="filter-section-heading"><span>{people ? "Find the right helper" : "Find the right task"}</span><SlidersHorizontal size={15} /></div><div className="filter-fields">{people ? <><label>Category<select value={filters.category} onChange={(event) => update("category", event.target.value)}>{categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label><label>Availability<select value={filters.availability} onChange={(event) => update("availability", event.target.value)}><option value="">Any availability</option>{Object.entries(availabilityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Order results<select value={filters.sort} onChange={(event) => update("sort", event.target.value)}><option value="newest">Newest offers</option><option value="top_rated">Highest rated</option><option value="price_low">Lowest starting price</option><option value="price_high">Highest starting price</option></select></label></> : <><label>Category<select value={filters.category} onChange={(event) => update("category", event.target.value)}>{categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label><label>When<select value={filters.timing} onChange={(event) => update("timing", event.target.value)}><option value="">Any time</option><option value="flexible">Flexible timing</option><option value="today">Today</option><option value="week">Next 7 days</option></select></label><label>Order results<select value={filters.sort} onChange={(event) => update("sort", event.target.value)}><option value="newest">Newest tasks</option><option value="soonest">Soonest scheduled</option><option value="reward_high">Highest reward</option><option value="reward_low">Lowest reward</option></select></label></>}</div></div>{!people && <details className="filter-advanced"><summary>Reward range <span>Optional</span></summary><div><label>Minimum reward (₦)<input type="number" min={0} step="0.01" value={filters.min_reward} onChange={(event) => update("min_reward", event.target.value)} placeholder="0" /></label><label>Maximum reward (₦)<input type="number" min={0} step="0.01" value={filters.max_reward} onChange={(event) => update("max_reward", event.target.value)} placeholder="No limit" /></label></div></details>}</section><div className="discovery-result-heading"><span>{loading ? "Finding matches..." : `${count} ${people ? "offers" : "tasks"} found`}</span><button className="text-button" onClick={reset}>Reset filters</button></div>
    {error ? <div className="load-error" role="alert"><p>{error}</p><button className="button button-outline compact" onClick={() => setRetry(retry + 1)}>Try again</button></div> : loading ? <LoadingCards people={people} /> : people && offers.length ? <div className="offer-grid">{offers.map((offer) => <OfferCard key={offer.id} offer={offer} />)}</div> : !people && tasks.length ? <div className="task-grid">{tasks.map((task) => <TaskCard key={task.id} task={task} />)}</div> : <div className="empty-list"><h2>No matches yet.</h2><p>Try a different neighborhood, time, or category.</p><button className="button button-outline" onClick={reset}>Broaden your search</button></div>}<div className="pagination-controls"><button className="small-button" disabled={page === 1 || loading} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page}</span><button className="small-button" disabled={!next || loading} onClick={() => setPage(page + 1)}>Next</button></div>
  </main>;
}

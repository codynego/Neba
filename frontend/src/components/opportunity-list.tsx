"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Bookmark, Filter, Link2, Search, SlidersHorizontal, X } from "lucide-react";
import { api, getToken } from "@/lib/api";
import type { Opportunity, Page } from "@/lib/types";
import { opportunityPath } from "@/lib/routes";
import { OpportunityCard, opportunityLabels } from "./opportunity-card";

const goals = [{ value: "", label: "All opportunities" }, { value: "internship", label: "Internships" }, { value: "job", label: "Jobs" }, { value: "scholarship", label: "Scholarships" }, { value: "grant", label: "Grants" }, { value: "training", label: "Training" }];

export function OpportunityList({ matches = false }: { matches?: boolean }) {
  const [items, setItems] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [ready, setReady] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const generation = useRef(0);
  const endpoint = matches ? "/opportunities/matches/" : "/opportunities/";

  useEffect(() => { const params = new URLSearchParams(window.location.search); setQuery(params.get("search") || ""); setSearch(params.get("search") || ""); setCategory(params.get("category") || ""); setReady(true); }, []);
  const load = useCallback(async (number: number, replace: boolean, signal?: AbortSignal) => {
    const requestGeneration = generation.current;
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page: String(number) });
      if (search) params.set("search", search);
      if (category) params.set("category", category);
      const result = await api<Page<Opportunity>>(`${endpoint}?${params}`, { signal });
      if (signal?.aborted || generation.current !== requestGeneration) return;
      setItems((current) => replace ? result.results : [...current, ...result.results.filter((item) => !current.some((row) => row.public_id === item.public_id))]);
      setHasMore(Boolean(result.next)); setPage(number);
    } catch { if (!signal?.aborted && generation.current === requestGeneration) setError("We couldn’t load opportunities. Please try again."); }
    finally { if (!signal?.aborted && generation.current === requestGeneration) setLoading(false); }
  }, [category, endpoint, search]);
  useEffect(() => {
    if (!ready) return;
    generation.current += 1;
    const controller = new AbortController();
    setItems([]); setPage(1); setHasMore(false);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (category) params.set("category", category);
    window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
    void load(1, true, controller.signal);
    return () => controller.abort();
  }, [load, ready, search, category]);

  async function save(item: Opportunity) {
    if (!getToken()) { window.location.assign(`/login?next=${encodeURIComponent(opportunityPath(item.title, item.public_id))}`); return; }
    if (saving) return;
    setSaving(item.public_id); setError("");
    try { await api(`/opportunities/${item.public_id}/save/`, { method: item.saved_status ? "DELETE" : "POST", body: JSON.stringify({}) }); setItems((current) => current.map((row) => row.public_id === item.public_id ? { ...row, saved_status: row.saved_status ? null : "saved" } : row)); }
    catch { setError("That opportunity couldn’t be saved. Please try again."); }
    finally { setSaving(null); }
  }
  const visible = items.filter((item) => !remoteOnly || item.is_remote);
  function clearFilters() { setQuery(""); setSearch(""); setCategory(""); setRemoteOnly(false); }

  return <main className="nb-explore container">
    <header className="nb-explore-heading"><div><span className="nb-kicker">A GOOD PLACE TO START</span><h1>Find your next move.</h1><p>Work, learn, build, or fund an idea. There’s more than one way forward.</p></div><Link href="/my-opportunities/new" className="nb-button nb-button-green"><Link2 size={18} /> Share an opportunity</Link></header>
    <form className="nb-search" onSubmit={(event) => { event.preventDefault(); setSearch(query.trim()); }}><Search size={21} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try a role, skill, or organisation" aria-label="Search opportunities" /><button type="submit">Search <ArrowRight size={16} /></button></form>
    <div className="nb-explore-tabs"><nav aria-label="Opportunity types">{goals.map((goal) => <button key={goal.value} type="button" className={category === goal.value ? "active" : ""} onClick={() => setCategory(goal.value)} aria-pressed={category === goal.value}>{goal.label}</button>)}</nav><button className={`nb-filter-toggle${filtersOpen ? " active" : ""}`} onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen} aria-controls="opportunity-filters"><SlidersHorizontal size={17} />Filters</button></div>
    {filtersOpen && <div className="nb-filters" id="opportunity-filters"><label>Opportunity type<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All types</option>{Object.entries(opportunityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="nb-check-filter"><input type="checkbox" checked={remoteOnly} onChange={(event) => setRemoteOnly(event.target.checked)} /> Remote only <small>Filters loaded results</small></label><button type="button" className="nb-text-link" onClick={clearFilters}>Reset filters <X size={15} /></button></div>}
    <div className="nb-explore-layout"><section className="nb-results" aria-label="Opportunity results"><div className="nb-results-heading"><h2>{search ? `Results for “${search}”` : category ? opportunityLabels[category] || "Opportunities" : "Open doors. New possibilities."}</h2><span>{loading ? "Loading…" : `${visible.length} ${hasMore ? "loaded" : "opportunities"}`}</span></div>
      {error && <div className="nb-feedback" role="alert"><p>{error}</p><button type="button" onClick={() => void load(items.length ? page : 1, !items.length)}>Try again</button></div>}
      {loading && !items.length ? <div className="nb-results-grid" aria-label="Loading opportunities" role="status">{[0, 1, 2, 3].map((item) => <div key={item} className="nb-card-skeleton"><span /><i /><i /><i /></div>)}</div> : visible.length ? <div className="nb-results-grid">{visible.map((item) => <OpportunityCard key={item.public_id} item={item} onSave={save} saving={saving === item.public_id} />)}</div> : !error && <div className="nb-empty"><Search size={30} /><h3>No opportunities here just yet.</h3><p>{search || category || remoteOnly ? "Try another search or clear your filters." : "Check back for new finds, or share an opportunity with the community."}</p><button className="nb-button nb-button-green" onClick={clearFilters}>Clear filters <ArrowRight size={17} /></button></div>}
      {hasMore && <button type="button" className="nb-load-more" disabled={loading} onClick={() => void load(page + 1, false)}>{loading ? "Loading…" : "Load more opportunities"}<ArrowDownIcon /></button>}
    </section><aside className="nb-explore-aside"><div className="nb-share-note"><span className="nb-kicker">SOMEONE COULD USE THAT LINK</span><Link2 size={31} /><h2>A good find?<br />Pass it on.</h2><p>Share an opportunity that could open a door for someone else.</p><Link href="/my-opportunities/new">Share with GetNeba <ArrowUpRight size={18} /></Link></div><div className="nb-aside-tip"><Bookmark size={21} /><h3>Find it now. Pursue it later.</h3><p>Save promising opportunities and keep your next steps together.</p><Link href="/saved" className="nb-text-link">Your saved opportunities <ArrowRight size={16} /></Link></div><p className="nb-aside-foot">A little connection.<br />A big next step.</p></aside></div>
  </main>;
}

function ArrowDownIcon() { return <Filter size={15} aria-hidden="true" />; }

"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight, Bell, BookOpenCheck, BriefcaseBusiness, Check, ChevronDown, GraduationCap, Grid2X2, Plus, Search, Settings2, Sparkles, UserRound } from "lucide-react";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";

const yourProducts = [
  { id: "schools", name: "Neba for Schools", description: "School operations, records, and academic progress", href: "/schools/dashboard", icon: GraduationCap, tone: "schools", note: "Your school workspace" },
  { id: "learn", name: "Neba Learn", description: "Study plans, Exam Buddy practice, and learning progress", context: "Personal workspace", href: "/learn/dashboard", icon: BookOpenCheck, tone: "learn", note: "Your study space" },
  { id: "opportunities", name: "Neba Opportunities", description: "Scholarships, grants, and academic pathways", context: "Personal workspace", href: "/dashboard", icon: BriefcaseBusiness, tone: "opportunities", note: "Your opportunity workspace" },
];

const catalogProducts = [
  { name: "Neba Learn", description: "Study support, Exam Buddy practice, and clearer next steps for learners.", availability: "Early access", href: "/learn/dashboard", icon: BookOpenCheck },
];

type SchoolWorkspace = { id: number; name: string; slug: string };
type SchoolWorkspaceResponse = { workspace: SchoolWorkspace | null; workspaces: SchoolWorkspace[] };

export default function WorkspacePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [preference, setPreference] = useState("workspace");
  const [profile, setProfile] = useState<User | null>(null);
  const [schoolWorkspace, setSchoolWorkspace] = useState<SchoolWorkspace | null | undefined>(undefined);
  const [schoolError, setSchoolError] = useState("");
  const [openingSchool, setOpeningSchool] = useState(false);
  const products = useMemo(() => yourProducts.map((product) => product.id === "schools" ? { ...product, context: schoolWorkspace === undefined ? "Checking school access…" : schoolWorkspace ? schoolWorkspace.name : "Setup required" } : product), [schoolWorkspace]);
  const filtered = useMemo(() => products.filter((product) => `${product.name} ${product.description} ${product.context}`.toLowerCase().includes(query.toLowerCase())), [products, query]);

  useEffect(() => {
    const controller = new AbortController();
    api<User>("/auth/me/", { signal: controller.signal }).then(setProfile).catch(() => {});
    api<SchoolWorkspaceResponse>("/schools/workspace/", { signal: controller.signal }).then((result) => setSchoolWorkspace(result.workspace)).catch(() => { if (!controller.signal.aborted) setSchoolError("We could not check your school access. Select the product to try again."); });
    return () => controller.abort();
  }, []);

  async function openSchoolsProduct() {
    if (openingSchool) return;
    setOpeningSchool(true); setSchoolError("");
    try {
      let workspace = schoolWorkspace;
      if (workspace === undefined) {
        const result = await api<SchoolWorkspaceResponse>("/schools/workspace/");
        workspace = result.workspace;
        setSchoolWorkspace(workspace);
      }
      router.push(workspace ? "/schools/dashboard" : "/schools/setup");
    } catch {
      setSchoolError("We could not check your school access. Try opening Neba for Schools again.");
      setOpeningSchool(false);
    }
  }

  return <main className="nw-workspace">
    <header className="nw-header">
      <Link href="/" aria-label="Neba home"><Image src="/brand/getneba-wordmark.svg" alt="Neba" width={156} height={36} priority unoptimized /></Link>
      <div className="nw-header-label"><Grid2X2 size={16} /><span>Workspace</span></div>
      <div className="nw-header-actions"><button type="button" aria-label="Notifications"><Bell size={19} /></button><button type="button" className="nw-profile" aria-label="Open profile"><UserRound size={18} /><span>My account</span><ChevronDown size={14} /></button></div>
    </header>

    <div className="nw-shell">
      <section className="nw-welcome">
        <div><span className="nw-eyebrow"><i /> YOUR NEBA WORKSPACE</span><h1>Good morning{profile?.display_name ? `, ${profile.display_name.split(" ")[0]}` : ""}.</h1><p>What would you like to work on today?</p></div>
        <label className="nw-search"><Search size={20} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your products and tools…" aria-label="Search your products and tools" />{query && <button type="button" onClick={() => setQuery("")}>Clear</button>}</label>
      </section>

      <div className="nw-main-grid">
        <section className="nw-products" aria-labelledby="your-products-title">
          <div className="nw-section-head"><div><span>YOUR PRODUCTS</span><h2 id="your-products-title">Ready when you are.</h2></div><button type="button" onClick={() => document.getElementById("workspace-preferences")?.scrollIntoView({ behavior: "smooth" })}><Settings2 size={16} /> Manage</button></div>
          <div className="nw-product-list">
            {filtered.map(({ id, name, description, context, href, icon: Icon, tone, note }) => {
              const content = <><span className="nw-product-icon"><Icon size={25} /></span><div className="nw-product-copy"><small>{note}</small><h3>{name}</h3><p>{description}</p><span><i /> {context}</span></div><strong>{id === "schools" && openingSchool ? "Checking access…" : "Open product"} <ArrowUpRight size={18} /></strong></>;
              return id === "schools" ? <button type="button" className={`nw-product ${tone}`} key={name} onClick={() => void openSchoolsProduct()} disabled={openingSchool}>{content}</button> : <Link href={href} className={`nw-product ${tone}`} key={name}>{content}</Link>;
            })}
            {!filtered.length && <div className="nw-no-results"><Search size={24} /><h3>No products match “{query}”</h3><p>Try a product name, tool, or organisation.</p><button type="button" onClick={() => setQuery("")}>Clear search</button></div>}
          </div>
          {schoolError && <p className="nw-route-error" role="alert">{schoolError}</p>}

          <div className="nw-explore-head"><div><span>EXPLORE MORE NEBA PRODUCTS</span><h2>Discover another way forward.</h2></div><p>Tools you haven’t added yet stay here, out of the way until you need them.</p></div>
          <div className="nw-catalog">{catalogProducts.map(({ name, description, availability, href, icon: Icon }) => <Link href={href} key={name}><span><Icon size={22} /></span><div><small>{availability}</small><h3>{name}</h3><p>{description}</p></div><Plus size={20} /></Link>)}</div>
          <p className="nw-catalog-note"><Sparkles size={15} /> Adding a product to your Workspace does not start a paid subscription.</p>
        </section>

        <aside className="nw-preference" id="workspace-preferences" aria-labelledby="preference-title">
          <span className="nw-eyebrow">YOUR STARTING POINT</span><h2 id="preference-title">Where should Neba open?</h2><p>Choose what you want to see first when you return.</p>
          <div className="nw-preference-options">
            {[{ value: "default", title: "My default product", copy: "Open Neba Opportunities directly." }, { value: "last", title: "Where I left off", copy: "Return to your last active product." }, { value: "workspace", title: "This Workspace", copy: "Start from your product launcher." }].map((option) => <label key={option.value} className={preference === option.value ? "selected" : ""}><input type="radio" name="opening-preference" value={option.value} checked={preference === option.value} onChange={() => setPreference(option.value)} /><span>{preference === option.value && <Check size={13} />}</span><div><strong>{option.title}</strong><small>{option.copy}</small></div></label>)}
          </div>
          <div className="nw-preference-foot"><span>Saved for this preview</span><Link href="/settings">Open preferences <ArrowRight size={15} /></Link></div>
        </aside>
      </div>
    </div>
  </main>;
}

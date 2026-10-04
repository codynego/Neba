"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Bell, Bookmark, CalendarClock, Check, Compass, Search, Sparkles } from "lucide-react";
import { api, getToken } from "@/lib/api";
import { Opportunity, OpportunityDashboard, User } from "@/lib/types";
import { useRouter } from "next/navigation";

const categoryMeta: Record<string, string> = {
  scholarship: "Scholarships",
  grant: "Grants",
  job: "Jobs",
  internship: "Internships",
  fellowship: "Fellowships",
  competition: "Competitions",
  training: "Training",
  startup: "Startup programs",
  funding: "Business funding",
};

function timeGreeting() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
}

function deadlineDays(deadline: string | null) {
  if (!deadline) return null;
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
}

function deadlineLabel(deadline: string | null) {
  const days = deadlineDays(deadline);
  if (days === null) return "No deadline";
  if (days <= 0) return "Closing today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

function TopMatchCard({ opp }: { opp: Opportunity }) {
  const score = opp.match?.score ?? 0;
  const reasons = opp.match?.reasons ?? [];
  const location = opp.is_remote ? "Remote" : opp.location_label || opp.country || "Open location";
  const days = deadlineDays(opp.deadline);

  return (
    <article className="dash-hero-card">
      <div className="dash-hero-card-top">
        <div className="dash-score-badge">
          <span className="dash-score-num">{score}%</span>
          <span className="dash-score-lbl">match</span>
        </div>
        <div className="dash-hero-chips">
          <span className="dash-cat-chip">{categoryMeta[opp.category] || opp.category} · {location}</span>
          {days !== null && (
            <span className={`dash-dl-chip${days <= 7 ? " urgent" : ""}`}>
              <CalendarClock size={12} />
              Deadline: {days <= 0 ? "today" : `${days} days`}
            </span>
          )}
        </div>
      </div>

      <h2 className="dash-hero-title">{opp.title}</h2>
      <p className="dash-hero-provider">{opp.provider}</p>

      {reasons.length > 0 && (
        <div className="dash-why">
          <span className="dash-why-label">Why you match</span>
          <div className="dash-why-list">
            {reasons.slice(0, 3).map((r) => (
              <span key={r} className="dash-why-item">
                <Check size={13} /> {r}
              </span>
            ))}
          </div>
        </div>
      )}

      <Link href={`/opportunities/${opp.public_id}`} className="dash-hero-cta">
        View opportunity <ArrowRight size={16} />
      </Link>
    </article>
  );
}

function MiniMatchRow({ opp }: { opp: Opportunity }) {
  return (
    <Link href={`/opportunities/${opp.public_id}`} className="dash-mini-row">
      <span className="dash-mini-score">{opp.match?.score ?? 0}%</span>
      <div className="dash-mini-info">
        <strong>{opp.title}</strong>
        <small>{categoryMeta[opp.category]} · {deadlineLabel(opp.deadline)}</small>
      </div>
      <ArrowRight size={14} />
    </Link>
  );
}

function UrgentChip({ opp }: { opp: Opportunity }) {
  const days = deadlineDays(opp.deadline);
  return (
    <Link href={`/opportunities/${opp.public_id}`} className="dash-urgent-chip">
      <span className="dash-urgent-cat">{categoryMeta[opp.category] || opp.category}</span>
      <span className="dash-urgent-days">
        {days !== null && days >= 0 ? `${days} day${days === 1 ? "" : "s"} left` : "Closing today"}
      </span>
    </Link>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<OpportunityDashboard | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!getToken()) { router.replace("/login?next=/dashboard"); return; }
    Promise.all([api<User>("/auth/me/"), api<OpportunityDashboard>("/opportunities/dashboard/")])
      .then(([profile, dashboard]) => { setUser(profile); setData(dashboard); })
      .catch(() => router.replace("/login"));
  }, [router]);

  const firstName = user?.display_name?.split(" ")[0] || "there";

  return (
    <main className="dash-overview container">

      {/* ── Greeting ─────────────────────────────── */}
      <header className="dash-greeting">
        <div className="dash-greeting-copy">
          <p className="dash-greeting-time">Good {timeGreeting()}, {firstName}</p>
          {data ? (
            <div className="dash-greeting-stats">
              <strong>{data.match_count} opportunities match your profile</strong>
              {data.new_this_week > 0 && <span>{data.new_this_week} new this week</span>}
            </div>
          ) : (
            <div className="dash-greeting-stats"><span>Loading your radar…</span></div>
          )}
        </div>
        <Link href="/alerts" className="dash-alerts-link">
          <Bell size={16} /> Alerts
        </Link>
      </header>

      {/* ── Search ───────────────────────────────── */}
      <form
        className="dash-search"
        onSubmit={(e) => { e.preventDefault(); if (query.trim()) router.push(`/opportunities?search=${encodeURIComponent(query)}`); }}
      >
        <Search size={18} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search opportunities…"
          aria-label="Search opportunities"
        />
        {query.trim() && (
          <button type="submit" aria-label="Search">
            <ArrowRight size={17} />
          </button>
        )}
      </form>

      {!data ? (
        <div className="dash-loading">
          <Sparkles size={22} />
          <span>Preparing your radar…</span>
        </div>
      ) : (
        <>
          {/* ── Your Opportunity Radar ────────────── */}
          <section className="dash-section">
            <div className="dash-section-hd">
              <span className="dash-eyebrow"><Compass size={12} /> YOUR OPPORTUNITY RADAR</span>
              <Link href="/matches" className="dash-section-link">View all matches <ArrowRight size={13} /></Link>
            </div>

            {data.top_matches.length ? (
              <>
                <TopMatchCard opp={data.top_matches[0]} />
                {data.top_matches.length > 1 && (
                  <div className="dash-mini-list">
                    {data.top_matches.slice(1, 4).map((opp) => (
                      <MiniMatchRow key={opp.public_id} opp={opp} />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="dash-radar-empty">
                <Sparkles size={26} />
                <div>
                  <strong>Your radar is ready.</strong>
                  <p>Once opportunities are published we'll rank them against your profile and show you why they fit.</p>
                </div>
                <Link href="/profile" className="button button-dark compact">Refine my profile <ArrowRight size={14} /></Link>
              </div>
            )}
          </section>

          {/* ── Don't Miss These ─────────────────── */}
          {data.urgent.length > 0 && (
            <section className="dash-section">
              <div className="dash-section-hd">
                <span className="dash-eyebrow dash-eyebrow-hot">DON&apos;T MISS THESE</span>
                <Link href="/matches" className="dash-section-link">See all deadlines <ArrowRight size={13} /></Link>
              </div>
              <div className="dash-urgent-row">
                {data.urgent.map((opp) => (
                  <UrgentChip key={opp.public_id} opp={opp} />
                ))}
              </div>
            </section>
          )}

          {/* ── Explore ──────────────────────────── */}
          <section className="dash-section">
            <div className="dash-section-hd">
              <span className="dash-eyebrow">EXPLORE</span>
              <Link href="/opportunities" className="dash-section-link">Browse all <ArrowRight size={13} /></Link>
            </div>
            <div className="dash-explore-pills">
              {Object.entries(categoryMeta).map(([value, label]) => (
                <Link href={`/opportunities?category=${value}`} key={value} className="dash-explore-pill">
                  {label}
                </Link>
              ))}
            </div>
          </section>

          {/* ── Bottom: Tracker + Profile Quality ── */}
          <div className="dash-bottom">
            <section className="dash-tracker">
              <div className="dash-section-hd">
                <span className="dash-eyebrow">YOUR APPLICATIONS</span>
                <Link href="/applications" className="dash-section-link">Open tracker <ArrowRight size={13} /></Link>
              </div>
              {data.applications.length ? (
                <div className="dash-app-list">
                  {data.applications.map((item) => (
                    <div key={item.id} className="dash-app-row">
                      <span className={`dash-app-status ${item.status}`}>{item.status}</span>
                      <strong>{item.opportunity.title}</strong>
                      <small>{deadlineLabel(item.opportunity.deadline)}</small>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="dash-quiet">Save an opportunity or add it to your tracker when you&apos;re ready to apply.</p>
              )}
            </section>

            <section className="dash-profile-nudge">
              <span className="dash-nudge-icon"><Bookmark size={18} /></span>
              <div>
                <small>PROFILE QUALITY</small>
                <strong>{data.profile_completion}% complete</strong>
                <p>
                  {data.missing_profile_fields.length
                    ? `Add ${data.missing_profile_fields.slice(0, 2).join(" and ").replaceAll("_", " ")} for more precise matches.`
                    : "Your profile is giving your radar great context."}
                </p>
                <Link href="/profile">Improve my matches <ArrowRight size={14} /></Link>
              </div>
            </section>
          </div>
        </>
      )}
    </main>
  );
}

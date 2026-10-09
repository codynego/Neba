# GetNeba platform audit and community roadmap

Date: 9 October 2026

## Scope and confidence

This is a platform-wide product and implementation review: public homepage, discovery and opportunity details; registration and onboarding; dashboard, saved items, applications and messages; contribution and organisation workflows; profiles, settings, alerts, practice and credits; operations, ingestion, matching, public metadata and legacy routes.

The public homepage, discovery page and one live job detail were inspected in the browser. Signed-in and staff experiences were assessed from repository source, not through a production account. Findings identified as source findings are not claims of an authenticated production reproduction. No application code or production data was changed, no applications were submitted, and no load test or security penetration test was performed. Production environment configuration, analytics, actual AI availability and delivery of scheduled jobs remain unverified.

The live public discovery page displayed three jobs and “You've reached the end” during this review. That is a point-in-time observation, not a count of drafts or private inventory.

## Product direction

The strongest direction is a community that helps people discover, share and pursue opportunities. Begin acquisition and curation with one reachable community, such as Nigerian students and recent graduates. Internships and graduate roles can lead, with closely related scholarships and training where useful. This is a proposed pilot audience, not an established product-market fit.

The current implementation is mainly a personal opportunity dashboard with publishing added. To fulfil the community promise, people, contributions and helpful interactions need to become visible in the core experience.

Keep the existing green identity, public browsing, source imports, moderation queue, saved opportunities, application tracking, share cards and contextual interview foundations. Improve the connections between them before adding more disconnected destinations.

## Fix before increasing acquisition

| Priority | Finding and evidence | Required improvement |
|---|---|---|
| P0 | **Contributors and providers are conflated.** Personal submissions set `provider` to the contributor's name, even for a shared third-party opportunity. The application API includes the creator in poster access. See `backend/opportunities/views.py`, `PersonalOpportunityViewSet.perform_create`, application queryset and serializer. | Store provider, contributor and authorised application recipient separately. Sharing an employer's link must not grant authority to receive or review applications to that employer. |
| P0 | **External jobs expose an internal application action.** The live One Acre Fund detail identified its application method as external but displayed “Apply internally”. The sidebar action is unconditional in `frontend/src/app/opportunities/[id]/page.tsx:88`; submission creates an applied record. | External: “Apply on provider website”, then a separate personal tracking action. Internal: submit only to the authorised provider. Enforce this distinction in the API as well as the UI. Never call an external application submitted because someone opened a link or sent a message to a contributor. |
| P0 | **Private preparation and provider-visible data are insufficiently separated.** The application serializer includes `notes` for both applicant and poster; the shared profile is generated from the user's current profile rather than an application snapshot. Source finding in `backend/opportunities/views.py`. | Make preparation notes applicant-only. Create an explicit preview of what is shared, retain an application-time snapshot, and share selected document versions rather than all later profile changes. External personal trackers must remain private to the applicant. |
| P0 | **Privacy settings contradict implementation.** Settings say the profile is visible only to its owner, while the public profile API uses `AllowAny` and returns name, biography, skills and local area. Privacy switches, session management and sign-out-all controls are non-functional in the reviewed UI. | Make visibility an actual enforced setting. Explain public versus application-only information. Remove or clearly disable unfinished security controls until functional. Replace the hardcoded session description with real session data. See `frontend/src/app/settings/page.tsx` and `backend/accounts/safety_views.py:225`. |
| P1 | **Discovery searches only loaded pages.** `OpportunityList` fetches page numbers without search/filter parameters, then filters the local array. It does not initialise search/category from URL parameters. `/matches` redirects to general discovery. | Apply filters before pagination on the server, retain them in the URL, report an accurate result count, and provide a genuine “For you” view. Verify a result on a later page can be found immediately. See `frontend/src/components/opportunity-list.tsx`. |
| P1 | **Eligibility and relevance are mixed.** Matching starts at 52, country/education mismatches add warnings but do not rule out eligibility; only some age failures return zero. Intent data written to `goals` is also read as intents from `opportunity_interests` in part of matching. | Use separate structured fields for goals, disciplines, opportunity types and location preferences. Apply explicit eligibility rules separately from relevance. Distinguish meets requirement, does not meet requirement and unknown. Normalise country/region and education values. See `backend/opportunities/views.py:147` and onboarding/settings components. |
| P1 | **Readiness is not grounded in completed requirements.** Dashboard percentages are fixed by status; detail readiness derives from match score; application tasks start with three prechecked items and reset on reload. The same founder statement and portfolio assumptions appear across opportunity types. | Persist opportunity-specific requirements and checklist completion. Show “3 of 5 required items ready”. Keep eligibility, document preparation and application status distinct. See dashboard, detail and `opportunity-application-workspace.tsx`. |
| P1 | **Publication and closure need one rule.** Public queries filter review approval but not `is_published` or expired deadlines. Dashboard “new_this_week” equals all matches, and “closing soon” does not apply a near-term window. | Enforce published, approved and open status; retain clearly labelled closed detail pages where useful. Track first-seen dates and use an explicit deadline window. Make unknown deadlines visibly unknown. See `backend/opportunities/views.py:301`. |
| P1 | **Deadline displays disagree.** One live detail showed 9 December 2026 in its server-rendered summary and December 10, 2026 in its client content. Two separate title/summary blocks also appear. | Render one coherent detail page using an explicit deadline timezone or date-only semantics where appropriate. Share the same date formatter and data contract across server, browser and share cards. See detail `layout.tsx` and `page.tsx`. |
| P1 | **Interview code has concrete faults.** Text interviewing constructs an answer/history prompt and then overwrites it with a request field the frontend does not send. Transcription references an undefined `prompt`. The frontend builds some interview history using fallback questions instead of the actual asked questions. | Fix these paths and verify start, answer, transcription and report generation before advertising them broadly. Preserve actual question-answer pairs. See `backend/ai_views.py` and `frontend/src/app/assistant/interview/page.tsx`. |
| P1 | **Preferences look saved when they are not.** Notification switches are local state in both Settings and Alerts. Frequency is not saved, and several location buttons lack actions. Browser push subscription is separately implemented. | Use one persisted preference model across both pages; connect it to delivery. Verify unsubscribe and delivery timing, rather than treating a successful browser subscription as proof of deadline alerts. |
| P1 | **Anonymous visitors receive unsupported signals.** Live detail showed “No obvious gaps” with no profile and 0% on similar listings; provider names receive unconditional checkmarks. | Show “Sign in to check your fit” without inferred readiness or gaps. Distinguish identity verification, verified organisation ownership, and listing review. Unknown is not zero and a publisher badge does not prove every listing detail. |
| P2 | **Failures can look like no content.** Saved/applications pages initialise empty and swallow errors; discovery clears results on failure; several organisation pages swallow failures or redirect. | Provide separate loading, genuinely empty and failed states with retry. Add pagination to saved and application lists; preserve unsent text and selected filters. |
| P2 | **Navigation and promises are disconnected.** Public links target homepage anchors that are absent; “Check an opportunity” leads to publishing or discovery; “Ask Getneba” prompts lead to the practice menu; the Pro upgrade leads to profile. | Audit every CTA against its label. Give private checking its own path; carry opportunity context into interview practice; remove upgrade promises until there is a working plan. |

P0 means role/privacy/application correctness should be addressed before growing the pilot. P1 means core usefulness and trust; P2 means usability and consistency. These are prioritisation labels for this review, not a complete security severity assessment.

## Homepage recommendation

Retain “Someone knows your next opportunity.” It expresses the community idea well. The current subheading is abstract, the hero illustration emphasises anonymous percentage scores, and the next sections repeat the broad category promise. Example opportunity cards link to general discovery rather than those opportunities.

Proposed hero:

> **Someone knows your next opportunity.**
>
> Join a community sharing internships, graduate jobs, scholarships and training for students and recent graduates in Nigeria. Find something worth pursuing—or share a link that could help someone else.
>
> **Explore opportunities** · **Share an opportunity**

Use this audience-specific copy only once the pilot audience is chosen. Keep the wider brand flexible.

Recommended page order:

1. **Hero:** the promise and two clear actions. Replace the score illustration with a real contribution card showing provider, contributor, eligibility, deadline and source. Clearly label any demonstration data.
2. **Fresh opportunities:** 3–6 current, reviewed listings with direct detail links. Show useful reality even if inventory is small. No unearned fit scores for anonymous visitors.
3. **People helping people:** recent contributions, contributor context and real thank-you activity once available. Avoid invented names, engagement or partner logos.
4. **How it works:** find something useful, understand it, take your next step; sharing is available throughout.
5. **Bring a link:** explain checking privately and sharing with the community as separate choices.
6. **Trust:** original sources, review scope, last checked, report/correction process and who makes the final selection.
7. **Outcome evidence:** actual stories with permission. Existing stories correctly say they are illustrative; keep that distinction until genuine outcomes replace them.
8. **Provider invitation:** a small “Offer an opportunity” route for employers and programme organisers, with a separate explanation of their workflow.

Keep the bold typography and green palette. Bring real content closer to the top; the live discovery page uses substantial vertical space before its first cards. Shorten card summaries, preserve scannable eligibility/benefit/deadline facts, and delay install prompts until after a useful action. Review contrast, touch targets, keyboard focus and mobile layouts before release; this audit did not perform a full accessibility or device test.

## Community experience to build next

The smallest useful community layer is **attribution + thanks + questions + corrections** attached to an opportunity.

- Show “Offered by [provider]” and “Shared by [member]” separately.
- Let members add a short note: who this helps and why they shared it.
- Add a thank-you action and useful contribution history. Measure saves or outcomes honestly; do not reveal who applied without permission.
- Add opportunity-specific questions with author/moderator answers, reporting and rate limits. Keep private application messages separate.
- Add “Suggest a correction” and “This is closed” to the listing itself, with a reviewable change history.
- Add “My contributions” and a persistent Share action to navigation. On mobile, a candidate structure is Home, Explore, Share, My progress, Profile; alerts remain a visible inbox/bell.
- Rework public member pages around contributions, interests and optional background. They currently show retired service offers, completed tasks and reviews; the API returns empty/zero legacy values.

Avoid launching a broad, unrelated social feed or dozens of empty groups. Start discussion around opportunities already attracting interest. Let community spaces emerge from repeat participation.

## Supply and moderation

There is already useful infrastructure: manual operations publishing, URL and pasted-text extraction, pending/approved/rejected review states, contribution credits and an RSS/Atom/JSON import command. Deployment configuration schedules fetching every six hours. That does not prove feeds or scheduled execution are configured in production.

Build on it with this pipeline:

**Official source / contributor / provider → import draft → identify duplicates → check source and eligibility → review → publish → distribute → recheck → close or correct.**

Immediate operational improvements:

- Create a source registry: URL, owner, permitted import method, audience, last successful fetch, failures and review yield.
- Configure a small set of relevant sources and inspect their output daily. Avoid treating automatically inferred fields as verified facts.
- Distinguish source deadline from guessed/extracted deadline. Leave unknown information blank with an explanation.
- Canonicalise URLs and detect title/provider/deadline duplicates, not only exact URLs. The current fetcher and credit logic rely heavily on exact source matches.
- Record listing-level reviewer, review date, checked facts and last freshness check.
- Add review backlog age, rejection reasons, contributor notifications, and a correction workflow for published listings. Published entries are currently locked for contributors.
- Unify “Report outdated information” with the operations queue; the detail currently launches an email instead. Standardise the support address—the repository mixes `.com` and `.app` addresses.
- Keep credits secondary to helpfulness. Establish AI usage costs, spend controls and actual redemption before promising that credits unlock tools; the reviewed interview endpoints do not debit contribution credits.

Pilot suggestion: seed about 30 relevant opportunities, recruit 5–10 contributors and 50–100 members from a reachable community. These are proposed experiment sizes, not benchmarks. Expand supply according to what people actually save and pursue.

## Improvements by member journey

| Area | Recommended next version |
|---|---|
| Registration/onboarding | Ask for the minimum needed for the first relevant result. Preserve the opportunity or shared link that led to signup. Allow contributor-first onboarding; remove inert Google sign-in presentation until available. Collect detailed eligibility progressively. |
| Discovery | Server-side search, deep-linkable filters, newest/closing soon/for you sorting, explicit internship and graduate-level filters, paid/unpaid/unknown compensation, location eligibility separate from remote work. |
| Detail page | One title block, provider and contributor, source, checked date, eligibility facts and unknowns, actual requirements, one clear application route, save/share, then questions and preparation. Let visitors follow an external official application link without mandatory signup; require an account for saving and personalisation. |
| Dashboard | A few relevant new opportunities, nearest actionable deadlines, one resumable application task, and feedback on recent contributions. Avoid filling every panel with profile-completion prompts. |
| Saved/application progress | Distinguish saved, preparing, externally self-reported applied and provider-confirmed submission. Persist real checklists and private notes. Support withdrawn/unsuccessful outcomes and next-action dates. Use category-appropriate language rather than “founder story” everywhere. |
| Documents | Keep existing upload functionality, but support selected document versions per application and a clear sharing preview. A document-name list is not the same as supplying a CV to a provider. |
| Practice | Repair existing interviews first. Carry listing context from every relevant link. Save sessions/reports if the user chooses; make feedback actionable. Add document coaching only when tied to an actual opportunity. |
| Alerts | A single preference model, useful matching thresholds, source change alerts, user-timezone scheduling and quiet periods. Trigger opt-in after a save or other demonstrated need. |
| Credits | Clearly explain usable benefits. Remove internal accounting language from the purchase page. Do not prioritise checkout while the free contribution/usefulness loop is unproven. |
| Help/trust | Explain contributor versus employer, external application status, what review verifies, how corrections work and how to control public information. Update marketplace-era notification and profile copy. |

## Organisation experience

Organisation verification, publishing, applicant review and messages are a foundation worth retaining. Improve these before expanding the analyst feature:

- A public “For organisations” entry point and clear review requirements.
- Explicit ownership of the organisation and its application inbox, with team permissions when multi-user demand appears.
- Preview, draft saving, reopen/close and correction requests with review history.
- Candidate review based on stated requirements and evidence, with unknowns visible; avoid presenting heuristic percentages as qualification or success probability.
- Clear distinction between a submitted application, a person preparing privately, an outbound application click and a reported external outcome.
- Accurate funnel metrics. The current “application rate” divides application records by unique matched users, which is not a conventional conversion rate and may exceed 100% across multiple opportunities. “Qualified” currently means certain workflow statuses. Label these honestly or measure the actual events.
- Remove the non-functional AI analyst from primary navigation until it offers a concrete workflow.

## Scale, search visibility and measurement

Source findings show that matching computes scores across the full candidate opportunity set before pagination; organisation audience calculations scan users repeatedly; some unread-count responses serialise full application data. Improve query shape, candidate filtering and aggregation, then cache or precompute where measurements justify it. Keep import, review notifications and heavier work out of interactive request paths as volume grows. Verify actual performance with representative data before making capacity claims.

For search visibility, retain category landing pages and canonical detail links. Main discovery inherits default noindex because it has no page-specific metadata. Sitemap/category fetches request `page_size` but the configured standard pagination does not visibly establish support for that override; verify pagination coverage. Use real timestamps for metadata and structured data—the public serializer does not currently expose `updated_at`, which detail metadata expects. Preserve one server-rendered content structure rather than repeating a separate SEO summary above the app page.

Instrument events with clear meanings: opportunity viewed, saved, share opened/completed where observable, contribution submitted/approved/rejected, official application clicked, external application self-reported, internal application received, and outcome recorded. Track weekly cohorts, not only cumulative totals. “Active users” in current operations counts enabled accounts, not recent activity.

Primary pilot measures:

- Percentage of new members who save or start pursuing a relevant opportunity.
- Members returning to take a useful action in subsequent weeks.
- Distinct contributors who share again, plus approval and duplicate rates.
- Time from submission to review and percentage of listings still current.
- Relevant supply for the chosen audience and searches with no useful result.
- Applications and outcomes, separated by evidence level.
- Cost per approved useful listing and per completed AI session.

Build regression checks around eligibility, external versus internal application paths, private notes, publication/closure, saved preferences and interviews. The repository's opportunity test suite currently contains only three tests, which is too narrow to establish these flows. This review did not run those tests.

## Future roadmap, gated by evidence

| Stage | Features | Evidence to justify moving forward |
|---|---|---|
| Reliable pilot | Correct application/privacy roles, working discovery, accurate eligibility/deadlines, curated supply, real progress and preferences | Members can reliably find something relevant and complete a next step. |
| Community foundation | Contributor attribution, thanks, correction requests, opportunity Q&A, contribution dashboard and basic moderation | Contributors return and their posts help others act. |
| Repeat participation | Follow contributors/providers, curated collections, saved searches, calendar export, digest, optional success updates | People repeatedly return for relevant information and request these follow-up tools. |
| Community partnerships | University/community spaces, ambassador tools, provider profiles, events and alumni office hours | Several existing groups have sufficient activity and committed organisers. |
| Deeper preparation | Opportunity-specific CV/statement review, reusable selected documents, mock interviews and peer review with consent | Users struggle with preparation after finding relevant opportunities and use existing tools. |
| Sustainable business | Organisation team workflows, better applicant management, institution-sponsored preparation, carefully priced premium tools | Providers or institutions demonstrate willingness to pay, and unit costs are understood. |
| Wider expansion | More locations, audience segments, languages and partner integrations | The original community retains users, renews supply and produces outcomes without constant founder intervention. |

Defer an unrelated general social feed, many empty communities, unlimited AI, opaque match percentages, automatic mass applications, global acquisition and large native-app investments until the core loop works.

## Handshake reference

Handshake's current student page clearly identifies an early-career audience and combines personalised recommendations, career events and user outcome stories. Its useful lesson for GetNeba is clarity of audience and a connected opportunity experience. GetNeba can express its own contribution model through provider/contributor attribution and visible mutual help rather than copying Handshake's layout or full feature set.

Reference accessed 9 October 2026: [Handshake for job seekers](https://joinhandshake.com/students/).

## Recommended first delivery sequence

1. Fix application authority, external tracking, private preparation data and profile visibility claims.
2. Repair search, filters, publication/expiry rules, date formatting, eligibility and interview failures.
3. Seed the chosen community's inventory and establish daily review/freshness operations.
4. Refresh the homepage with real listings and a concrete community promise; repair every CTA.
5. Add contributor attribution, simple thanks, corrections and opportunity-specific questions.
6. Measure activation, useful retention, repeat contribution and outcomes before broadening scope.

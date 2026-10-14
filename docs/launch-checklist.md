# Neba launch checklist

This checklist is for a controlled Neba for Schools launch. It is intentionally specific: checking every box should mean a school can safely set up a workspace, record student data, and use assessment evidence.

## Product sign-off

- [ ] A school administrator has completed: account creation, school setup, class and subject setup, staff invitation, student record entry, assessment creation, score import, question mapping, and intervention creation.
- [ ] A teacher can see only assigned classes and subjects.
- [ ] An administrator can manage staff roles; a teacher cannot alter the roster or another member’s access.
- [ ] Empty, error, and mobile states have been checked on a real phone and desktop browser.
- [ ] The launch copy describes Academic Intelligence as explainable assessment evidence and teacher decision support—not automated grading or a guarantee of learner outcomes.

## Data, privacy, and support

- [ ] The legal operator name, physical address, and monitored privacy email are set in `NEXT_PUBLIC_LEGAL_*`.
- [ ] The privacy notice and terms have been reviewed for student and guardian data in the launch jurisdiction.
- [ ] Only authorized staff can access a school’s data; access has been tested with at least two schools.
- [ ] A named owner is responsible for deletion/access requests, incident response, and support escalation.
- [ ] Database backup, restore, and retention procedures have been tested and documented.

## Production configuration

- [ ] `DJANGO_SECRET_KEY` is random, long, and stored only in the deployment secret manager.
- [ ] Production uses PostgreSQL and Redis; no local development credentials are present in deployment environments.
- [ ] `DJANGO_DEBUG=false`, `DJANGO_ALLOWED_HOSTS`, CORS, CSRF origins, `FRONTEND_URL`, `NEXT_PUBLIC_SITE_URL`, and `NEXT_PUBLIC_API_URL` point to the final HTTPS domains.
- [ ] Email, object storage, push, billing, and AI keys are configured only if their related feature is enabled. Disabled integrations are hidden from launch navigation.
- [ ] Production migrations have completed successfully and `/api/health/` returns `{"status":"ok"}`.

## Release verification

- [ ] CI is green for frontend typecheck/build and Django migration/test checks.
- [ ] Production logs and error monitoring are available to the launch owner.
- [ ] An uptime check monitors the public site and `/api/health/`.
- [ ] A rollback owner and rollback procedure are written down before releasing.
- [ ] Search indexing is enabled only after the final domain, metadata, and legal pages are ready.
- [ ] `NEXT_PUBLIC_SITE_URL` names the canonical HTTPS domain and `SEO_INDEXABLE=true` is set only in the production frontend environment.
- [ ] The final sitemap at `/sitemap.xml` has been submitted in Google Search Console and Bing Webmaster Tools after deployment.

## Pilot decision

Launch publicly only after the above is complete. Until then, invite named pilot schools, collect feedback on onboarding and score-entry workflows, and fix observed friction before expanding access.

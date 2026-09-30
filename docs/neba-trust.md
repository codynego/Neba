# Neba trust and safety pilot

Start with a small invited group and trained admin reviewers. Public launch should use a specialist identity provider for document authenticity, face matching and presentation attack detection (liveness). Camera capture and a randomized gesture help an admin review a submission; they do not prove liveness. Identity review is not a background check or a guarantee of safe behaviour. See [NIST identity proofing guidance](https://pages.nist.gov/800-63-4/sp800-63a/ial-general/).

## Member flow

- `/verify`: real SMS verification, then ID upload, live camera portrait and a prompted gesture photo. Submission remains pending until an authorized reviewer approves it.
- A verified phone is required to post a task. Phone and approved identity review are required to publish an offer, apply to a task, or be accepted as a helper. Existing offers from unverified or suspended accounts are hidden from public discovery.
- Phone numbers come from the verified account, not an application text field. Application contact is visible only after acceptance and disappears across a block or helper suspension.
- A member can explicitly opt to show their approved portrait on their public profile. Otherwise it remains private. ID documents and challenge photos never become public profile images.
- `/safety`: private reports, report status, blocked members and unblock. Report/block controls also appear on task, offer and received application pages. Blocks hide listings in signed-in browsing and prevent new work in either direction; public member profiles remain public. Task and offer browsing requires authentication, including list/detail API access. Blocking is not cancellation of an already agreed task.
- Only the two participants in a completed task can review each other, once per task. The server determines the review subject. Admins can hide abusive reviews.
- Consent withdrawal removes identity approval, encrypted evidence and the approved portrait. Offering/accepting work then remains locked until a new review.

## Service configuration

Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`, and `VERIFICATION_ENCRYPTION_KEY` in the backend process environment. The project does not load `.env` files automatically. `.env.example` is a configuration reference. Use a maintained secret manager in production; never commit these values.

Generate a Fernet key once with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` and securely store it. Keep it across restarts and backups. Losing or replacing the key without a migration makes existing evidence unreadable. Do not put it in `NEXT_PUBLIC_*` variables. The database stores encrypted, metadata-stripped JPEGs; the application must possess the key to review them. Use HTTPS, encrypted backups, restricted database access and a production database (PostgreSQL) before collecting real IDs. SQLite is suitable only for local development; its row-lock semantics do not support the concurrency protections intended here.

SMS uses [Twilio Verify](https://www.twilio.com/docs/verify/api/verification) and [Verification Check](https://www.twilio.com/docs/verify/api/verification-check). Configure the Verify service for the intended countries, SMS fraud protection and provider-side destination/rate limits before enabling it. Nigeria is the default allowed country prefix. Local limits allow five sends per user/destination per hour, one resend per minute, five code checks per challenge, and a ten-minute expiry. Failed provider checks consume attempts. Configure a shared Django cache for DRF throttling on multiple workers; the default local cache is not shared. Add registration/login abuse protection at the gateway before public signup. No actual SMS or identity-provider service has been activated by this change.

Missing provider credentials or encryption key disable the corresponding step. Accounts never auto-pass. Unit tests mock the SMS provider and use synthetic images in an isolated test database; those mocks are not available in runtime code.

## Admin operations

Use `/admin/` with a staff account granted `accounts.review_identityverification`, view/change identity submissions, and user/report/review permissions according to responsibility. Private evidence requires staff status and the explicit review permission. Staff status alone does not unlock ID images. Avoid broadly granting superuser access.

1. Open a pending Identity verification record and use its three private evidence links. Evidence access is audited.
2. Check that the submitted document is legible and consistent with the declared name, that the face matches the portrait, that the gesture matches the stored challenge, and that the person is eligible as an adult. Manual review cannot establish document authenticity conclusively.
3. Save the four checklist fields. From the list, select “Approve after saving all four review checks.” Approval fails if checks/evidence are missing or the account lacks a verified phone.
4. To reject, save a clear member-facing correction in the review note, then use the rejection action. Previously decided submissions cannot be decided again.
5. Process Safety reports with private staff notes and status. Suspension is available from the Users list; it deactivates the member and revokes their token. Profile/feed visibility and acceptance gates also check account activity. Reviews can be moderated by toggling visibility.

Review decisions, evidence access, consent withdrawal, report handling, moderation and suspension are recorded in Trust audits. Keep the admin service restricted and configure strong staff authentication before launch. No real members have been approved or suspended as part of implementation.

## Evidence retention

Schedule `python manage.py purge_verification_evidence` daily in the backend environment. It removes raw evidence and declared legal names after `VERIFICATION_RETENTION_DAYS` (default 30) from submission, expires undecided pending records, and retains the minimal decision/audit record. It also removes old camera challenges and phone-send hashes. The schedule is not installed by this change. Review evidence before the deadline; missing evidence cannot be approved.

An explicitly opted-in approved portrait is retained separately for the profile until consent withdrawal. Backups require their own retention/deletion process; an application purge does not remove historical backup copies. Set and disclose your actual retention policy and reviewer responsibilities before collecting real IDs. Review [Nigeria Data Protection Act resources](https://ndpc.gov.ng/download/nigeria-data-protection-act-2023) with qualified local advice; these implementation controls alone do not establish compliance.

## Verification

Run `python manage.py test` from `backend`, then `npm run typecheck` and a frontend production build. Trust tests exercise fail-closed SMS, attempt/replay limits, encrypted and private evidence, approval permissions/checklists, expiry, withdrawal, block enforcement, report privacy, completed-task review eligibility and suspended helper acceptance. A real provider sandbox and manual camera/device test remain necessary before enabling real verification; no personal ID or webcam image is collected by these tests.

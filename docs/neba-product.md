# Neba product flows

## Member experience

- `/activity` brings together accepted bookings, private helper invitations, posted tasks, applications sent and received, and offers. Pending applicants can withdraw; requesters can accept or decline.
- Offer detail pages let phone-verified requesters send a private task request to a specific verified helper. Only the requester and invited helper can see it. Acceptance opens the booking workspace; declining closes the request. Unavailable helpers cannot take new work.
- `/messages` is the private conversation inbox; `/messages/{taskId}` is the dedicated conversation screen. Booking pages link to Messages and keep task actions separate. New-message notifications open the conversation directly. Accepted task participants have a private conversation with persistent, incremental messages. Client message IDs prevent duplicate sends after a retry. Messages refresh every 10 seconds while the page is visible. Ended bookings retain conversation history and disable new messages.
- Completion, cancellation after acceptance, and rescheduling require a proposal and the other participant's agreement. The proposer can withdraw a pending proposal. Reviews unlock after confirmed completion. An open task can be cancelled by its requester.
- Participants can report disputes or a no-show. No-shows require a scheduled time that has passed. An active issue pauses change decisions until moderation resolves it.
- `/notifications` provides a private, paginated inbox and read controls. Notifications and activity refresh every 20 seconds while visible. Delivery is in-app; email, SMS alerts and push notifications are not enabled.
- `/profile` edits a member's introduction, skills, neighborhood and availability. `/u/{username}` shows opted-in approved portraits, verification status, completed helper jobs, visible reviews and active offers to signed-in members. Legacy `/members/{username}` links redirect here. Skills and availability are self-reported.
- Discovery supports city, neighborhood, category and text filters. Tasks support timing, reward range and reward/date sorting. Offers support availability, price and rating sorting. Neighborhood filtering uses supplied text, not GPS distance.

## Access and safety

Private invitations never appear in the task feed. Accepted booking details, contact information, messages and change history are restricted to the participants. Blocking prevents new work and messages; history and dispute reporting remain available. Contact information is hidden across blocks or account suspension. Identity review gates still apply before helper work is accepted.

Payments remain coordinated directly between members. Task rewards and offer prices are informational; the app does not charge, hold funds or pay helpers.

## Moderation

In Django admin, authorized staff can open Task issues, save an outcome (`resume`, `cancel` or `complete`) and a member-facing resolution, then use the resolution action. This applies the task decision, closes pending changes, notifies both participants and records a trust audit. Resolved outcomes and explanations are read-only. Booking applications, messages and changes are read-only history in admin.

Use PostgreSQL and a shared cache before a multi-worker launch. SQLite local development cannot validate production row-lock behavior. See [trust setup](neba-trust.md) for identity service credentials, evidence protection, retention and reviewer responsibilities. Real SMS and identity verification services still need configuration and provider/device testing.

## Verification performed

All 25 backend tests passed, including access boundaries, message retry behavior, private invitations, availability, mutual completion, review eligibility, rescheduling, cancellation, no-show and dispute handling, profile updates, notifications and discovery. Frontend type checking and the production build passed. Browser testing used two synthetic local accounts to request a helper, accept the invitation, exchange a message, request and confirm completion, publish a review and mark notifications read. No real phone verification or identity evidence was used.

Messaging layout update: 12 booking/product tests passed, including inbox access restrictions and archived history. The frontend production build passed with both Messages routes. Browser checks verified inbox navigation, sending a message, the link back to booking, and removal of the booking composer.

# Legacy marketplace retirement

GetNeba's current product direction is the opportunity platform. The older task, offer, and booking marketplace remains installed for historical data and read-only history, but new creation is frozen by default.

Set `LEGACY_MARKETPLACE_ENABLED=true` only for a controlled rollback or data migration window. The default `false` state rejects new task posts, helper offers, and task applications while preserving existing reads and conversations.

Before removing the legacy apps or tables:

1. Export and verify task, offer, booking, message, dispute, and review history.
2. Confirm production traffic and scheduled jobs no longer use the legacy endpoints.
3. Remove frontend links and routes after the archive window.
4. Create explicit data migrations for any retained user or notification references.
5. Remove apps in a separate release, keeping the historical export available.

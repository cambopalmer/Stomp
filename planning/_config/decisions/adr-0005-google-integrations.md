# ADR-0005: Google integrations (Phase 4)

**Status:** Accepted (2026-10-06)
**Context:** Phase 4 pulls Gmail into Incoming and imports Google Calendar into the calendar, read-only. The owner answered open questions C1/C3/C4 and the two scope questions the design left implicit (which mail, which calendars). See [integrations.md](../../04-integrations/output/integrations.md) for the adapter design this builds on.

## Decision

| Question | Decision | Why |
|---|---|---|
| **C1** Providers | **Google only** (Gmail + Google Calendar). Outlook/Graph is wanted later. | Adapters stay provider-neutral (`MailAdapter` / `CalendarAdapter`) so Outlook is an added adapter, not a rework. |
| Which mail | **Messages carrying a Gmail label named `STOMP`** (applied by hand or by a Gmail filter). | Incoming is a curated to-do inbox; pulling the whole inbox would bury it. Same model as Todoist / Sunsama email capture. |
| Which calendars | **User picks per calendar**; primary is on by default. | Households typically have a shared family calendar alongside personal ones; "all" pulls in holidays/birthdays noise. |
| **C3** Cadence | **Every 10 minutes**, in-process scheduler, plus a **Sync now** button. Not user-configurable. | Fresh enough for planning; far inside Google's free quotas; nothing to configure. |
| **C4** Token key | **`INTEGRATION_ENC_KEY` env var** (32 bytes, base64). Tokens stored AES-256-GCM encrypted. | Standard for a small self-hosted app; a host secret store is overkill. Integrations stay disabled until the key is set. |

### Consequences / conventions

- **Separate grants.** Gmail and Calendar are connected independently — one `integration_accounts` row per provider (`gmail`, `google_calendar`), each with its own scope (`gmail.readonly` / `calendar.readonly`) requested with `include_granted_scopes`. Sign-in (`openid email profile`) stays a separate flow.
- **Own redirect URI.** The connect flow uses `{PUBLIC_BASE_URL}/api/integrations/google/callback`, registered alongside the sign-in one.
- **All-day events are floating dates.** Google sends `date` (not `dateTime`) for all-day events. STOMP stores them as **UTC midnight** of the start date (`starts_at`) and of the exclusive end date (`ends_at`), `all_day = 1`, and the UI reads their **UTC** date parts — never local time — so a date doesn't shift across time zones. (Resolves open-questions F3.)
- **Calendar sync is a windowed refresh, not `syncToken`** (amends integrations.md): each run lists every event instance from 30 days back to 180 days ahead per selected calendar (`singleEvents=true`, so recurring events arrive as instances — STOMP has no recurrence model), upserts by `external_id = <calendarId>|<eventId>` (etag decides whether to rewrite), and deletes local mirrors in the window that Google no longer returns. All Google calls finish before any local write, so a failed run changes nothing. Declined and cancelled events are skipped. Cost: a few requests per calendar per run — trivial at household scale; `updatedMin`/`syncToken` remain an optimisation if it ever matters.
- **Imported events are read-only mirrors** (`external_provider = 'google'`); editing happens in Google until Phase 5 two-way sync. Disconnecting Calendar removes the mirrored events. Disconnecting Gmail keeps Incoming items already pulled.
- **Testing-mode caveat.** While the Google OAuth app is in *Testing*, refresh tokens for these scopes expire after 7 days. Before relying on background sync, publish the app (unverified) — see `docs/GOOGLE-OAUTH.md` §7.

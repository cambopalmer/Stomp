# STOMP — Integrations (designed, not built in v1)

## Principle

All external providers sit behind **adapter interfaces**. v1 ships the interfaces + a `NullAdapter` (no-op) so the rest of the app is written against a stable contract. Phase 4/5 add `GmailAdapter` and `GoogleCalendarAdapter`.

## Adapter interfaces

```ts
// packages/shared/src/integrations.ts

export interface MailAdapter {
  /** Pull messages newer than the stored cursor. Read-only. */
  pull(account: IntegrationAccount, cursor: string | null): Promise<{
    messages: InboundMessage[];
    nextCursor: string;
  }>;
  /** Phase 5. */
  send(account: IntegrationAccount, msg: OutboundMessage): Promise<{ providerId: string }>;
}

export interface CalendarAdapter {
  pull(account: IntegrationAccount, syncToken: string | null): Promise<{
    events: InboundEvent[];
    deleted: string[];         // external ids removed upstream
    nextSyncToken: string;
  }>;
  /** Phase 5 — two-way. */
  push(account: IntegrationAccount, event: LocalEventChange): Promise<{ externalId: string; etag: string }>;
  sendInvite(account: IntegrationAccount, eventId: string, attendees: string[]): Promise<void>;
}

export interface InboundMessage {
  providerId: string; threadId: string;
  from: string; to: string[]; subject: string;
  snippet: string; receivedAt: number;   // epoch ms
  bodyText?: string;
}
```

## Capability matrix

| Capability | v1 | Phase 4 | Phase 5 |
|---|---|---|---|
| Store provider connection (`integration_accounts`) | table exists, unused | write on OAuth connect | — |
| Gmail: pull recent mail → `incoming_items` (`kind='email'`) | — | ✅ read-only, scheduled | — |
| Google Calendar: pull events → `events` (read-only, `external_provider='google'`) | — | ✅ one-way import | — |
| Calendar: local edits push upstream | — | — | ✅ two-way |
| Send email | — | — | ✅ |
| Send calendar invite to attendees | — | — | ✅ |
| Outlook / generic IMAP | — | — | later, same interface |

## OAuth flow (Phase 4)

1. `GET /api/integrations/google/connect` → redirect to Google consent (scopes: `gmail.readonly`, `calendar.readonly`; add `calendar.events` + `gmail.send` in Phase 5).
2. Callback `GET /api/integrations/google/callback` → exchange code → store `access_token` + `refresh_token` **encrypted** (`INTEGRATION_ENC_KEY` env, AES-256-GCM) in `integration_accounts`.
3. Refresh on demand when `token_expires_at` is near.
4. On invalid_grant → set `status='needs_reauth'`, surface a banner in Settings.

## Sync loop (Phase 4)

- A scheduled job (node-cron in-process, or the host's scheduler) every N minutes per connected account.
- **Gmail:** use stored `sync_cursor` (Gmail `historyId`). For each new message → create `incoming_item` (`kind='email'`, `source_ref=providerId`, `source_meta` = JSON{from, subject, receivedAt, threadId}). Dedupe on `source_ref`. Write a `sync_log` row.
- **Calendar:** use `syncToken`. Upsert events by `(external_provider, external_id)`. Honor `deleted[]`. Never overwrite a locally-edited external event without conflict handling (Phase 5 concern).
- Cursors and `last_sync_at` persisted so restarts resume cleanly.

## Triage of pulled email

A pulled email lands as an `incoming_item`. The user triages it exactly like a quick capture:
- **→ Todo:** prefilled from subject/snippet; `source='email'`; `linked_entity_*` set; original stays linked via `source_ref`.
- **→ Event:** prefilled; same linkage.
- **Dismiss:** `status='dismissed'`.

## Open questions for this stage → Stage 06 section C

- **C1** Which providers beyond Gmail at launch of Phase 4? (Outlook/Graph? generic IMAP?)
- **C2** Outbound: send mail from your Gmail, or draft-only? Invites via Google only?
- **C3** Sync cadence + should it be user-configurable?
- **C4** Encryption key management for tokens on a small host — env var vs host secret store?

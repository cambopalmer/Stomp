# Stage 04: Integrations (design now, build later)

## Inputs
- `../00-prd/output/prd.md` (deferred list)
- `../02-data-model/output/schema.md` (integration_accounts, sync_log, events.external_*, incoming_items)

## Process
1. Define the provider-adapter interface (one shape for Gmail, Google Calendar, later Outlook/IMAP).
2. Define the v1 stub vs the later live behavior for each capability.
3. Define the OAuth flow and token storage approach (for the later phase).
4. Define the sync loop: cursors, dedupe, mapping to incoming_items / events.
5. Define outbound actions (send email, send invite) — later.

## Outputs
- `output/integrations.md`

## Review gate
User confirms provider list and the pull→incoming mapping before Phase 4 starts. Nothing here is built in v1.

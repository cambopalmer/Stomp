# Decision log

| ADR | Title | Status |
|---|---|---|
| [0001](adr-0001-stack.md) | Application stack (TS/Fastify/Drizzle/React/...) | Accepted |
| [0002](adr-0002-datastore.md) | Datastore = SQLite (libSQL-compatible) | Accepted |
| [0003](adr-0003-workspaces-and-sharing.md) | Workspaces (nullable) + sharing/visibility model + subtask rules | Accepted |
| [0004](adr-0004-design-tooling.md) | Design tooling — `ui-ux-pro-max` skill; MASTER.md design system | Accepted (2 follow-ups) |
| [0006](adr-0006-day-planner.md) | Day planner: time blocks (own entity, optional todo link), wall-clock 15-min time, events as fixed blocks, per-user categories, auto planned-vs-actual, anchored blocks, mobile-first PWA | Accepted |
| [0005](adr-0005-google-integrations.md) | Google integrations: Gmail by `STOMP` label, per-calendar import, 10-min sync, env-var token key, all-day = floating date | Accepted |

Next ADRs to write as their phase approaches: auth method + session strategy (Q B1/B2), notifications scope (Phase 2), recurrence model (if `rrule` proves insufficient).

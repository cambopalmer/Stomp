# ADR-0002: Datastore = SQLite (libSQL-compatible)

**Status:** Accepted (2026-08-31)
**Context:** Needs to be light, free, support multiple users sharing tasks/events, run locally in a container, and move to cheap hosting later.

## Decision

Use **SQLite** as the datastore.

- Local/dev: single file `stomp.db` via `better-sqlite3` (synchronous, fast, simple).
- Access through **Drizzle ORM**; migrations as committed SQL files run on API boot.
- Hosted later: **Turso** (hosted libSQL) free tier, or a mounted volume on the container host. Drizzle supports both drivers; change is a config swap.

## Why not the alternatives

- **Supabase / Postgres** — excellent for auth + row-level security + sharing, but it's a hosted dependency and heavier than the owner wants for a local-first start. Revisit only if concurrent-write load or Postgres-specific features (RLS, full-text, LISTEN/NOTIFY) become necessary.
- **PocketBase** — great all-in-one, but its opinionated schema/admin model would fight the explicit Drizzle schema the owner wants to read and control.
- **MongoDB Atlas** — document model adds impedance mismatch for a relational domain (projects, memberships, attendees, tags). Rejected.

## Consequences

- **Concurrency:** SQLite serializes writes. Fine for a handful of users. Enable **WAL mode** and a **busy_timeout**. If write contention ever bites, Turso or Postgres is the migration path.
- **No built-in auth.** We build auth ourselves in a later phase (see roadmap Phase 3). Schema has the `users` table and auth columns reserved from day one.
- **Sharing/permissions** are enforced in the repository layer (a visibility helper / SQL view), not by the database.
- **Backups:** copy the file (or Turso's built-in backups). Add a scheduled `VACUUM INTO` dump in the container later.
- **Types:** SQLite has no native `boolean`/`datetime`. Convention: booleans as `integer` 0/1; timestamps as `integer` epoch milliseconds (UTC). Drizzle maps these.

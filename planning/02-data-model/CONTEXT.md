# Stage 02: Data model

## Inputs
- `../00-prd/output/prd.md` — entities implied by jobs-to-be-done
- `../01-architecture/output/architecture.md` — Drizzle, SQLite type conventions, visibility helper
- `../_config/glossary.md`
- `../_config/decisions/adr-0002-datastore.md` — SQLite type rules

## Process
1. List every entity and its attributes, with SQLite types.
2. Define relationships, foreign keys, and cascade behavior.
3. Define the sharing/permission model and the visibility rule.
4. Define enums / check constraints.
5. Define indexes.
6. Write the "today / hot sidebar" query.
7. Provide the Drizzle schema sketch and equivalent SQL DDL.
8. Note reserved-but-unused tables/columns for deferred features.
9. Surface every modeling decision that needs the user → feed Stage 06.

## Outputs
- `output/schema.md` — entities, ERD (text), DDL sketch, queries, open modeling questions.

## Review gate
A1–A9 resolved (2026-08-31); schema frozen for the v1 migration. Remaining open items (tag-scope edge cases, B/C sets) do not block the Phase 0 migration.

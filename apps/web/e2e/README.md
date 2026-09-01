# e2e tests

Playwright, against the real stack. `pnpm --filter @stomp/web e2e` (or `pnpm e2e` from `apps/web`).

- `start-api.mjs` wipes + reseeds `apps/api/.data/e2e.db` and starts the API on **:3100**
- Playwright starts Vite on **:5273**, proxying `/api` → :3100
- The DB is reseeded once per run; tests run serially (`workers: 1`) and create their own data where they mutate

`_helpers.ts` — `main(page)` scopes assertions to the content area (the same text often also appears in the nav / hot sidebar); `createTodo`, `setWorkspace`.

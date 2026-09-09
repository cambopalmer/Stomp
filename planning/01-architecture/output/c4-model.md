# STOMP — C4 model

The architecture at four zoom levels ([C4 model](https://c4model.com/): Context → Container
→ Component → Code). This file is the tracked, diffable source; the same model is also an
**interactive click-through page** — [`c4-model.html`](c4-model.html) — with pan/zoom and
drill-down. The web app serves a copy at **`/architecture.html`** (generated from this file by
`apps/web` prebuild; linked from the app footer).

Current as of **v0.4.0** (Phases 0–3 on `main`). Update this file and `c4-model.html` together
when a top-level piece is added or its responsibility changes.

Legend: **planned** = designed, not built (Phase 4 integrations). **optional** = present but
off/absent unless configured (Google OAuth, OpenTelemetry).

---

## Level 1 — System Context

```mermaid
C4Context
  title STOMP — System Context

  Person(member, "Hub member", "One of 2–3 people who share a household hub: calendar, todos, incoming triage, learn library")

  System(stomp, "STOMP", "Self-hostable personal + shared hub, grouped by projects inside optional workspaces")

  System_Ext(gid, "Google Identity", "OAuth 2.0 / OIDC — optional single sign-on")
  System_Ext(gws, "Gmail & Google Calendar APIs", "PLANNED (Phase 4) — read-only inbound pull")
  System_Ext(otel, "OpenTelemetry collector", "OPTIONAL — trace sink when OTEL_MODE=otlp")

  Rel(member, stomp, "Uses", "HTTPS")
  Rel(stomp, gid, "Authenticates via", "OAuth (optional)")
  Rel(stomp, gws, "Pulls mail & events from", "planned")
  Rel(stomp, otel, "Exports traces to", "OTLP/HTTP")
```

- The member works entirely in a browser.
- Google Identity is a no-op until `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are set;
  email/password auth works regardless.
- Gmail/Calendar sync is designed (`integration_accounts`, `sync_log` tables exist) but not
  implemented.

---

## Level 2 — Containers (inside STOMP)

```mermaid
C4Container
  title STOMP — Containers

  Person(member, "Hub member", "")

  Container_Boundary(stomp, "STOMP") {
    Container(spa, "Web SPA", "React 18, Vite, React Router, TanStack Query", "Runs in the browser; built to static assets")
    Container(nginx, "web (nginx)", "nginx :8080", "Serves the SPA, reverse-proxies /api, /sitemap.xml, /robots.txt")
    Container(api, "API", "Fastify 5, Drizzle ORM, Node 20, :3000", "REST/JSON over /api; runs migrations on boot")
    ContainerDb(db, "Database", "libSQL / SQLite file", "20 tables on a named volume; Turso-swappable via DATABASE_URL")
    Container(shared, "@stomp/shared", "Zod schemas (build-time)", "One definition of every request/response contract, imported by SPA and API")
  }

  System_Ext(gid, "Google Identity", "OAuth 2.0 / OIDC")
  System_Ext(otel, "OpenTelemetry collector", "optional")

  Rel(member, spa, "Views & operates", "HTTPS")
  Rel(spa, nginx, "Loads SPA + calls /api", "JSON + stomp_session cookie")
  Rel(nginx, api, "Proxies /api", "HTTP :3000")
  Rel(api, db, "Reads / writes", "Drizzle → SQL")
  Rel(shared, spa, "Contracts", "build-time")
  Rel(shared, api, "Contracts", "build-time")
  Rel(api, gid, "OAuth redirect + userinfo", "optional")
  Rel(api, otel, "Traces", "OTLP, optional")
```

- **Local dev** replaces nginx: Vite serves the SPA on `:5173` and proxies `/api` to Fastify on
  `:3000`; the DB is `apps/api/.data/stomp.db`.
- **Container**: `docker compose up` starts `web` + `api`; the DB is a file on the `stomp-data`
  volume. Prod requires `SESSION_SECRET`; seeding prod requires `SEED_USER_PASSWORD`.
- Dependency direction: `web → shared ← api`. `web` never imports from `api`.

---

## Level 3 — Components: the API container

```mermaid
flowchart TB
  subgraph boot["Bootstrap"]
    server["server.ts / app.ts<br/><i>migrations, FK pragma, plugin registration order, listen</i>"]
    instr["instrumentation.ts<br/><i>OpenTelemetry — loaded first; OTEL_MODE off|console|otlp</i>"]
  end
  subgraph plugins["Fastify plugin chain (onRequest order)"]
    chain["cors · cookie · errorHandler · googleOAuth"]
    authctx["authContext<br/><i>unsign stomp_session → session+user → request.ctx; 401 non-public routes</i>"]
  end
  subgraph routes["Route layer (thin: validate → call service)"]
    rauth["routes/auth.ts<br/><i>/api/auth/* — me, signup, login, logout, google callback</i>"]
    rindex["routes/index.ts<br/><i>REST for every entity + /home/* + /shared-with-me + sitemap</i>"]
  end
  subgraph services["Service layer — logic + authorization"]
    svc["todos · events · references · projects · workspaces · incoming ·<br/>tags · notifications · home · collaborators · activity · auth · cleanup"]
    access["access.ts<br/><i>the visibility model — accessibleProjectIds(), projectAccess(), assertWorkspaceMember()</i>"]
  end
  subgraph data["Data access"]
    client["db/client.ts<br/><i>Drizzle + libSQL singleton</i>"]
    schema["db/schema.ts — 20 tables (source of truth)"]
  end
  db[("libSQL / SQLite")]
  lib["lib/* — sitemap, logger (pino + redaction + OTel mixin), cookies, errors, ids, clock"]

  instr -.->|loaded first| server
  server --> plugins
  authctx -->|"sets request.ctx / 401s"| routes
  chain --> rauth
  rauth --> svc
  rindex -->|"Zod-validate → call(db, ctx, …)"| svc
  rindex -.->|sitemap| lib
  svc -->|"checks visibility"| access
  svc -->|queries| client
  client --> schema
  client --> db
```

- Every service function is `(db, ctx, …)`. Adding real auth in Phase 3 changed only
  `authContext` — services and data access were untouched.
- Hard delete + an `activity_log` row on every mutation (resolved A5). `services/cleanup.ts`
  purges polymorphic references (`taggings`, notification/inbox back-links) on delete.

---

## Level 3 — Components: the Web SPA

```mermaid
flowchart TB
  main["main.tsx<br/><i>QueryClientProvider (+401→auth bounce), BrowserRouter, AuthProvider, WorkspaceProvider</i>"]
  app["App.tsx<br/><i>route table + auth gate: loading → spinner; no user → /login, /signup only</i>"]
  contexts["lib/auth.tsx · workspace.tsx · theme.ts<br/><i>useAuth, active-workspace scoping, light/dark/system</i>"]
  shell["AppShell<br/><i>banner, nav, HotSidebar, WorkspaceSwitcher, NotificationsBell, UserMenu</i>"]
  pages["Route pages<br/><i>Home, Todos/TodoDetail, Calendar/EventDetail, Incoming, Learn/ReferenceDetail,<br/>Projects/ProjectDetail, Workspaces, SharedWithMe, TagPage, Login</i>"]
  forms["Forms & editors<br/><i>TodoForm, EventForm, ReferenceForm, ShareEditor, AssigneePicker, TagEditor, ActivityPanel</i>"]
  queries["lib/queries.ts<br/><i>TanStack Query hooks — useTodos(), useCreateTodo(), useHotList() …</i>"]
  apiclient["lib/api.ts<br/><i>fetch wrapper, credentials: include; non-2xx → ApiError</i>"]
  api["API container"]

  main --> app
  app -->|auth gate| contexts
  app -->|"authed →"| shell
  app -->|route table| pages
  shell --> pages
  pages --> forms
  pages -->|"useTodos() …"| queries
  forms -->|mutations| queries
  queries -->|"api.get / post / patch"| apiclient
  apiclient -->|"HTTP /api/* + stomp_session cookie"| api
```

- Forms use the same Zod schemas the API validates against (`@stomp/shared`).
- A 401 from any query invalidates `["auth","me"]`, which flips `App.tsx` to the login screen.

---

## Level 4 — Code: one request end to end

`PATCH /api/todos/:id` — editing a todo. The **authentication** gate is the session lookup;
the **authorization** gate is `projectAccess`.

```mermaid
sequenceDiagram
  participant B as Browser
  participant N as nginx
  participant A as authContext<br/>(onRequest)
  participant R as routes/index.ts
  participant S as services/todos.ts
  participant Z as services/access.ts
  participant D as Drizzle / SQLite

  B->>N: PATCH /api/todos/:id  (Cookie: stomp_session)
  N->>A: proxy_pass → :3000
  rect rgb(250, 240, 220)
    note right of A: authentication
    A->>D: resolveSession(token)
    D-->>A: session + user   (else → 401)
  end
  A->>R: request.ctx = { userId }
  R->>R: Zod-validate params + body
  R->>S: updateTodo(db, ctx, id, input)
  rect rgb(225, 245, 235)
    note right of S: authorization
    S->>Z: projectAccess(userId, projectId)
    Z-->>S: { canEdit: true }   (else → 403)
  end
  S->>D: UPDATE todos SET … WHERE id = ?
  S->>D: INSERT activity_log (todo, update, changes)
  S-->>R: updated Todo
  R-->>B: 200 · Zod-serialized JSON
```

Public routes (health, `/api/auth/*`, `sitemap.xml`, `robots.txt`) skip the `request.ctx` set /
401 in `authContext`. `AUTH_TEST_BYPASS=true` makes the test suites run as the seed user.

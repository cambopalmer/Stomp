# Observability

## Logging

Fastify's built-in **pino** logger, configured in `apps/api/src/lib/logger.ts`:

- `LOG_LEVEL` env (`info` default)
- **`pino-pretty`** in development (`NODE_ENV=development`); raw JSON everywhere else
- **redaction** — `authorization` / `cookie` / `set-cookie` headers and any
  `*.password`, `*.*_token`, `*.secret` field are logged as `[redacted]`
- every line carries `trace_id` / `span_id` of the active request span (mixin),
  so logs and traces join up
- `logger` (standalone) for startup / jobs / auth events; `req.log` for per-request

## Tracing — OpenTelemetry

`apps/api/src/instrumentation.ts`, loaded first in `server.ts`. Off by default.

| `OTEL_MODE` | Effect |
|---|---|
| `off` (default) | SDK not started, zero overhead |
| `console` | spans printed to stdout — quick local check |
| `otlp` | OTLP/HTTP export to `OTEL_EXPORTER_OTLP_ENDPOINT` (default `http://localhost:4318`) |

Auto-instrumentation covers incoming HTTP (method, route target, status, duration).
Fastify-level spans need a CJS/bundled runtime — they show in the Docker image, not
under `tsx` dev. libSQL has no OTel instrumentation yet, so DB time shows as a gap
inside the request span.

### Run a backend locally

Any OTLP receiver works. Two easy ones:

```bash
# SigNoz (all-in-one: traces + logs + metrics UI on :3301)
git clone -b main https://github.com/SigNoz/signoz && cd signoz/deploy
docker compose -f docker/clickhouse-setup/docker-compose.yaml up -d

# or Grafana LGTM (Tempo + Loki + Grafana on :3000)
docker run -p 3000:3000 -p 4318:4318 grafana/otel-lgtm
```

Then: `OTEL_MODE=otlp pnpm --filter @stomp/api dev` and open the UI.

## Not yet

- Metrics (OTel meter) — add `metricReader` to the SDK when there's a dashboard to feed.
- Web/client telemetry — the React app has no error reporting. Options in
  `planning/06-gaps-and-questions/output/open-questions.md`.
- Log shipping / retention — deferred until self-hosted with real traffic.

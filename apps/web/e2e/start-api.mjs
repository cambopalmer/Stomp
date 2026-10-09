// Seed a fresh e2e database, then start the API against it.
import { spawnSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const apiDir = fileURLToPath(new URL("../../api", import.meta.url));
const env = {
  ...process.env,
  NODE_ENV: "test",
  API_PORT: "3100",
  DATABASE_URL: "file:./.data/e2e.db",
  WEB_ORIGIN: "http://localhost:5273",
  PUBLIC_BASE_URL: "http://localhost:5273",
  SEED_USER_EMAIL: "owner@stomp.local",
  // pinned so a developer's root .env (loaded by the API via dotenv) can't make local runs
  // differ from CI. Fake Google app: Connect buttons render, nothing ever calls Google.
  GOOGLE_CLIENT_ID: "e2e-client.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "e2e-secret",
  INTEGRATION_ENC_KEY: "ZTJlLWUyZS1lMmUtZTJlLWUyZS1lMmUtZTJlLWUyZS0=",
  GOOGLE_CLOUD_PROJECT: "stomp-e2e-123",
  SYNC_INTERVAL_MINUTES: "0",
};

for (const ext of ["", "-shm", "-wal"]) {
  try {
    rmSync(`${apiDir}/.data/e2e.db${ext}`);
  } catch {
    /* not there */
  }
}

const seed = spawnSync("node", ["--import", "tsx", "src/db/seed.ts"], {
  cwd: apiDir,
  env,
  stdio: "inherit",
});
if (seed.status !== 0) process.exit(seed.status ?? 1);

const server = spawn("node", ["--import", "tsx", "src/server.ts"], {
  cwd: apiDir,
  env,
  stdio: "inherit",
});
process.on("SIGTERM", () => server.kill());
process.on("SIGINT", () => server.kill());
server.on("exit", (code) => process.exit(code ?? 0));

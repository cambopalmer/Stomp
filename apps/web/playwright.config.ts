import { defineConfig, devices } from "@playwright/test";

/**
 * e2e runs the real stack:
 *  - a fresh seeded API on :3100 (its own e2e.db, wiped + reseeded each run)
 *  - the Vite dev server on :5273, proxying /api -> :3100
 * The `setup` project logs in once as the seeded owner; every other test reuses
 * that session via storageState. `auth.spec.ts` opts out (tests the login flow).
 */
const API_PORT = 3100;
const WEB_PORT = 5273;
const OWNER_STATE = "e2e/.auth/owner.json";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "on-first-retry",
    navigationTimeout: 45_000,
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      testIgnore: /auth\.(setup|spec)\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: OWNER_STATE },
      dependencies: ["setup"],
    },
    {
      name: "auth",
      testMatch: /auth\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "node e2e/start-api.mjs",
      cwd: ".",
      port: API_PORT,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      timeout: 60_000,
    },
    {
      command: `node node_modules/vite/bin/vite.js --port ${WEB_PORT} --strictPort`,
      cwd: ".",
      port: WEB_PORT,
      reuseExistingServer: !process.env.CI,
      env: { API_PROXY_TARGET: `http://localhost:${API_PORT}` },
      timeout: 60_000,
    },
  ],
});

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Each run gets a fresh scratch DB file; the seed wipes + repopulates.
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "file:./.data/test.db",
      SEED_USER_EMAIL: "owner@stomp.local",
      // existing tests aren't session-aware; act as the seeded owner when no cookie.
      // The dedicated auth tests hit /api/auth/* directly and don't rely on this.
      AUTH_TEST_BYPASS: "true",
    },
    fileParallelism: false,
    hookTimeout: 30_000,
  },
});

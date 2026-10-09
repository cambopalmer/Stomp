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
      // fake Google app + a throwaway key so integration routes are live; Google itself is stubbed per test
      GOOGLE_CLIENT_ID: "test-client.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "test-secret",
      INTEGRATION_ENC_KEY: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
      GOOGLE_CLOUD_PROJECT: "stomp-test-123",
      SYNC_INTERVAL_MINUTES: "0",
      // pin: a developer's root .env (dotenv-loaded) must not leak into tests
      PUBLIC_BASE_URL: "http://localhost:8080",
    },
    fileParallelism: false,
    hookTimeout: 30_000,
  },
});

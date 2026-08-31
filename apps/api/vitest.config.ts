import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Each run gets a fresh scratch DB file; the seed wipes + repopulates.
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "file:./.data/test.db",
      SEED_USER_EMAIL: "owner@stomp.local",
    },
    fileParallelism: false,
    hookTimeout: 30_000,
  },
});

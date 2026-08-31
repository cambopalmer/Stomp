import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    // drizzle-kit reads the file path; runtime uses config.ts
    url: process.env.DATABASE_URL?.replace(/^file:/, "") ?? "./.data/stomp.db",
  },
  strict: true,
  verbose: true,
});

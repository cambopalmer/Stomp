import { readFileSync } from "node:fs";
import { build } from "esbuild";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

// Bundle the API (inlining @stomp/shared) into a single ESM file for the
// production container. Native deps stay external and are provided by node_modules.
await build({
  entryPoints: ["src/server.ts", "src/db/seed.ts", "src/db/migrate.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outdir: "dist",
  external: [
    "@libsql/client",
    "libsql",
    "@node-rs/argon2", // native .node binary
    "@node-rs/*",
    // OTel auto-instrumentation patches require() — must stay external
    "@opentelemetry/*",
    // pino spawns transport workers that re-resolve these from node_modules
    "pino",
    "pino-pretty",
    "thread-stream",
  ],
  banner: {
    js: "import{createRequire as ___cr}from'module';const require=___cr(import.meta.url);",
  },
  define: { "process.env.BUILD_VERSION": JSON.stringify(version) },
  logLevel: "info",
});

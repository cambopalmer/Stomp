import { build } from "esbuild";

// Bundle the API (inlining @stomp/shared) into a single ESM file for the
// production container. Native deps stay external and are provided by node_modules.
await build({
  entryPoints: ["src/server.ts", "src/db/seed.ts", "src/db/migrate.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outdir: "dist",
  external: ["@libsql/client", "libsql"],
  banner: {
    js: "import{createRequire as ___cr}from'module';const require=___cr(import.meta.url);",
  },
  logLevel: "info",
});

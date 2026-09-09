// Wrap the C4 model (authored as an artifact fragment in planning/) into a
// standalone HTML document served by the web app at /architecture.html.
// Run by `predev` / `prebuild`; the output is committed so it works without it.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = fileURLToPath(
  new URL("../../../planning/01-architecture/output/c4-model.html", import.meta.url),
);
const outDir = fileURLToPath(new URL("../public", import.meta.url));
const out = `${outDir}/architecture.html`;

const fragment = readFileSync(src, "utf8");
// The fragment leads with <title>/<meta>/<link>/<style> then the body markup;
// browsers hoist the metadata even when it sits in <body>, same as the artifact host.
const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="robots" content="noindex" />
<!-- Generated from planning/01-architecture/output/c4-model.html — edit that file, then \`pnpm --filter @stomp/web gen:arch\`. -->
</head>
<body>
${fragment}
</body>
</html>
`;

mkdirSync(outDir, { recursive: true });
writeFileSync(out, doc);
console.log(`architecture.html ← c4-model.html (${(doc.length / 1024).toFixed(0)} KB)`);

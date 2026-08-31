import { config } from "../config.js";
import { db } from "../db/client.js";
import { events, projects, references, tags, todos } from "../db/schema.js";

const STATIC_ROUTES = ["/", "/calendar", "/todos", "/incoming", "/learn", "/projects", "/signup"];

let cache: { xml: string; at: number } | null = null;
let writeCounter = 0;
const TTL_MS = 5 * 60 * 1000;

/** Called by services after any mutation to invalidate the sitemap cache. */
export function bumpSitemap(): void {
  writeCounter++;
  cache = null;
}

export async function buildSitemap(): Promise<string> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.xml;

  const base = config.PUBLIC_BASE_URL.replace(/\/$/, "");
  const urls: { loc: string; lastmod?: number }[] = STATIC_ROUTES.map((r) => ({ loc: base + r }));

  const [ps, ts, es, rs, gs] = await Promise.all([
    db.select({ id: projects.id, u: projects.updatedAt }).from(projects),
    db.select({ id: todos.id, u: todos.updatedAt }).from(todos),
    db.select({ id: events.id, u: events.updatedAt }).from(events),
    db.select({ id: references.id, u: references.updatedAt }).from(references),
    db.select({ id: tags.id, name: tags.name }).from(tags),
  ]);
  for (const p of ps) urls.push({ loc: `${base}/projects/${p.id}`, lastmod: p.u });
  for (const t of ts) urls.push({ loc: `${base}/todos/${t.id}`, lastmod: t.u });
  for (const e of es) urls.push({ loc: `${base}/calendar/${e.id}`, lastmod: e.u });
  for (const r of rs) urls.push({ loc: `${base}/learn/${r.id}`, lastmod: r.u });
  for (const g of gs) urls.push({ loc: `${base}/tags/${encodeURIComponent(g.name)}` });

  const body = urls
    .map(
      (u) =>
        `  <url><loc>${u.loc}</loc>${
          u.lastmod ? `<lastmod>${new Date(u.lastmod).toISOString()}</lastmod>` : ""
        }</url>`,
    )
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
  cache = { xml, at: Date.now() };
  return xml;
}

export const robotsTxt = `User-agent: *\nDisallow: /\n`;

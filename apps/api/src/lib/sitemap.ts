import { eq } from "drizzle-orm";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { events, projects, references, todos } from "../db/schema.js";

const STATIC_ROUTES = ["/", "/calendar", "/todos", "/incoming", "/learn", "/projects", "/shared", "/workspaces", "/login", "/signup"];

/**
 * The public sitemap only lists static routes — STOMP is a private hub, so
 * per-item URLs would leak other users' data. `buildUserSitemap` (authenticated)
 * returns the caller's own items.
 */
export function buildSitemap(): string {
  const base = config.PUBLIC_BASE_URL.replace(/\/$/, "");
  return xmlDoc(STATIC_ROUTES.map((r) => ({ loc: base + r })));
}

export async function buildUserSitemap(userId: string): Promise<string> {
  const base = config.PUBLIC_BASE_URL.replace(/\/$/, "");
  const urls: SitemapUrl[] = STATIC_ROUTES.map((r) => ({ loc: base + r }));

  const [ts, es, rs, ps] = await Promise.all([
    db.select({ id: todos.id, u: todos.updatedAt }).from(todos).where(eq(todos.createdBy, userId)),
    db.select({ id: events.id, u: events.updatedAt }).from(events).where(eq(events.createdBy, userId)),
    db
      .select({ id: references.id, u: references.updatedAt })
      .from(references)
      .where(eq(references.addedBy, userId)),
    db.select({ id: projects.id, u: projects.updatedAt }).from(projects).where(eq(projects.ownerId, userId)),
  ]);
  for (const t of ts) urls.push({ loc: `${base}/todos/${t.id}`, lastmod: t.u });
  for (const e of es) urls.push({ loc: `${base}/calendar/${e.id}`, lastmod: e.u });
  for (const r of rs) urls.push({ loc: `${base}/learn/${r.id}`, lastmod: r.u });
  for (const p of ps) urls.push({ loc: `${base}/projects/${p.id}`, lastmod: p.u });
  return xmlDoc(urls);
}

interface SitemapUrl {
  loc: string;
  lastmod?: number;
}

function xmlDoc(urls: SitemapUrl[]): string {
  const body = urls
    .map(
      (u) =>
        `  <url><loc>${u.loc}</loc>${
          u.lastmod ? `<lastmod>${new Date(u.lastmod).toISOString()}</lastmod>` : ""
        }</url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export const robotsTxt = `User-agent: *\nDisallow: /\n`;

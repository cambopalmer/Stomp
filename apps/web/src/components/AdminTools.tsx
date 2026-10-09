import { Database, ExternalLink, Network, Cloud } from "lucide-react";
import type { ReactNode } from "react";
import { useAdminTools } from "../lib/queries.js";

/** Operator links for the hub (backlog: "Admin panel: tools & links"). URLs only — no data. */
export function AdminTools() {
  const tools = useAdminTools();
  const t = tools.data;
  if (!t) return null;

  return (
    <section aria-labelledby="tools-h" className="flex flex-col gap-3">
      <h2 id="tools-h" className="text-base font-semibold">
        Tools &amp; links
      </h2>
      <div className="grid gap-3 md:grid-cols-3">
        <ToolCard icon={<Database size={16} aria-hidden="true" />} title="Data browser">
          {t.dataBrowser ? (
            <>
              <OutLink href={t.dataBrowser.url}>{t.dataBrowser.label}</OutLink>
              {t.dataBrowser.hint && <p className="text-xs text-muted">{t.dataBrowser.hint}</p>}
            </>
          ) : (
            <p className="text-xs text-muted">Only available in development.</p>
          )}
        </ToolCard>

        <ToolCard icon={<Network size={16} aria-hidden="true" />} title="Architecture">
          <OutLink href={t.architectureMap.url}>{t.architectureMap.label}</OutLink>
          <p className="text-xs text-muted">The C4 map of how STOMP fits together.</p>
        </ToolCard>

        <ToolCard icon={<Cloud size={16} aria-hidden="true" />} title="Google Cloud">
          {!t.googleCloud.configured ? (
            <p className="text-xs text-muted">Google sign-in isn’t set up on this server (docs/GOOGLE-OAUTH.md).</p>
          ) : !t.googleCloud.projectId ? (
            <p className="text-xs text-muted">
              Set <code>GOOGLE_CLOUD_PROJECT</code> in <code>.env</code> to your project id to get links here.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5" data-testid="google-links">
              {t.googleCloud.links.map((l) => (
                <li key={l.url}>
                  <OutLink href={l.url}>{l.label}</OutLink>
                  {l.hint && <p className="text-xs text-muted">{l.hint}</p>}
                </li>
              ))}
            </ul>
          )}
        </ToolCard>
      </div>
    </section>
  );
}

function ToolCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-3">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}

function OutLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
      {children} <ExternalLink size={12} aria-hidden="true" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

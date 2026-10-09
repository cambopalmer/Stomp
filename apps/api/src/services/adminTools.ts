import type { AdminTools } from "@stomp/shared";
import { config } from "../config.js";

/**
 * Operator links for /admin. Only URLs — nothing here reads anyone's data
 * (admins manage accounts, never content). Built server-side so the project
 * id and "is this production?" come from configuration.
 */
export function adminTools(): AdminTools {
  const project = config.GOOGLE_CLOUD_PROJECT ?? null;
  const gc = (path: string) => `https://console.cloud.google.com/${path}?project=${encodeURIComponent(project!)}`;
  return {
    // a local CLI (`pnpm --filter @stomp/api db:studio`) — meaningless on a server
    dataBrowser: config.isProd
      ? null
      : {
          label: "Data browser (Drizzle Studio)",
          url: "https://local.drizzle.studio",
          hint: "Works while pnpm --filter @stomp/api db:studio is running on this machine.",
        },
    architectureMap: { label: "Architecture map", url: "/architecture.html" },
    googleCloud: {
      configured: config.googleOAuthConfigured,
      projectId: project,
      links: project
        ? [
            { label: "Test users & publishing", url: gc("auth/audience"), hint: "Google Auth Platform → Audience" },
            { label: "OAuth clients & secrets", url: gc("auth/clients"), hint: "Redirect URIs live here" },
            { label: "Scopes (Data Access)", url: gc("auth/scopes") },
            { label: "Enabled APIs", url: gc("apis/dashboard"), hint: "Gmail + Google Calendar APIs" },
          ]
        : [],
    },
  };
}

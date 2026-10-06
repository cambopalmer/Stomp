import type { IntegrationAccount, IntegrationProduct } from "@stomp/shared";
import { CalendarDays, Mail } from "lucide-react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router";
import { Badge, Button, Card, ErrorState, Spinner } from "../components/ui.js";
import { useAuth } from "../lib/auth.js";
import { fmtDate } from "../lib/format.js";
import { integrationConnectHref, useDisconnectIntegration, useIntegrations } from "../lib/queries.js";

/** Outcome codes the API's OAuth callback appends to /settings. */
const ERRORS: Record<string, string> = {
  denied: "You cancelled on Google's screen — nothing was connected.",
  state: "That sign-in link expired or didn't match. Please try connecting again.",
  google: "Google returned an error. Please try again.",
};
const CONNECTED: Record<string, string> = {
  gmail: "Gmail connected. Label messages “STOMP” in Gmail and they'll arrive in Incoming.",
  calendar: "Google Calendar connected.",
};

export function Settings() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const list = useIntegrations();

  const connected = params.get("connected");
  const error = params.get("error");
  const notice =
    connected && CONNECTED[connected]
      ? { ok: true, text: CONNECTED[connected] }
      : error
        ? { ok: false, text: params.get("message") ?? ERRORS[error] ?? "Couldn't connect." }
        : null;
  const dismiss = () => setParams({}, { replace: true });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Settings</h1>
        {user && <p className="mt-1 text-sm text-muted">Signed in as {user.email}</p>}
      </div>

      {notice && (
        <div
          role={notice.ok ? "status" : "alert"}
          className={`flex items-start justify-between gap-3 rounded-lg border p-3 text-sm ${
            notice.ok ? "border-success/40 bg-success/5 text-success" : "border-danger/40 bg-danger/5 text-danger"
          }`}
        >
          <span>{notice.text}</span>
          <button onClick={dismiss} className="shrink-0 underline">
            Dismiss
          </button>
        </div>
      )}

      <section aria-labelledby="connected-h" className="flex flex-col gap-3">
        <div>
          <h2 id="connected-h" className="text-base font-semibold">
            Connected accounts
          </h2>
          <p className="text-sm text-muted">
            Read-only. STOMP never sends mail or changes your calendar.
          </p>
        </div>

        {list.isLoading ? (
          <Spinner />
        ) : list.isError ? (
          <ErrorState error={list.error} retry={list.refetch} />
        ) : !list.data?.configured ? (
          <Card>
            <p className="text-sm text-muted">
              Google connections aren’t set up on this server yet. An admin needs to add the Google
              credentials and <code>INTEGRATION_ENC_KEY</code> — see <code>docs/GOOGLE-OAUTH.md</code>.
            </p>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <ProviderCard
              product="gmail"
              icon={<Mail size={18} aria-hidden />}
              title="Gmail"
              blurb="Messages you label “STOMP” in Gmail land in Incoming, ready to triage."
              accounts={list.data.accounts.filter((a) => a.provider === "gmail")}
            />
            <ProviderCard
              product="calendar"
              icon={<CalendarDays size={18} aria-hidden />}
              title="Google Calendar"
              blurb="Events from the calendars you pick show up in STOMP’s calendar."
              accounts={list.data.accounts.filter((a) => a.provider === "google_calendar")}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function ProviderCard({
  product,
  icon,
  title,
  blurb,
  accounts,
}: {
  product: IntegrationProduct;
  icon: ReactNode;
  title: string;
  blurb: string;
  accounts: IntegrationAccount[];
}) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="text-sm text-muted">{blurb}</p>

      {accounts.map((a) => (
        <AccountRow key={a.id} account={a} product={product} />
      ))}

      {accounts.length === 0 && (
        <a
          href={integrationConnectHref(product)}
          className="inline-flex w-fit items-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-fg hover:opacity-90"
        >
          Connect {title}
        </a>
      )}
    </Card>
  );
}

function AccountRow({ account, product }: { account: IntegrationAccount; product: IntegrationProduct }) {
  const disconnect = useDisconnectIntegration();
  const reauth = account.status === "needs_reauth";

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-2.5" data-testid={`account-${account.provider}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{account.email}</span>
        {reauth ? (
          <Badge className="border-danger/40 text-danger">Needs reconnecting</Badge>
        ) : (
          <Badge>Connected</Badge>
        )}
      </div>
      <p className="tnum text-xs text-muted">
        {account.lastSyncAt ? `Last synced ${fmtDate(account.lastSyncAt)}` : "Not synced yet"}
        {account.lastError && !reauth && <span className="text-danger"> · {account.lastError}</span>}
      </p>
      {reauth && (
        <p className="text-xs text-danger">
          Google stopped accepting this connection{account.lastError ? ` (${account.lastError})` : ""}. Reconnect to
          resume syncing.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {reauth && (
          <a
            href={integrationConnectHref(product)}
            className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg hover:opacity-90"
          >
            Reconnect
          </a>
        )}
        <Button
          variant="ghost"
          className="px-2.5 py-1.5 text-xs"
          disabled={disconnect.isPending}
          onClick={() => disconnect.mutate(account.id)}
        >
          Disconnect
        </Button>
      </div>
      {disconnect.isError && (
        <p role="alert" className="text-xs text-danger">
          {disconnect.error instanceof Error ? disconnect.error.message : "Couldn't disconnect"}
        </p>
      )}
    </div>
  );
}

import type {
  GoogleCalendarChoice,
  IntegrationAccount,
  IntegrationProduct,
  IntegrationsResponse,
} from "@stomp/shared";
import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { events, integrationAccounts } from "../db/schema.js";
import { config } from "../config.js";
import { clock } from "../lib/clock.js";
import { seal, unseal } from "../lib/crypto.js";
import { BadRequest, NotFound } from "../lib/errors.js";
import {
  buildAuthUrl,
  exchangeCode,
  fetchUserEmail,
  GrantRevoked,
  refreshAccessToken,
  revokeToken,
  SCOPES,
} from "../lib/google.js";
import { newId } from "../lib/ids.js";
import { logger } from "../lib/logger.js";
import type { Ctx } from "./access.js";
import { purgePolymorphicRefs } from "./cleanup.js";

export type AccountRow = typeof integrationAccounts.$inferSelect;

const PROVIDER = { gmail: "gmail", calendar: "google_calendar" } as const satisfies Record<
  IntegrationProduct,
  AccountRow["provider"]
>;

/** Provider-specific JSON blob in integration_accounts.settings. */
export interface CalendarSettings {
  calendars: (GoogleCalendarChoice & { syncToken?: string | null })[];
}
export interface GmailSettings {
  labelId?: string | null;
}

export function readSettings<T>(row: AccountRow): T {
  try {
    return (row.settings ? JSON.parse(row.settings) : {}) as T;
  } catch {
    return {} as T;
  }
}

function assertConfigured() {
  if (!config.integrationsConfigured) {
    throw BadRequest("Google integrations aren't set up on this server (see docs/GOOGLE-OAUTH.md)");
  }
}

export function toDto(row: AccountRow): IntegrationAccount {
  const dto: IntegrationAccount = {
    id: row.id,
    provider: row.provider,
    email: row.email,
    status: row.status,
    lastSyncAt: row.lastSyncAt,
    lastError: row.lastError,
    createdAt: row.createdAt,
  };
  if (row.provider === "google_calendar") {
    dto.calendars = (readSettings<CalendarSettings>(row).calendars ?? []).map(
      ({ id, summary, primary, selected, color }) => ({ id, summary, primary, selected, color }),
    );
  }
  return dto;
}

export async function listAccounts(db: Db, ctx: Ctx): Promise<IntegrationsResponse> {
  const rows = await db
    .select()
    .from(integrationAccounts)
    .where(eq(integrationAccounts.userId, ctx.userId))
    .orderBy(asc(integrationAccounts.createdAt));
  return { configured: config.integrationsConfigured, accounts: rows.map(toDto) };
}

export async function loadOwn(db: Db, ctx: Ctx, id: string): Promise<AccountRow> {
  const [row] = await db
    .select()
    .from(integrationAccounts)
    .where(and(eq(integrationAccounts.id, id), eq(integrationAccounts.userId, ctx.userId)))
    .limit(1);
  if (!row) throw NotFound("Connected account");
  return row;
}

// ─────────────────────────────────────── connect

export function connectUrl(product: IntegrationProduct, state: string): string {
  assertConfigured();
  return buildAuthUrl(SCOPES[product], state);
}

/** Finish the OAuth dance: exchange the code and upsert the account row. */
export async function completeConnect(
  db: Db,
  ctx: Ctx,
  product: IntegrationProduct,
  code: string,
): Promise<AccountRow> {
  assertConfigured();
  const tokens = await exchangeCode(code);
  // Google's consent screen lets people untick individual scopes.
  if (!tokens.scope.split(" ").includes(SCOPES[product])) {
    throw BadRequest(
      product === "gmail"
        ? "Gmail access wasn't granted — tick “Read your email” on Google's consent screen"
        : "Calendar access wasn't granted — tick “See your calendars” on Google's consent screen",
    );
  }
  const email = await fetchUserEmail(tokens.access_token);
  const provider = PROVIDER[product];
  const now = clock.now();

  const [existing] = await db
    .select()
    .from(integrationAccounts)
    .where(
      and(
        eq(integrationAccounts.userId, ctx.userId),
        eq(integrationAccounts.provider, provider),
        eq(integrationAccounts.email, email),
      ),
    )
    .limit(1);

  const tokenCols = {
    accessToken: seal(tokens.access_token),
    // Google omits refresh_token when it already issued one — keep the old one then
    ...(tokens.refresh_token ? { refreshToken: seal(tokens.refresh_token) } : {}),
    tokenExpiresAt: now + tokens.expires_in * 1000,
    scopes: tokens.scope,
    status: "connected" as const,
    lastError: null,
    updatedAt: now,
  };

  if (existing) {
    await db.update(integrationAccounts).set(tokenCols).where(eq(integrationAccounts.id, existing.id));
  } else {
    if (!tokens.refresh_token) throw BadRequest("Google didn't return offline access — please try connecting again");
    await db.insert(integrationAccounts).values({
      id: newId(),
      userId: ctx.userId,
      provider,
      email,
      ...tokenCols,
      createdAt: now,
    });
  }
  logger.info({ userId: ctx.userId, provider, reconnect: !!existing }, "integration connected");
  const [row] = await db
    .select()
    .from(integrationAccounts)
    .where(
      and(
        eq(integrationAccounts.userId, ctx.userId),
        eq(integrationAccounts.provider, provider),
        eq(integrationAccounts.email, email),
      ),
    )
    .limit(1);
  return row!;
}

// ─────────────────────────────────────── tokens

/**
 * A usable access token for this account, refreshing when it's within a minute
 * of expiry. A dead grant flips the account to `needs_reauth` and rethrows.
 */
export async function accessTokenFor(db: Db, row: AccountRow): Promise<string> {
  const now = clock.now();
  if (row.accessToken && row.tokenExpiresAt && row.tokenExpiresAt - 60_000 > now) {
    return unseal(row.accessToken);
  }
  if (!row.refreshToken) {
    await markNeedsReauth(db, row, "No refresh token stored");
    throw new GrantRevoked("No refresh token stored");
  }
  try {
    const t = await refreshAccessToken(unseal(row.refreshToken));
    await db
      .update(integrationAccounts)
      .set({
        accessToken: seal(t.access_token),
        tokenExpiresAt: now + t.expires_in * 1000,
        ...(t.refresh_token ? { refreshToken: seal(t.refresh_token) } : {}),
        updatedAt: now,
      })
      .where(eq(integrationAccounts.id, row.id));
    return t.access_token;
  } catch (e) {
    if (e instanceof GrantRevoked) await markNeedsReauth(db, row, e.message);
    throw e;
  }
}

export async function markNeedsReauth(db: Db, row: AccountRow, reason: string): Promise<void> {
  await db
    .update(integrationAccounts)
    .set({ status: "needs_reauth", lastError: reason, updatedAt: clock.now() })
    .where(eq(integrationAccounts.id, row.id));
  logger.warn({ accountId: row.id, provider: row.provider, reason }, "integration needs re-auth");
}

// ─────────────────────────────────────── disconnect

/**
 * Revoke at Google (best effort) and forget the account. Calendar mirrors are
 * removed with it; Gmail items already in Incoming stay (ADR-0005).
 */
export async function disconnect(db: Db, ctx: Ctx, id: string): Promise<void> {
  const row = await loadOwn(db, ctx, id);
  const token = row.refreshToken ?? row.accessToken;
  if (token) await revokeToken(unseal(token)).catch(() => undefined);

  await db.transaction(async (txRaw) => {
    const tx = txRaw as unknown as Db;
    if (row.provider === "google_calendar") {
      const mirrored = and(eq(events.createdBy, ctx.userId), eq(events.externalProvider, "google"));
      for (const e of await tx.select({ id: events.id }).from(events).where(mirrored)) {
        await purgePolymorphicRefs(tx, "event", e.id);
      }
      await tx.delete(events).where(mirrored);
    }
    await tx.delete(integrationAccounts).where(eq(integrationAccounts.id, row.id));
  });
  logger.info({ userId: ctx.userId, provider: row.provider }, "integration disconnected");
}

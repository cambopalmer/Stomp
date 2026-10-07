import type { IntegrationAccount } from "@stomp/shared";
import type { SyncLogEntry } from "@stomp/shared";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { events, incomingItems, integrationAccounts, syncLog } from "../db/schema.js";
import * as gmail from "../integrations/gmail.js";
import * as gcal from "../integrations/googleCalendar.js";
import { clock } from "../lib/clock.js";
import { BadRequest } from "../lib/errors.js";
import { GrantRevoked } from "../lib/google.js";
import { newId } from "../lib/ids.js";
import { logger } from "../lib/logger.js";
import type { Ctx } from "./access.js";
import { purgePolymorphicRefs } from "./cleanup.js";
import {
  type AccountRow,
  accessTokenFor,
  type CalendarSettings,
  type GmailSettings,
  loadOwn,
  readSettings,
  toDto,
} from "./integrations.js";

const DAY = 86_400_000;

async function saveSettings(db: Db, row: AccountRow, settings: unknown) {
  const json = JSON.stringify(settings);
  await db.update(integrationAccounts).set({ settings: json, updatedAt: clock.now() }).where(eq(integrationAccounts.id, row.id));
  row.settings = json;
}

// ─────────────────────────────────────── calendar list + selection

/** Re-read the user's calendar list, keeping their choices; new primary is on by default. */
export async function refreshCalendarList(db: Db, row: AccountRow): Promise<CalendarSettings> {
  const token = await accessTokenFor(db, row);
  const remote = await gcal.listCalendars(token);
  const prev = readSettings<CalendarSettings>(row).calendars ?? [];
  const firstTime = prev.length === 0;
  const calendars = remote.map((c) => {
    const old = prev.find((p) => p.id === c.id);
    return { ...c, selected: old ? old.selected : firstTime && c.primary };
  });
  const settings: CalendarSettings = { calendars };
  await saveSettings(db, row, settings);
  return settings;
}

export async function selectCalendars(
  db: Db,
  ctx: Ctx,
  id: string,
  calendarIds: string[],
): Promise<IntegrationAccount> {
  const row = await loadOwn(db, ctx, id);
  if (row.provider !== "google_calendar") throw BadRequest("Not a calendar connection");
  const settings = readSettings<CalendarSettings>(row);
  const known = new Set((settings.calendars ?? []).map((c) => c.id));
  const unknown = calendarIds.filter((c) => !known.has(c));
  if (unknown.length) throw BadRequest("Unknown calendar — refresh the list and try again");

  const wanted = new Set(calendarIds);
  await saveSettings(db, row, {
    calendars: (settings.calendars ?? []).map((c) => ({ ...c, selected: wanted.has(c.id) })),
  });
  await syncAccount(db, row); // apply right away: import new picks, drop deselected
  return toDto((await loadOwn(db, ctx, id)));
}

// ─────────────────────────────────────── sync

export interface SyncResult {
  added: number;
  updated: number;
  removed: number;
}

/** Sync one account. Never throws for provider trouble — it's recorded on the row + sync_log. */
export async function syncAccount(db: Db, row: AccountRow): Promise<SyncResult | null> {
  if (row.status === "needs_reauth") return null;
  const startedAt = clock.now();
  const logId = newId();
  const entityType = row.provider === "gmail" ? "email" : "event";
  await db.insert(syncLog).values({
    id: logId,
    integrationAccountId: row.id,
    direction: "pull",
    entityType,
    summary: "running",
    startedAt,
  });

  try {
    let result: SyncResult;
    let summary: string;
    if (row.provider === "google_calendar") {
      ({ result, summary } = await syncCalendar(db, row));
    } else if (row.provider === "gmail") {
      ({ result, summary } = await syncGmail(db, row));
    } else {
      throw new Error(`No adapter for ${row.provider}`);
    }
    const now = clock.now();
    await db.update(syncLog).set({ summary, finishedAt: now }).where(eq(syncLog.id, logId));
    await db
      .update(integrationAccounts)
      .set({ lastSyncAt: now, lastError: null, updatedAt: now })
      .where(eq(integrationAccounts.id, row.id));
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.update(syncLog).set({ summary: "failed", error: msg, finishedAt: clock.now() }).where(eq(syncLog.id, logId));
    if (!(e instanceof GrantRevoked)) {
      // GrantRevoked already flipped the row to needs_reauth with its own message
      await db.update(integrationAccounts).set({ lastError: msg, updatedAt: clock.now() }).where(eq(integrationAccounts.id, row.id));
    }
    logger.warn({ accountId: row.id, provider: row.provider, err: msg }, "sync failed");
    return null;
  }
}

async function syncCalendar(db: Db, row: AccountRow): Promise<{ result: SyncResult; summary: string }> {
  let settings = readSettings<CalendarSettings>(row);
  if (!settings.calendars?.length) settings = await refreshCalendarList(db, row);
  const token = await accessTokenFor(db, row);

  const now = clock.now();
  const timeMin = now - gcal.WINDOW_PAST_DAYS * DAY;
  const timeMax = now + gcal.WINDOW_FUTURE_DAYS * DAY;
  const selected = settings.calendars.filter((c) => c.selected);
  const result: SyncResult = { added: 0, updated: 0, removed: 0 };

  // fetch everything first — a Google error mid-way leaves local data untouched
  const remote = new Map<string, gcal.MirroredEvent[]>();
  for (const cal of selected) remote.set(cal.id, await gcal.listWindow(token, cal.id, timeMin, timeMax));

  await db.transaction(async (txRaw) => {
    const tx = txRaw as unknown as Db;
    // this connection's mirrors only — a second calendar account keeps its own
    const mine = eq(events.integrationAccountId, row.id);
    const existing = await tx
      .select({ id: events.id, externalId: events.externalId, etag: events.externalEtag, startsAt: events.startsAt, endsAt: events.endsAt })
      .from(events)
      .where(mine);
    const byExt = new Map(existing.map((e) => [e.externalId!, e]));
    const seen = new Set<string>();
    const stamp = clock.now();

    for (const [, mirrors] of remote) {
      for (const m of mirrors) {
        seen.add(m.externalId);
        const cols = {
          title: m.title,
          description: m.description,
          location: m.location,
          startsAt: m.startsAt,
          endsAt: m.endsAt,
          allDay: m.allDay,
          timezone: m.timezone,
          status: m.status,
          externalEtag: m.etag,
          lastSyncedAt: stamp,
          updatedAt: stamp,
        };
        const hit = byExt.get(m.externalId);
        if (!hit) {
          await tx.insert(events).values({
            id: newId(),
            ...cols,
            externalProvider: "google",
            externalId: m.externalId,
            integrationAccountId: row.id,
            workspaceId: null,
            projectId: null,
            createdBy: row.userId,
            createdAt: stamp,
          });
          result.added++;
        } else if (hit.etag !== m.etag) {
          await tx.update(events).set(cols).where(eq(events.id, hit.id));
          result.updated++;
        }
      }
    }

    // gone upstream (inside the window) or from a calendar no longer selected
    const selectedIds = new Set(selected.map((c) => c.id));
    const stale = existing.filter((e) => {
      if (seen.has(e.externalId!)) return false;
      const calId = e.externalId!.split("|")[0]!;
      if (!selectedIds.has(calId)) return true;
      return e.endsAt > timeMin && e.startsAt < timeMax;
    });
    for (const s of stale) await purgePolymorphicRefs(tx, "event", s.id);
    if (stale.length) await tx.delete(events).where(inArray(events.id, stale.map((s) => s.id)));
    result.removed = stale.length;
  });

  const summary = `${selected.length} calendar${selected.length === 1 ? "" : "s"}: +${result.added} ~${result.updated} −${result.removed}`;
  logger.info({ accountId: row.id, ...result }, "calendar synced");
  return { result, summary };
}

/**
 * Gmail → Incoming: every message carrying the STOMP label becomes one inbox
 * item (kind=email), once. Removing the label later leaves the item alone;
 * dismissed items never come back (dedupe is on source_ref, any status).
 */
async function syncGmail(db: Db, row: AccountRow): Promise<{ result: SyncResult; summary: string }> {
  const token = await accessTokenFor(db, row);
  const labelId = await gmail.findLabelId(token);
  const prev = readSettings<GmailSettings>(row);
  if (labelId !== (prev.labelId ?? null)) await saveSettings(db, row, { ...prev, labelId });
  if (!labelId) {
    throw new Error(`No Gmail label named “${gmail.LABEL_NAME}” yet — create it in Gmail and add it to a message`);
  }

  const ids = await gmail.listLabelled(token, labelId);
  const refs = ids.map((id) => `gmail:${id}`);
  const have = refs.length
    ? new Set(
        (
          await db
            .select({ ref: incomingItems.sourceRef })
            .from(incomingItems)
            .where(and(eq(incomingItems.forUserId, row.userId), inArray(incomingItems.sourceRef, refs)))
        ).map((r) => r.ref),
      )
    : new Set<string | null>();
  const fresh = ids.filter((id) => !have.has(`gmail:${id}`));

  // fetch first — a Google error mid-way writes nothing
  const messages: gmail.InboundMessage[] = [];
  for (const id of fresh) messages.push(await gmail.getMessage(token, id));

  let added = 0;
  const stamp = clock.now();
  for (const m of messages) {
    const inserted = await db
      .insert(incomingItems)
      .values({
        id: newId(),
        workspaceId: null,
        title: m.subject || "(no subject)",
        body: m.snippet || null,
        kind: "email",
        status: "unread",
        forUserId: row.userId,
        createdBy: row.userId,
        sourceRef: `gmail:${m.providerId}`,
        sourceMeta: JSON.stringify({
          from: m.from,
          subject: m.subject,
          receivedAt: m.receivedAt,
          threadId: m.threadId,
          url: gmail.gmailWebUrl(row.email, m.providerId),
        }),
        createdAt: stamp,
      })
      .onConflictDoNothing() // a concurrent run got there first
      .returning({ id: incomingItems.id });
    added += inserted.length;
  }

  const summary = `label ${gmail.LABEL_NAME}: +${added} new, ${ids.length - fresh.length} already in Incoming`;
  logger.info({ accountId: row.id, added, seen: ids.length }, "gmail synced");
  return { result: { added, updated: 0, removed: 0 }, summary };
}

/** "Sync now" — the user's own account only. */
export async function syncNow(db: Db, ctx: Ctx, id: string): Promise<IntegrationAccount> {
  const row = await loadOwn(db, ctx, id);
  if (row.provider === "google_calendar") await refreshCalendarList(db, row).catch(() => undefined);
  await syncAccount(db, row);
  return toDto(await loadOwn(db, ctx, id));
}

/** Recent sync runs for one of the user's accounts, newest first. */
export async function listSyncLog(db: Db, ctx: Ctx, id: string, limit = 20): Promise<SyncLogEntry[]> {
  const row = await loadOwn(db, ctx, id);
  return db
    .select({
      id: syncLog.id,
      entityType: syncLog.entityType,
      summary: syncLog.summary,
      error: syncLog.error,
      startedAt: syncLog.startedAt,
      finishedAt: syncLog.finishedAt,
    })
    .from(syncLog)
    .where(eq(syncLog.integrationAccountId, row.id))
    .orderBy(desc(syncLog.startedAt))
    .limit(limit);
}

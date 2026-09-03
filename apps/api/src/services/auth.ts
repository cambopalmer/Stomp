import { randomBytes } from "node:crypto";
import type { AuthUser, SignupInput } from "@stomp/shared";
import { hash, verify } from "@node-rs/argon2";
import { and, eq, gt, lt } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { sessions, users } from "../db/schema.js";
import { clock } from "../lib/clock.js";
import { BadRequest, Conflict, Forbidden, NotFound } from "../lib/errors.js";
import { newId } from "../lib/ids.js";
import { logger } from "../lib/logger.js";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

type UserRow = typeof users.$inferSelect;

export function toAuthUser(u: UserRow): AuthUser {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    timezone: u.timezone,
    hasPassword: u.passwordHash != null,
    googleLinked: u.googleId != null,
    createdAt: u.createdAt,
  };
}

export async function hashPassword(pw: string): Promise<string> {
  return hash(pw);
}

async function userByEmail(db: Db, email: string): Promise<UserRow | undefined> {
  const [u] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  return u;
}

// ─────────────────────────────────────── sessions

export interface SessionMeta {
  userAgent?: string | null;
  ip?: string | null;
}

export async function createSession(db: Db, userId: string, meta: SessionMeta = {}): Promise<string> {
  const id = randomBytes(32).toString("base64url");
  const now = clock.now();
  await db.insert(sessions).values({
    id,
    userId,
    expiresAt: now + SESSION_TTL_MS,
    createdAt: now,
    lastSeenAt: now,
    userAgent: meta.userAgent ?? null,
    ip: meta.ip ?? null,
  });
  return id;
}

/** Look up a live session and its user; touch last_seen. Returns null if missing/expired. */
export async function resolveSession(db: Db, token: string): Promise<UserRow | null> {
  const now = clock.now();
  const [row] = await db
    .select({ user: users, sessionId: sessions.id })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, token), gt(sessions.expiresAt, now)))
    .limit(1);
  if (!row) return null;
  await db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, row.sessionId));
  return row.user;
}

export async function destroySession(db: Db, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, token));
}

/** Housekeeping — call occasionally (currently on each login). */
export async function pruneExpiredSessions(db: Db): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, clock.now()));
}

// ─────────────────────────────────────── password auth

export async function signup(
  db: Db,
  input: SignupInput,
  opts: { allowSignup: boolean },
): Promise<UserRow> {
  const existingUsers = await db.select({ id: users.id }).from(users).limit(1);
  const isFirstUser = existingUsers.length === 0;
  if (!opts.allowSignup && !isFirstUser) {
    throw Forbidden("Sign-ups are closed. Ask an existing member to invite you.");
  }
  if (await userByEmail(db, input.email)) throw Conflict("That email is already registered");

  const now = clock.now();
  const row: typeof users.$inferInsert = {
    id: newId(),
    email: input.email.toLowerCase(),
    displayName: input.displayName,
    passwordHash: await hashPassword(input.password),
    lastLoginAt: now,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(users).values(row);
  logger.info({ userId: row.id, email: row.email }, "user signed up");
  return { ...(row as UserRow), avatarUrl: null, timezone: "UTC", googleId: null } as UserRow;
}

// a real argon2id hash of a random string — verified against when no user exists,
// so "no such email" and "wrong password" take similar time.
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$lTkl0c58UECZtYUi28xnhg$5ESTQTQQHWZDNM6mXijucPQ+IoQG7I+hFMZlvpPg/qw";

export async function login(db: Db, email: string, password: string): Promise<UserRow> {
  const u = await userByEmail(db, email);
  const ok = await verify(u?.passwordHash ?? DUMMY_HASH, password).catch(() => false);
  if (!u || !u.passwordHash || !ok) {
    logger.warn({ email }, "failed login");
    throw BadRequest("Wrong email or password");
  }
  await db.update(users).set({ lastLoginAt: clock.now() }).where(eq(users.id, u.id));
  return u;
}

// ─────────────────────────────────────── google

/** Upsert a user from a verified Google profile; link by google_id then email. */
export async function upsertGoogleUser(
  db: Db,
  profile: { sub: string; email: string; name?: string; picture?: string },
): Promise<UserRow> {
  const byGoogle = (
    await db.select().from(users).where(eq(users.googleId, profile.sub)).limit(1)
  )[0];
  if (byGoogle) return byGoogle;

  const now = clock.now();
  const byEmail = await userByEmail(db, profile.email);
  if (byEmail) {
    await db
      .update(users)
      .set({ googleId: profile.sub, avatarUrl: byEmail.avatarUrl ?? profile.picture ?? null, lastLoginAt: now })
      .where(eq(users.id, byEmail.id));
    return { ...byEmail, googleId: profile.sub };
  }

  const row: typeof users.$inferInsert = {
    id: newId(),
    email: profile.email.toLowerCase(),
    displayName: profile.name?.trim() || profile.email.split("@")[0]!,
    googleId: profile.sub,
    avatarUrl: profile.picture ?? null,
    lastLoginAt: now,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(users).values(row);
  logger.info({ userId: row.id, email: row.email }, "user created via Google");
  return { ...(row as UserRow), passwordHash: null, timezone: "UTC" } as UserRow;
}

export { NotFound };

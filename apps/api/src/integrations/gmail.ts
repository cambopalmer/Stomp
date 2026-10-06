import { googleGet } from "../lib/google.js";

/**
 * Gmail adapter — read-only (ADR-0005). Only messages carrying the user's
 * `STOMP` label are pulled; we read headers + Gmail's snippet, never bodies.
 */

const API = "https://gmail.googleapis.com/gmail/v1/users/me";
export const LABEL_NAME = "STOMP";
/** Newest-first cap per run; the label is a curated set, so this is generous. */
export const MAX_PER_RUN = 100;

/** Gmail label names are case-sensitive in the UI; match exactly. */
export async function findLabelId(accessToken: string): Promise<string | null> {
  const res = await googleGet<{ labels?: { id: string; name: string }[] }>(`${API}/labels`, accessToken);
  return res.labels?.find((l) => l.name === LABEL_NAME)?.id ?? null;
}

export async function listLabelled(accessToken: string, labelId: string): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const q = new URLSearchParams({
      labelIds: labelId,
      maxResults: String(Math.min(100, MAX_PER_RUN - ids.length)),
      ...(pageToken ? { pageToken } : {}),
    });
    const page = await googleGet<{ messages?: { id: string }[]; nextPageToken?: string }>(
      `${API}/messages?${q}`,
      accessToken,
    );
    ids.push(...(page.messages ?? []).map((m) => m.id));
    pageToken = page.nextPageToken;
  } while (pageToken && ids.length < MAX_PER_RUN);
  return ids;
}

export interface InboundMessage {
  providerId: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  receivedAt: number;
}

interface GMessage {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  payload?: { headers?: { name: string; value: string }[] };
}

/** Gmail HTML-escapes snippets (&#39; &amp; …) — undo the common entities. */
const unescape = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

export async function getMessage(accessToken: string, id: string): Promise<InboundMessage> {
  const q = new URLSearchParams({ format: "metadata" });
  for (const h of ["From", "Subject"]) q.append("metadataHeaders", h);
  const m = await googleGet<GMessage>(`${API}/messages/${encodeURIComponent(id)}?${q}`, accessToken);
  const header = (name: string) =>
    m.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
  return {
    providerId: m.id,
    threadId: m.threadId,
    from: header("From"),
    subject: header("Subject").trim(),
    snippet: unescape(m.snippet ?? "").trim(),
    receivedAt: Number(m.internalDate ?? Date.now()),
  };
}

/** Opens the message in Gmail web, in the right account when several are signed in. */
export const gmailWebUrl = (accountEmail: string, messageId: string) =>
  `https://mail.google.com/mail/?authuser=${encodeURIComponent(accountEmail)}#all/${messageId}`;

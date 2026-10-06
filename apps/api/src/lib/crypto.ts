import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { config } from "../config.js";

/**
 * AES-256-GCM sealing for secrets at rest (OAuth tokens). Format:
 * `v1.<iv>.<tag>.<ciphertext>`, each part base64url. The version prefix leaves
 * room to rotate keys / algorithms later without guessing at old rows.
 */
const VERSION = "v1";

function key(): Buffer {
  if (!config.INTEGRATION_ENC_KEY) throw new Error("INTEGRATION_ENC_KEY is not set");
  return Buffer.from(config.INTEGRATION_ENC_KEY, "base64");
}

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), ct].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

export function unseal(sealed: string): string {
  const [v, iv, tag, ct] = sealed.split(".");
  if (v !== VERSION || !iv || !tag || ct === undefined) throw new Error("Unrecognized sealed value");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}

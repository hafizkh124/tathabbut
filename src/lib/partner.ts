// A partner service that calls our API from its own server on behalf of many people (Ateed, for WhatsApp). Without this every
// person it serves would look like one client (its server's address) and share one person's limits. A signed request names
// the person by a hash (never a phone number), and the rate limits then count that person alone.
//
// The request carries three headers and no secret:
//   x-partner-id   the person, as 16 to 64 hex characters (the partner hashes the phone number with its own salt)
//   x-partner-ts   the time, in Unix seconds
//   x-partner-sig  hex HMAC-SHA256 of `${ts}.${id}.${METHOD}.${path}` with TATHABBUT_PARTNER_SECRET
// A request older or newer than 5 minutes is refused, so a copy of the headers cannot be used later. A bad or missing
// signature, or no secret on the server, is not an error: the request is then counted as an ordinary client (by address),
// so nothing that worked before stops working.
import { createHmac, timingSafeEqual } from "node:crypto";

export const PARTNER_ID_HEADER = "x-partner-id";
export const PARTNER_TS_HEADER = "x-partner-ts";
export const PARTNER_SIG_HEADER = "x-partner-sig";

/** A secret shorter than this is treated as not set. */
export const MIN_PARTNER_SECRET = 32;
export const MAX_SKEW_SECONDS = 300;

export const partnerSecret = (): string | null => {
  const s = process.env.TATHABBUT_PARTNER_SECRET?.trim();
  return s && s.length >= MIN_PARTNER_SECRET ? s : null;
};

/** The signature a partner puts in x-partner-sig. */
export function signPartner(secret: string, ts: number | string, id: string, method: string, path: string): string {
  return createHmac("sha256", secret).update(`${ts}.${id}.${method.toUpperCase()}.${path}`).digest("hex");
}

/** The person the signed request speaks for, or null when it is not a valid partner request. */
export function partnerPerson(request: Request, secret: string | null = partnerSecret(), nowMs = Date.now()): string | null {
  if (!secret) return null;
  const id = request.headers.get(PARTNER_ID_HEADER) ?? "";
  const ts = request.headers.get(PARTNER_TS_HEADER) ?? "";
  const sig = request.headers.get(PARTNER_SIG_HEADER) ?? "";
  if (!/^[0-9a-f]{16,64}$/.test(id) || !/^\d{9,12}$/.test(ts) || !/^[0-9a-f]{64}$/.test(sig)) return null;
  if (Math.abs(nowMs / 1000 - Number(ts)) > MAX_SKEW_SECONDS) return null;
  let path: string;
  try {
    path = new URL(request.url).pathname;
  } catch {
    return null;
  }
  const want = Buffer.from(signPartner(secret, ts, id, request.method, path), "hex");
  const got = Buffer.from(sig, "hex");
  return got.length === want.length && timingSafeEqual(got, want) ? id : null;
}

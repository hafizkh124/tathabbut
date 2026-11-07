// The token that opens the admin pages (the specialist's review of reports). One secret in Vercel (ADMIN_TOKEN), sent as
// «Authorization: Bearer <token>». Without ADMIN_TOKEN set the admin API is closed to everyone. There is no account system.
import { timingSafeEqual } from "node:crypto";

/** Shorter than this is too easy to guess, so it is treated as not set. */
export const MIN_TOKEN_LENGTH = 24;

export function tokenMatches(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < MIN_TOKEN_LENGTH) return false;
  const given = Buffer.from(header ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

export function isAdmin(request: Request): boolean {
  return tokenMatches(request.headers.get("authorization"), process.env.ADMIN_TOKEN);
}

/** A wrong guess a few times a minute from one address is a person's typo; more is a loop. Memory of this instance only. */
const failures = new Map<string, number[]>();
const MAX_FAILS_PER_MINUTE = 8;

export function tooManyFailures(ip: string, now = Date.now()): boolean {
  return (failures.get(ip) ?? []).filter((at) => now - at < 60_000).length >= MAX_FAILS_PER_MINUTE;
}

export function noteFailure(ip: string, now = Date.now()): void {
  const recent = (failures.get(ip) ?? []).filter((at) => now - at < 60_000);
  recent.push(now);
  failures.set(ip, recent);
  if (failures.size > 1_000) failures.clear();
}

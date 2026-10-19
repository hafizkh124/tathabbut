// How often one client, and the whole site, may call the routes that cost an AI request (verify, ocr, translate, origin).
// The counts live in Supabase (migration 011, take_rate_limit), so every server instance sees the same numbers. A client is
// a keyed hash of its address: the address itself is never stored. When the database cannot be reached the check falls back
// to this instance's memory (per-minute only), so an outage of the counter never stops the checks.
import { createHash } from "node:crypto";
import { isEvalRun } from "./evalRun";
import { GeminiError } from "./gemini";
import { rpc, serviceConfig, type RestConfig } from "./supabaseRest";
import { signingKey } from "./turathSign";

export type Bucket = "verify" | "ocr" | "translate" | "origin" | "alulama" | "fast" | "alternative";

/**
 * Per client. The AI runs on Gemini's free tier, whose daily quota the whole site shares, so one client must not be able
 * to spend it: the day's limit is what a busy person might really check, yet small enough that a script cannot empty the
 * quota. Many phones in Pakistan share one public address (carrier NAT), so the minute's limit is not too tight.
 * A text checked before is answered from the cache (src/lib/sharedClaims.ts) and does not count.
 */
export const RULES: Record<Bucket, { perMinute: number; perDay: number }> = {
  verify: { perMinute: 8, perDay: 100 },
  ocr: { perMinute: 4, perDay: 30 },
  translate: { perMinute: 10, perDay: 150 },
  origin: { perMinute: 2, perDay: 5 }, // the search runs on the 2.5 models only: about 40 a day for the whole site
  alternative: { perMinute: 3, perDay: 25 }, // two small calls on the light models (GEMINI_LIGHT_MODELS), only when a soft reply is opened
  fast: { perMinute: 30, perDay: 400 }, // the answer without the AI (src/lib/fastPath.ts): the specialist's list, the mushaf and Dorar only
  alulama: { perMinute: 30, perDay: 600 }, // no AI: a search of our own table, so it never counts against the site's AI limit
};

/** The buckets that cost no AI request: the site's daily AI limit does not count them. */
const NO_AI: ReadonlySet<Bucket> = new Set<Bucket>(["alulama", "fast"]);

/** All AI calls of the whole site in one UTC day. Off by default (0): on the free tier Gemini itself stops at its quota
 *  and nothing is billed. Set DAILY_AI_LIMIT if the key ever has billing on, so the bill has a ceiling. */
export const dailyAiLimit = (): number => {
  const v = Number(process.env.DAILY_AI_LIMIT);
  return Number.isFinite(v) && process.env.DAILY_AI_LIMIT?.trim() ? Math.max(0, Math.floor(v)) : 0;
};

const MINUTE = 60;
const DAY = 86_400;

export type RateLimitResult = { ok: true } | { ok: false; scope: "client" | "site"; retryAfter: number };

/** The client's address as Vercel passes it (the first address of x-forwarded-for, or x-real-ip). */
export function clientAddress(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || "unknown";
}

/** A keyed hash of the address: the same client gives the same key, but the key does not give back the address. */
export function clientKey(address: string, secret: string | null = signingKey()): string {
  return createHash("sha256").update(`${secret ?? "tathabbut"}:${address}`).digest("hex").slice(0, 32);
}

/** The rules for one request, in the order they are counted: the client's minute, the client's day, the site's day. */
export function rulesFor(bucket: Bucket, client: string, siteLimit = dailyAiLimit()) {
  const r = RULES[bucket];
  const rules: Array<{ key: string; window: number; limit: number; scope: "client" | "site" }> = [
    { key: `${bucket}:min:${client}`, window: MINUTE, limit: r.perMinute, scope: "client" },
    { key: `${bucket}:day:${client}`, window: DAY, limit: r.perDay, scope: "client" },
  ];
  if (siteLimit > 0 && !NO_AI.has(bucket)) rules.push({ key: "ai:day:all", window: DAY, limit: siteLimit, scope: "site" });
  return rules;
}

/** Seconds until the window that refused the request closes. */
export const secondsLeft = (window: number, nowMs = Date.now()) => Math.max(1, window - (Math.floor(nowMs / 1000) % window));

// fallback when the database cannot be reached: this instance's memory, the client's minute only
const recent = new Map<string, number[]>();
export function memoryCheck(key: string, limit: number, nowMs = Date.now()): boolean {
  const times = (recent.get(key) ?? []).filter((at) => nowMs - at < MINUTE * 1000);
  if (times.length >= limit) {
    recent.set(key, times);
    return false;
  }
  times.push(nowMs);
  recent.set(key, times);
  if (recent.size > 5_000) recent.clear();
  return true;
}

export async function checkRateLimit(
  request: Request,
  bucket: Bucket,
  deps: { cfg?: RestConfig | null; call?: typeof rpc } = {},
): Promise<RateLimitResult> {
  const rules = rulesFor(bucket, clientKey(clientAddress(request.headers)));
  const cfg = deps.cfg === undefined ? serviceConfig() : deps.cfg;
  const call = deps.call ?? rpc;
  try {
    const refused = await call<number>(cfg, "take_rate_limit", { p_keys: rules.map((r) => r.key), p_windows: rules.map((r) => r.window), p_limits: rules.map((r) => r.limit) }, 2_000);
    if (!refused) return { ok: true };
    const rule = rules[refused - 1];
    return rule ? { ok: false, scope: rule.scope, retryAfter: secondsLeft(rule.window) } : { ok: true };
  } catch {
    return memoryCheck(rules[0].key, rules[0].limit) ? { ok: true } : { ok: false, scope: "client", retryAfter: secondsLeft(MINUTE) };
  }
}

/** The 429 answer: the client's own limit, or the site's daily budget, and when to try again. */
export function tooManyResponse(r: Extract<RateLimitResult, { ok: false }>): Response {
  return Response.json(
    { error: r.scope === "site" ? "the daily limit of checks is reached, try again later" : "too many requests, try again shortly", limit: r.scope, retryAfter: r.retryAfter },
    { status: 429, headers: { "Retry-After": String(r.retryAfter) } },
  );
}

/** Checks the limit and gives the 429 to send, or null to go on. */
export async function limited(request: Request, bucket: Bucket): Promise<Response | null> {
  if (isEvalRun()) return null;
  const r = await checkRateLimit(request, bucket);
  return r.ok ? null : tooManyResponse(r);
}

/** When the AI itself is out of free quota (src/lib/gemini.ts): the 429 that tells the page to try in a minute, or
 *  tomorrow. Null for any other failure. */
export function aiQuotaResponse(err: unknown): Response | null {
  if (!(err instanceof GeminiError) || !err.quota) return null;
  const retryAfter = err.quota === "minute" ? (err.retryAfter ?? 60) : 3_600;
  return Response.json(
    { error: err.quota === "day" ? "the free AI quota for today is used up, try tomorrow" : "the AI is busy, try again in a minute", limit: `ai-${err.quota}`, retryAfter },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

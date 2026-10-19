// Links to a result (/r/<id>): /api/verify stores each result it returns, and the link opens that same result. Only the
// server writes them (table shared_claims, migration 011), so a link on our address always shows what the sources said;
// nothing a reader sends is ever stored as a result. The id is a keyed hash of the stored result: the same result gets the
// same link (a viral text is stored once), and ids cannot be guessed or walked.
import { createHash, createHmac } from "node:crypto";
import type { ClaimResult } from "./clientTypes";
import { isEvalRun } from "./evalRun";
import { restHeaders, serviceConfig, type RestConfig } from "./supabaseRest";
import { signingKey } from "./turathSign";

/** Narrations kept with a stored result: the first ones are the ones the card shows; the rest stay a click away on Dorar.
 *  Few, so the results fit Supabase's free 500 MB for a long time. */
const KEEP_NARRATIONS = 5;
const KEEP_WEAK_VARIANTS = 3;
export const SHARE_ID = /^[0-9A-Za-z]{12}$/;
/** At most this many results in one link («/r/<id>-<id>-…»). */
export const MAX_IDS = 10;

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** A personal fiqh question is the reader's own case: it gets no link and is never stored. */
export const isPersonal = (c: Pick<ClaimResult, "claim">) => c.claim.kind === "question" && c.claim.scope !== "general";

/** The result as it is stored: as /api/verify returned it, with fewer narrations, and never the books' answer (asked
 *  later by the page, and asked again by the shared page). Null for what is not stored. */
export function storedClaim(c: ClaimResult): ClaimResult | null {
  if (isPersonal(c)) return null;
  const rest = { ...c };
  delete rest.turath;
  delete rest.shareId;
  return {
    ...rest,
    dorar: rest.dorar && {
      ...rest.dorar,
      narrations: rest.dorar.narrations.slice(0, KEEP_NARRATIONS),
      weakVariants: rest.dorar.weakVariants?.slice(0, KEEP_WEAK_VARIANTS),
    },
  };
}

/** 12 characters of base62 from a keyed hash of the stored JSON; undefined when the server has no key. */
export function shareIdOf(json: string, key: string | null = signingKey()): string | undefined {
  if (!key) return undefined;
  const digest = createHmac("sha256", key).update(`share:${json}`, "utf8").digest();
  let id = "";
  for (let i = 0; i < 12; i++) id += BASE62[digest[i] % 62];
  return id;
}

/** Each result with its link id (none for a personal question), and the rows to store for them. */
export function withShareIds(claims: ClaimResult[], key: string | null = signingKey()): { claims: ClaimResult[]; rows: Array<{ id: string; claim: ClaimResult }> } {
  const rows: Array<{ id: string; claim: ClaimResult }> = [];
  const out = claims.map((c) => {
    const stored = storedClaim(c);
    const id = stored && shareIdOf(JSON.stringify(stored), key);
    if (!stored || !id) return c;
    rows.push({ id, claim: { ...stored, shareId: id } });
    return { ...c, shareId: id };
  });
  return { claims: out, rows };
}

/** Stores the rows; a result stored before is left as it is. Failures are swallowed: the check itself has been answered. */
export async function saveSharedClaims(rows: Array<{ id: string; claim: ClaimResult }>, cfg: RestConfig | null = serviceConfig()): Promise<void> {
  if (!cfg || rows.length === 0 || isEvalRun()) return;
  try {
    await fetch(`${cfg.url}/rest/v1/shared_claims?on_conflict=id`, {
      method: "POST",
      headers: { ...restHeaders(cfg.key), Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify(rows),
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
  } catch {
    /* the link will say the result was not found; the check was still answered */
  }
}

/** The ids of a link path («abc…-def…»): only well-formed ids, each once, at most MAX_IDS. */
export function parseShareIds(path: string): string[] {
  const ids = decodeURIComponent(path).split("-").filter((id) => SHARE_ID.test(id));
  return [...new Set(ids)].slice(0, MAX_IDS);
}

/** The results of a link, in the link's order; the ones not found are left out. */
export async function loadSharedClaims(ids: string[], cfg: RestConfig | null = serviceConfig()): Promise<ClaimResult[]> {
  if (!cfg || ids.length === 0) return [];
  const res = await fetch(`${cfg.url}/rest/v1/shared_claims?select=id,claim&id=in.(${ids.join(",")})`, {
    headers: restHeaders(cfg.key),
    signal: AbortSignal.timeout(5_000),
    next: { revalidate: 86_400 }, // a stored result never changes
  });
  if (!res.ok) throw new Error(`shared_claims: HTTP ${res.status}`);
  const rows = (await res.json()) as Array<{ id: string; claim: ClaimResult }>;
  const byId = new Map(rows.map((r) => [r.id, r.claim]));
  return ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
}

// ── Answers by text (table verify_cache): a post checked before is answered from its stored results, with no AI call ──

/** How long a cached answer is used before the post is checked afresh. */
const CACHE_DAYS = 30;

/** Raised when the way a post is read changes (the prompt, the checks), so an answer made the old way is not served again. */
const PIPELINE = "3";

/** The cache key of a post: the same words, whatever the spacing, give the same key. The post itself is not kept. */
export function postKey(post: string): string {
  return createHash("sha256").update(`${PIPELINE}\n${post.trim().replace(/\s+/g, " ")}`, "utf8").digest("hex");
}

/** The stored results of a post checked before, or null (never checked, too old, a result missing, or the cache down). */
export async function cachedAnswer(key: string, cfg: RestConfig | null = serviceConfig(), nowMs = Date.now()): Promise<ClaimResult[] | null> {
  if (!cfg || isEvalRun()) return null;
  try {
    const since = new Date(nowMs - CACHE_DAYS * 86_400_000).toISOString();
    const res = await fetch(`${cfg.url}/rest/v1/verify_cache?select=ids&key=eq.${key}&created_at=gte.${since}`, {
      headers: restHeaders(cfg.key),
      signal: AbortSignal.timeout(2_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const ids = ((await res.json()) as Array<{ ids: string[] }>)[0]?.ids;
    if (!ids?.length) return null;
    const claims = await loadSharedClaims(ids, cfg);
    return claims.length === ids.length ? claims : null;
  } catch {
    return null;
  }
}

/** Remembers which results answer this post. Only a post whose every result has a link: one with a personal question is
 *  not cached, so it is never stored. A post with no claims at all is not cached either (the AI may have stumbled). */
export async function saveAnswer(key: string, claims: ClaimResult[], cfg: RestConfig | null = serviceConfig()): Promise<void> {
  const ids = claims.map((c) => c.shareId);
  if (!cfg || ids.length === 0 || !ids.every(Boolean) || isEvalRun()) return;
  try {
    await fetch(`${cfg.url}/rest/v1/verify_cache?on_conflict=key`, {
      method: "POST",
      headers: { ...restHeaders(cfg.key), Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ key, ids, created_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
  } catch {
    /* next time the post is checked afresh */
  }
}

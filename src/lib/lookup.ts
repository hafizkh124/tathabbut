// Dorar lookup with a cache in front: a fresh cached answer is used as is; otherwise Dorar is asked and the good
// answer is remembered; if Dorar cannot be reached, an older cached answer is better than none (and says so).
import { normalizeArabic } from "./arabic";
import { searchDorar, type DorarLookup, type DorarResult } from "./dorar";
import type { DorarCache } from "./dorarCache";

/** Dorar's verdicts change rarely; a month-old answer is still the muhaddith's word. */
export const FRESH_MS = 30 * 24 * 3_600_000;

export type LookupOutcome =
  | { ok: true; results: DorarResult[]; origin: "cache" | "live" | "stale-cache"; fetchedAt?: string }
  | { ok: false; error: string; detail?: string };

export async function lookupDorar(
  query: string,
  deps: { cache: DorarCache; search?: (q: string) => Promise<DorarLookup>; now?: () => number },
): Promise<LookupOutcome> {
  const { cache, search = searchDorar, now = Date.now } = deps;
  const key = normalizeArabic(query);

  const cached = key ? await cache.get(key) : null;
  if (cached && now() - cached.fetchedAt.getTime() < FRESH_MS) {
    return { ok: true, results: cached.results, origin: "cache", fetchedAt: cached.fetchedAt.toISOString() };
  }

  const live = await search(query);
  if (live.ok) {
    if (key) await cache.put(key, live.results);
    return { ok: true, results: live.results, origin: "live" };
  }
  // Dorar answered "nothing found": that is an answer, not a failure, and an old cache would only be misleading.
  if (live.error === "empty") return { ok: true, results: [], origin: "live" };
  if (cached) return { ok: true, results: cached.results, origin: "stale-cache", fetchedAt: cached.fetchedAt.toISOString() };
  return { ok: false, error: live.error, detail: live.detail };
}

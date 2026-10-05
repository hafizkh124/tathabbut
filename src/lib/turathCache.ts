// Reads and writes turath_cache and turath_translations (private: row level security gives the public key no access, so this is
// server-only and uses the service key). Like dorarCache.ts, a cache problem must never break a lookup: every function swallows
// its own errors and says "nothing cached" / "not saved". If the tables do not exist yet (migration 006) it simply never hits.
import { createHash } from "node:crypto";
import { normalizeArabic } from "./arabic";
import type { TurathLookupOutcome } from "./hadithMatch";
import { restHeaders, serviceConfig, type RestConfig } from "./supabaseRest";
import type { TurathLookupKind } from "./turathScope";

/** A cached answer older than this is ignored (specialist, 2026-10-05: 30 days). */
export const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface TurathCache {
  get(kind: TurathLookupKind, query: string): Promise<TurathLookupOutcome | null>;
  put(kind: TurathLookupKind, query: string, outcome: TurathLookupOutcome): Promise<void>;
}

export interface TranslationCache {
  get(text: string, lang: string): Promise<string | null>;
  put(text: string, lang: string, translation: string, model?: string): Promise<void>;
}

/** What is asked, in one spelling: the same hadith typed with or without diacritics hits the same row. */
export const cacheKey = (query: string) => normalizeArabic(query).replace(/\s+/g, " ").trim();
export const textHash = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

/** Only a successful and complete answer is worth remembering: an outage or a partial answer must not be served again. */
export const isCacheable = (o: TurathLookupOutcome) => o.status === "success" && !o.partial;

function rest(cfg: RestConfig | null, timeoutMs: number) {
  return async (path: string, init: RequestInit) => {
    if (!cfg) throw new Error("cache not configured");
    return fetch(`${cfg.url.replace(/\/+$/, "")}/rest/v1/${path}`, { ...init, headers: { ...restHeaders(cfg.key), ...init.headers }, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  };
}

export function supabaseTurathCache(cfg: RestConfig | null = serviceConfig(), timeoutMs = 3_000, now: () => number = Date.now): TurathCache {
  const call = rest(cfg, timeoutMs);
  return {
    async get(kind, query) {
      const key = cacheKey(query);
      if (!key) return null;
      try {
        const since = new Date(now() - CACHE_TTL_MS).toISOString();
        const res = await call(`turath_cache?select=result&query_key=eq.${encodeURIComponent(key)}&kind=eq.${kind}&fetched_at=gte.${encodeURIComponent(since)}&limit=1`, {});
        if (!res.ok) return null;
        const rows = (await res.json()) as { result: TurathLookupOutcome }[];
        const hit = rows[0]?.result;
        return hit && isCacheable(hit) ? hit : null;
      } catch {
        return null;
      }
    },
    async put(kind, query, outcome) {
      const key = cacheKey(query);
      if (!key || !isCacheable(outcome)) return;
      try {
        await call("turath_cache?on_conflict=query_key,kind", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({ query_key: key, kind, result: outcome, fetched_at: new Date(now()).toISOString() }),
        });
      } catch {
        /* the answer was already obtained; failing to remember it is not the user's problem */
      }
    },
  };
}

/** A lookup that asks the cache first and remembers a complete, successful answer. The cache is a help, never a need. */
export function withCache(lookup: (query: string, kind: TurathLookupKind) => Promise<TurathLookupOutcome>, cache: TurathCache) {
  return async (query: string, kind: TurathLookupKind): Promise<TurathLookupOutcome> => {
    const hit = await cache.get(kind, query);
    if (hit) return hit;
    const outcome = await lookup(query, kind);
    await cache.put(kind, query, outcome);
    return outcome;
  };
}

export function supabaseTranslationCache(cfg: RestConfig | null = serviceConfig(), timeoutMs = 3_000): TranslationCache {
  const call = rest(cfg, timeoutMs);
  return {
    async get(text, lang) {
      try {
        const res = await call(`turath_translations?select=translation&text_hash=eq.${textHash(text)}&lang=eq.${encodeURIComponent(lang)}&limit=1`, {});
        if (!res.ok) return null;
        const rows = (await res.json()) as { translation: string }[];
        return rows[0]?.translation || null;
      } catch {
        return null;
      }
    },
    async put(text, lang, translation, model) {
      try {
        await call("turath_translations?on_conflict=text_hash,lang", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({ text_hash: textHash(text), lang, translation, model: model ?? null, fetched_at: new Date().toISOString() }),
        });
      } catch {
        /* see above */
      }
    },
  };
}

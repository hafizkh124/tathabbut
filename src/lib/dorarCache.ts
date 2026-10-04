// Reads and writes the dorar_cache table (private: row level security gives the public key no access, so this is
// server-only and uses the service key). A cache problem must never break a lookup, so every function here
// swallows its own errors and says "nothing cached" / "not saved" instead.
import type { DorarResult } from "./dorar";
import { restHeaders, serviceConfig, type RestConfig } from "./supabaseRest";

export interface CachedAnswer {
  results: DorarResult[];
  fetchedAt: Date;
}

export interface DorarCache {
  get(queryClean: string): Promise<CachedAnswer | null>;
  put(queryClean: string, results: DorarResult[]): Promise<void>;
}

export function supabaseDorarCache(cfg: RestConfig | null = serviceConfig(), timeoutMs = 4_000): DorarCache {
  const call = async (path: string, init: RequestInit) => {
    if (!cfg) throw new Error("cache not configured");
    return fetch(`${cfg.url.replace(/\/+$/, "")}/rest/v1/${path}`, { ...init, headers: { ...restHeaders(cfg.key), ...init.headers }, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  };
  return {
    async get(queryClean) {
      try {
        const res = await call(`dorar_cache?select=results,fetched_at&query_clean=eq.${encodeURIComponent(queryClean)}&limit=1`, {});
        if (!res.ok) return null;
        const rows = (await res.json()) as { results: DorarResult[]; fetched_at: string }[];
        return rows[0] ? { results: rows[0].results, fetchedAt: new Date(rows[0].fetched_at) } : null;
      } catch {
        return null;
      }
    },
    async put(queryClean, results) {
      try {
        await call("dorar_cache?on_conflict=query_clean", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({ query_clean: queryClean, results, fetched_at: new Date().toISOString() }),
        });
      } catch {
        /* the answer was already obtained; failing to remember it is not the user's problem */
      }
    },
  };
}

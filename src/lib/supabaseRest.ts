// Minimal Supabase REST (PostgREST) access for server code, without pulling in a client library.
// Keys: the newer "sb_secret_…" keys are not JWTs and must go in `apikey` alone; the older JWT service_role key also needs Bearer.

export function restHeaders(key: string): Record<string, string> {
  return {
    apikey: key,
    ...(key.startsWith("sb_") ? {} : { Authorization: `Bearer ${key}` }),
    "Content-Type": "application/json",
  };
}

export interface RestConfig {
  url: string;
  key: string;
}

/** Read-only config with the public key (enough for tables and functions that are open to read). */
export function publicConfig(): RestConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}

/** Calls a database function through PostgREST (/rpc). */
export async function rpc<T>(cfg: RestConfig | null, fn: string, args: object, timeoutMs = 5_000): Promise<T> {
  if (!cfg) throw new Error("Supabase is not configured");
  const res = await fetch(`${cfg.url.replace(/\/+$/, "")}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: restHeaders(cfg.key),
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${fn}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

/** Server-only config from the environment (never use NEXT_PUBLIC_* for the secret key). Null when not set. */
export function serviceConfig(): RestConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}

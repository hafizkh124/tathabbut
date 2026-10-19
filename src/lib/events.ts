// Usage analytics on the server: one row per event in our own table (migration 012). The browser's device id, how the
// page was opened and its language come from the page (src/lib/analytics.ts), as headers on the API calls or in the body
// of /api/event; the country, region and city come from Vercel's geo headers. Writing never holds up an answer.
import { isEvalRun } from "./evalRun";
import { restHeaders, serviceConfig, type RestConfig } from "./supabaseRest";

/** What the page may report itself; checks and pictures are logged by their own routes. */
export const CLIENT_EVENTS = new Set(["visit", "share", "copy", "install_prompt", "installed"]);

export interface EventRow {
  device: string | null;
  event: string;
  source: string | null;
  locale: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  referrer: string | null;
  data: Record<string, unknown> | null;
}

const clip = (v: unknown, n: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);
const geo = (headers: Headers, name: string, n: number): string | null => {
  const v = headers.get(name);
  if (!v) return null;
  try {
    return clip(decodeURIComponent(v), n);
  } catch {
    return clip(v, n);
  }
};

/** The page's own details, sent with every API call so the server can log the check against the device. */
export const DEVICE_HEADER = "x-tathabbut-device";
export const SOURCE_HEADER = "x-tathabbut-source";
export const LOCALE_HEADER = "x-tathabbut-locale";

/** One row: the page's details (from the body, else from the headers), the request's geo headers, and the event's data. */
export function eventRow(request: Request, event: string, data: Record<string, unknown> | null, page: { device?: unknown; source?: unknown; locale?: unknown; referrer?: unknown } = {}): EventRow {
  const h = request.headers;
  return {
    device: clip(page.device ?? h.get(DEVICE_HEADER), 64),
    event,
    source: clip(page.source ?? h.get(SOURCE_HEADER), 32),
    locale: clip(page.locale ?? h.get(LOCALE_HEADER), 8),
    country: geo(h, "x-vercel-ip-country", 8),
    region: geo(h, "x-vercel-ip-country-region", 64),
    city: geo(h, "x-vercel-ip-city", 64),
    referrer: clip(page.referrer, 300),
    data,
  };
}

/** Stores the row; a failure is dropped (a lost count is better than a slow or failed check). */
export async function logEvent(row: EventRow, cfg: RestConfig | null = serviceConfig()): Promise<void> {
  if (!cfg || isEvalRun()) return;
  try {
    await fetch(`${cfg.url}/rest/v1/events`, {
      method: "POST",
      headers: { ...restHeaders(cfg.key), Prefer: "return=minimal" },
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
  } catch {
    /* not migrated yet, or the database is busy */
  }
}

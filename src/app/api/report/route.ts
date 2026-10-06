// POST /api/report  { "text": "<the claim>", "query": "<what the books were asked>", "state": "<result shown>", "locale": "ar" | "en" | "ur" }
//   →  { "ok": true }
// «Is this result wrong?»: the report is stored for the team (table reports, migration 009). Nothing about the reader is kept.
import { restHeaders, serviceConfig } from "@/lib/supabaseRest";

export const dynamic = "force-dynamic";

const MAX_TEXT = 5_000;
const MAX_QUERY = 1_000;
const LOCALES = new Set(["ar", "en", "ur"]);
/** A few reports a minute from one address is plenty; this instance's memory only, enough to stop a loop. */
const PER_MINUTE = 5;
const recent = new Map<string, number[]>();

function tooMany(ip: string): boolean {
  const now = Date.now();
  const times = (recent.get(ip) ?? []).filter((at) => now - at < 60_000);
  times.push(now);
  recent.set(ip, times);
  if (recent.size > 1_000) recent.clear();
  return times.length > PER_MINUTE;
}

export async function POST(request: Request) {
  let body: { text?: unknown; query?: unknown; state?: unknown; locale?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON: { text, query, state, locale }" }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const query = typeof body.query === "string" ? body.query.trim().slice(0, MAX_QUERY) : null;
  const state = typeof body.state === "string" ? body.state.trim() : "";
  const locale = typeof body.locale === "string" ? body.locale : "";
  if (!text || text.length > MAX_TEXT) return Response.json({ error: "text must be 1 to 5000 characters" }, { status: 400 });
  if (!state || state.length > 64) return Response.json({ error: "state is required" }, { status: 400 });
  if (!LOCALES.has(locale)) return Response.json({ error: 'locale must be "ar", "en" or "ur"' }, { status: 400 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (tooMany(ip)) return Response.json({ error: "too many reports, try again in a minute" }, { status: 429 });

  const cfg = serviceConfig();
  if (!cfg) return Response.json({ error: "reports are not available" }, { status: 503 });
  try {
    const res = await fetch(`${cfg.url}/rest/v1/reports`, {
      method: "POST",
      headers: { ...restHeaders(cfg.key), Prefer: "return=minimal" },
      body: JSON.stringify({ text, query: query || null, state, locale }),
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(String(res.status));
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "could not save the report" }, { status: 502 });
  }
}

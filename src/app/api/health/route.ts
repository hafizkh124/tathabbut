// GET /api/health — one cheap read from Supabase. Vercel calls it daily (vercel.json "crons") so the free-tier
// project is never paused for inactivity while the judges review; it also tells us whether the database answers.
import { publicConfig, restHeaders } from "@/lib/supabaseRest";

export const dynamic = "force-dynamic";

export async function GET() {
  const cfg = publicConfig();
  if (!cfg) return Response.json({ ok: false, error: "not configured" }, { status: 503 });
  try {
    const res = await fetch(`${cfg.url}/rest/v1/data_sources?select=id&limit=1`, {
      headers: restHeaders(cfg.key),
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    return Response.json({ ok: res.ok }, { status: res.ok ? 200 : 502, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}

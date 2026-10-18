// GET /api/health — one cheap read from Supabase. Vercel calls it daily (vercel.json "crons") so the free-tier
// project is never paused for inactivity; it also tells us whether the database answers, and clears rows past their time
// (purge_old_rows, migration 012) so the free 500 MB lasts.
import { publicConfig, restHeaders, rpc, serviceConfig } from "@/lib/supabaseRest";

export const dynamic = "force-dynamic";

/** GET /api/health?models=1: the Gemini and Gemma models this key may call, by their API names, so the fallback lists
 *  (GEMINI_FALLBACK_MODELS, GEMINI_ORIGIN_MODELS) can be checked against what really exists. Names only, never the key. */
async function listModels(): Promise<Response> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: "not configured" }, { status: 503 });
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", { headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(10_000), cache: "no-store" });
    if (!res.ok) return Response.json({ error: `HTTP ${res.status}` }, { status: 502 });
    const { models = [] } = (await res.json()) as { models?: Array<{ name: string; supportedGenerationMethods?: string[] }> };
    const names = models.filter((m) => m.supportedGenerationMethods?.includes("generateContent")).map((m) => m.name.replace(/^models\//, ""));
    return Response.json({ models: names.filter((n) => /^(gemini|gemma)-/.test(n)).sort() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "could not list the models" }, { status: 502 });
  }
}

export async function GET(request: Request) {
  if (new URL(request.url).searchParams.has("models")) return listModels();
  const cfg = publicConfig();
  if (!cfg) return Response.json({ ok: false, error: "not configured" }, { status: 503 });
  await rpc(serviceConfig(), "purge_old_rows", {}, 10_000).catch(() => {
    /* not migrated yet, or the database is busy: tomorrow's run clears it */
  });
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

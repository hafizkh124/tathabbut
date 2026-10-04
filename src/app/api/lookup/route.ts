// First real server route: ask Dorar (cache first, then live through the Cloudflare relay) and return what it says,
// field by field. Verdicts are Dorar's own words; nothing here classifies or rewrites them (src/lib/gradeMap.ts does).
import { supabaseDorarCache } from "@/lib/dorarCache";
import { lookupDorar } from "@/lib/lookup";

export const dynamic = "force-dynamic";
/** Worst case is two 8 s attempts and a pause, so this leaves room without letting a call hang. */
export const maxDuration = 30;

const MAX_QUERY_LENGTH = 300;

export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (!q) return Response.json({ error: "missing q" }, { status: 400 });
  if (q.length > MAX_QUERY_LENGTH) return Response.json({ error: "q too long" }, { status: 400 });

  const r = await lookupDorar(q, { cache: supabaseDorarCache() });
  if (!r.ok) return Response.json({ error: r.error, detail: r.detail ?? null }, { status: 502 });
  return Response.json(
    { source: "dorar.net", origin: r.origin, fetchedAt: r.fetchedAt ?? null, query: q, results: r.results },
    // Repeated questions are also answered from Vercel's edge cache, without touching Supabase or Dorar.
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}

// POST /api/alternative  { "query": "<the Arabic text of a claim that does not hold>" }
//   →  { "status": "found", "alternative": { matn, source, reference? } } | { "status": "none" }
// The authentic text on the same matter (src/lib/alternative.ts), asked for only when a soft reply is opened. Two small AI calls
// and a few Dorar searches, so it has its own small limit; an answer is kept in this instance's memory for a few hours, because the
// same well-known texts are asked about again and again. OFF unless ALTERNATIVE=1: it ships only after the specialist's check of
// eval/alternatives.ts passes (at least 80% of what it shows is the same meaning, none clearly wrong).
import { findAlternative } from "@/lib/alternative";
import { aiQuotaResponse, limited } from "@/lib/rateLimit";
import type { Alternative } from "@/lib/softReply";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const MAX_QUERY_LEN = 400;
const TTL_MS = 6 * 60 * 60 * 1000;
const kept = new Map<string, { at: number; alt: Alternative | null }>();
const keyOf = (q: string) => q.replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export async function POST(request: Request) {
  if (process.env.ALTERNATIVE !== "1") return Response.json({ error: "not available" }, { status: 404 });
  let query = "";
  try {
    query = String(((await request.json()) as { query?: unknown }).query ?? "").trim();
  } catch {
    return Response.json({ error: "body must be JSON: { query }" }, { status: 400 });
  }
  if (!query || !/[ء-ي]/.test(query)) return Response.json({ error: "query must be Arabic text" }, { status: 400 });
  if (query.length > MAX_QUERY_LEN) return Response.json({ error: `query longer than ${MAX_QUERY_LEN} characters` }, { status: 400 });

  const key = keyOf(query);
  const hit = kept.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return Response.json(hit.alt ? { status: "found", alternative: hit.alt } : { status: "none" });

  const refused = await limited(request, "alternative");
  if (refused) return refused;
  try {
    const alt = await findAlternative(query);
    if (kept.size > 300) kept.clear();
    kept.set(key, { at: Date.now(), alt });
    return Response.json(alt ? { status: "found", alternative: alt } : { status: "none" });
  } catch (err) {
    return aiQuotaResponse(err) ?? Response.json({ status: "unavailable" }, { status: 502 });
  }
}

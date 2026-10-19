// POST /api/alulama  { "query": "<a topic in Urdu, or a hadith's Arabic wording>", "kind": "fatwa" | "hadith_ruling" }
//   →  { "status": "found", "hits": [...] } | { "status": "none" } | 503 { "status": "unavailable" }
// The questions العلماء already answered, from our copy of them (migration 014): no AI, no call to alulama.org. Asked for by the
// screen AFTER /api/verify has answered, so a card never waits for it and a failure here changes nothing on the card.
// A fatwa search takes a short topic, never a question's own words: a person's story cannot be sent through here.
import { matchAlulama } from "@/lib/alulamaMatch";
import { limited } from "@/lib/rateLimit";
import { cleanTopicUrdu } from "@/lib/topic";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const MAX_QUERY_LEN = 1_000;

export async function POST(request: Request) {
  let body: { query?: unknown; kind?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON: { query, kind }" }, { status: 400 });
  }
  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) return Response.json({ error: "empty query" }, { status: 400 });
  if (query.length > MAX_QUERY_LEN) return Response.json({ error: `query longer than ${MAX_QUERY_LEN} characters` }, { status: 400 });
  if (body.kind !== "fatwa" && body.kind !== "hadith_ruling") return Response.json({ error: 'kind must be "fatwa" or "hadith_ruling"' }, { status: 400 });
  if (body.kind === "fatwa" && cleanTopicUrdu(query) !== query) return Response.json({ error: "a fatwa query must be a short topic in Urdu" }, { status: 400 });

  const refused = await limited(request, "alulama");
  if (refused) return refused;
  try {
    const hits = await matchAlulama(query, body.kind);
    return Response.json(hits.length ? { status: "found", hits } : { status: "none" });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}

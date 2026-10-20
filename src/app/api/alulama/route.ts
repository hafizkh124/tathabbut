// POST /api/alulama  { "query": "<a hadith's Arabic wording>" | "queries": ["<a topic>", …], "kind": "fatwa" | "hadith_ruling" }
//   →  { "status": "found", "hits": [...] } | { "status": "none" } | 503 { "status": "unavailable" }
// The questions العلماء already answered, from our copy of them (migration 014): no AI, no call to alulama.org. Asked for by the
// screen AFTER /api/verify has answered, so a card never waits for it and a failure here changes nothing on the card.
// A fatwa search takes short topics (up to eight: the topic in each language the question was given in and the other names of the matter), never a question's own words:
// a person's story cannot be sent through here.
import { matchAlulama } from "@/lib/alulamaMatch";
import { limited } from "@/lib/rateLimit";
import { cleanTopicAny } from "@/lib/topic";
import { signExcerpt } from "@/lib/turathSign";
import { answerText } from "@/lib/alulamaClient";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const MAX_QUERY_LEN = 1_000;
const MAX_QUERIES = 8;

export async function POST(request: Request) {
  let body: { query?: unknown; queries?: unknown; kind?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON: { query | queries, kind }" }, { status: 400 });
  }
  const given = Array.isArray(body.queries) ? body.queries : [body.query];
  const queries = given.filter((q): q is string => typeof q === "string").map((q) => q.trim()).filter(Boolean);
  if (!queries.length || queries.length > MAX_QUERIES) return Response.json({ error: `1 to ${MAX_QUERIES} queries` }, { status: 400 });
  if (queries.some((q) => q.length > MAX_QUERY_LEN)) return Response.json({ error: `a query longer than ${MAX_QUERY_LEN} characters` }, { status: 400 });
  if (body.kind !== "fatwa" && body.kind !== "hadith_ruling") return Response.json({ error: 'kind must be "fatwa" or "hadith_ruling"' }, { status: 400 });
  if (body.kind === "fatwa" && queries.some((q) => cleanTopicAny(q) !== q)) return Response.json({ error: "a fatwa query must be a short topic" }, { status: 400 });

  const refused = await limited(request, "alulama");
  if (refused) return refused;
  try {
    const hits = await matchAlulama(queries, body.kind);
    // each answer carries the server's signature on its text, which /api/translate asks for (only our own copy can be translated)
    return Response.json(hits.length ? { status: "found", hits: hits.map((h) => ({ ...h, sig: signExcerpt(answerText(h)) })) } : { status: "none" });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}

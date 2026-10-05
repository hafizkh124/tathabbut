// POST /api/turath  { "query": "<the claim's Arabic text, or for "fiqh" its topic>", "kind": "hadith" | "scholar_quote" | "fiqh", "state": "...", "basis": "...", "notes": [...] }
//   →  { "turath": { status, references, partial? }, "patch": { state, basis, notes } | null }
// Called by the screen AFTER /api/verify has answered, so the card never waits for Turath. `state`, `basis` and `notes`
// are the claim's result from /api/verify; `patch` is the change Turath makes to it (see turathFallback.ts).
import { cleanTopic } from "@/lib/topic";
import type { TurathLookupOutcome } from "@/lib/hadithMatch";
import { lookupTurath } from "@/lib/turath";
import { supabaseTurathCache, withCache } from "@/lib/turathCache";
import { signExcerpt } from "@/lib/turathSign";
import { turathPatch } from "@/lib/turathFallback";
import { isLookupKind } from "@/lib/turathScope";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

// A repeated question is answered from the cache (30 days, Supabase); a cache that is missing or down changes nothing.
const lookup = withCache(lookupTurath, supabaseTurathCache());

/** Each excerpt carries the server's signature, which /api/translate asks for. Signed after the cache, so none is stored. */
const signed = (o: TurathLookupOutcome): TurathLookupOutcome =>
  o.status === "success" ? { ...o, references: o.references.map((r) => ({ ...r, sig: signExcerpt(r.excerpt) })) } : o;

const MAX_QUERY_LEN = 1_000;

export async function POST(request: Request) {
  let body: { query?: unknown; kind?: unknown; state?: unknown; basis?: unknown; notes?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON: { query, kind }" }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) return Response.json({ error: "empty query" }, { status: 400 });
  if (query.length > MAX_QUERY_LEN) return Response.json({ error: `query longer than ${MAX_QUERY_LEN} characters` }, { status: 400 });
  if (!isLookupKind(body.kind)) return Response.json({ error: 'kind must be "hadith", "scholar_quote" or "fiqh"' }, { status: 400 });
  // a fiqh lookup takes a topic of a few Arabic words, never a question's own words: a story cannot be sent through here
  if (body.kind === "fiqh" && cleanTopic(query) !== query) return Response.json({ error: "fiqh query must be a short Arabic topic" }, { status: 400 });

  const found = await lookup(query, body.kind);
  const notes = Array.isArray(body.notes) ? body.notes.filter((n): n is string => typeof n === "string") : [];
  const patch = turathPatch(
    { claim: { kind: body.kind }, state: String(body.state ?? ""), basis: String(body.basis ?? ""), notes },
    found,
  );
  return Response.json({ turath: signed(found), patch });
}

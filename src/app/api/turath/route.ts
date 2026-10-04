// POST /api/turath  { "query": "<the claim's Arabic text>", "kind": "hadith" | "scholar_quote", "state": "...", "basis": "...", "notes": [...] }
//   →  { "turath": { status, references, partial? }, "patch": { state, basis, notes } | null }
// Called by the screen AFTER /api/verify has answered, so the card never waits for Turath. `state`, `basis` and `notes`
// are the claim's result from /api/verify; `patch` is the change Turath makes to it (see turathFallback.ts).
import { lookupTurath } from "@/lib/turath";
import { turathPatch } from "@/lib/turathFallback";
import { isLookupKind } from "@/lib/turathScope";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

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
  if (!isLookupKind(body.kind)) return Response.json({ error: 'kind must be "hadith" or "scholar_quote"' }, { status: 400 });

  const turath = await lookupTurath(query, body.kind);
  const notes = Array.isArray(body.notes) ? body.notes.filter((n): n is string => typeof n === "string") : [];
  const patch = turathPatch(
    { claim: { kind: body.kind }, state: String(body.state ?? ""), basis: String(body.basis ?? ""), notes },
    turath,
  );
  return Response.json({ turath, patch });
}

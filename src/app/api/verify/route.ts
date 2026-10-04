// POST /api/verify  { "text": "<the pasted post>" }  →  the claims found in it, each with its state and evidence.
// Claims are found by Gemini but checked against the post itself (src/lib/claims.ts); states come only from the
// specialist's list, the mushaf text, or Dorar's muhaddithun read through gradeMap (src/lib/verify.ts).
import { extractClaims } from "@/lib/claims";
import { supabaseDorarCache } from "@/lib/dorarCache";
import { displayGrade, classifyVerdict } from "@/lib/gradeMap";
import { lookupDorar } from "@/lib/lookup";
import { matchVerses } from "@/lib/quranCheck";
import { matchSayings } from "@/lib/sayingsMatch";
import { verifyClaims } from "@/lib/verify";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_TEXT = 5_000;

export async function POST(request: Request) {
  let text = "";
  try {
    text = String(((await request.json()) as { text?: unknown }).text ?? "").trim();
  } catch {
    return Response.json({ error: "body must be JSON: { text }" }, { status: 400 });
  }
  if (!text) return Response.json({ error: "empty text" }, { status: 400 });
  if (text.length > MAX_TEXT) return Response.json({ error: `text longer than ${MAX_TEXT} characters` }, { status: 400 });

  const t0 = Date.now();
  let extraction;
  try {
    extraction = await extractClaims(text);
  } catch (err) {
    return Response.json({ error: "could not read the post", detail: (err as Error).message.slice(0, 200) }, { status: 502 });
  }
  const cache = supabaseDorarCache();
  const results = await verifyClaims(extraction.claims, {
    matchVerses: (q) => matchVerses(q),
    matchSayings: (q) => matchSayings(q),
    lookupDorar: (q) => lookupDorar(q, { cache }),
  });

  return Response.json({
    claims: results.map((r) => ({
      ...r,
      // each muhaddith's verdict as shown on the card (policy A: a caution on a medium-confidence grade)
      dorar: r.dorar && {
        ...r.dorar,
        narrations: r.dorar.narrations.slice(0, 8).map((n) => ({ ...n, display: displayGrade(classifyVerdict(n.verdict ?? "", n.muhaddith ?? "")) })),
        weakVariants: r.dorar.weakVariants?.slice(0, 8).map((n) => ({ ...n, display: displayGrade(classifyVerdict(n.verdict ?? "", n.muhaddith ?? "")) })),
      },
    })),
    dropped: extraction.dropped,
    model: extraction.model,
    ms: { extract: extraction.ms, total: Date.now() - t0 },
  });
}

// POST /api/verify  { "text": "<the pasted post>" }  →  the claims found in it, each with its state and evidence.
// Claims are found by Gemini but checked against the post itself (src/lib/claims.ts); states come only from the
// specialist's list, the mushaf text, or Dorar's muhaddithun read through gradeMap (src/lib/verify.ts).
import { later } from "@/lib/later";
import { extractClaims } from "@/lib/claims";
import { eventRow, logEvent } from "@/lib/events";
import { supabaseDorarCache } from "@/lib/dorarCache";
import { displayGrade, classifyVerdict } from "@/lib/gradeMap";
import { lookupDorar } from "@/lib/lookup";
import { fetchVerseQiraat, fetchVerseScripts, matchVerses, matchVersesInText } from "@/lib/quranCheck";
import { aiQuotaResponse, limited } from "@/lib/rateLimit";
import { matchSayings } from "@/lib/sayingsMatch";
import { cachedAnswer, postKey, saveAnswer, saveSharedClaims, withShareIds } from "@/lib/sharedClaims";
import { verifyClaims } from "@/lib/verify";
import { signExcerpt } from "@/lib/turathSign";
import type { ClaimResult } from "@/lib/clientTypes";

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
  // a post checked before: its stored results, with no AI call and not counted against the client's limit
  const key = postKey(text);
  const cached = await cachedAnswer(key);
  if (cached) {
    later(() => logEvent(eventRow(request, "verify", { cached: true, claims: cached.length, states: cached.map((c) => c.state), ms: Date.now() - t0 })));
    return Response.json({ claims: cached, cached: true, ms: { extract: 0, total: Date.now() - t0 } });
  }

  const refused = await limited(request, "verify");
  if (refused) return refused;

  let extraction;
  try {
    extraction = await extractClaims(text);
  } catch (err) {
    return aiQuotaResponse(err) ?? Response.json({ error: "could not read the post" }, { status: 502 });
  }
  const cache = supabaseDorarCache();
  const results = await verifyClaims(extraction.claims, {
    matchVerses: (q) => matchVerses(q),
    matchVersesInText: (q) => matchVersesInText(q),
    verseScripts: (keys) => fetchVerseScripts(keys),
    verseQiraat: (keys) => fetchVerseQiraat(keys),
    matchSayings: (q) => matchSayings(q),
    lookupDorar: (q) => lookupDorar(q, { cache }),
  });

  const shown: ClaimResult[] = results.map((r) => ({
    ...r,
    similarExpressions: r.similarExpressions?.map((x) => ({ ...x, sig: signExcerpt(x.text) })),
    // each muhaddith's verdict as shown on the card (policy A: a caution on a medium-confidence grade)
    dorar: r.dorar && {
      ...r.dorar,
      narrations: r.dorar.narrations.slice(0, 15).map((n) => ({ ...n, display: displayGrade(classifyVerdict(n.verdict ?? "", n.muhaddith ?? "")) })),
      weakVariants: r.dorar.weakVariants?.slice(0, 15).map((n) => ({ ...n, display: displayGrade(classifyVerdict(n.verdict ?? "", n.muhaddith ?? "")) })),
      cited: r.dorar.cited && {
        ...r.dorar.cited,
        narration: r.dorar.cited.narration && { ...r.dorar.cited.narration, display: displayGrade(classifyVerdict(r.dorar.cited.narration.verdict ?? "", r.dorar.cited.narration.muhaddith ?? "")) },
      },
    },
  }));
  // each result gets a link (/r/<id>) and is stored for it once the answer has gone out
  const { claims, rows } = withShareIds(shown);
  const ms = Date.now() - t0;
  later(async () => {
    await saveSharedClaims(rows);
    await saveAnswer(key, claims);
    await logEvent(eventRow(request, "verify", { cached: false, claims: claims.length, states: claims.map((c) => c.state), ids: rows.map((r) => r.id), ms, model: extraction.model }));
  });

  return Response.json({
    claims,
    dropped: extraction.dropped,
    model: extraction.model,
    usage: extraction.usage,
    ms: { extract: extraction.ms, total: ms },
  });
}

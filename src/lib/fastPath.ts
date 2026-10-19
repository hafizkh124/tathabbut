// The answer without the AI: for a short text that is one Arabic quotation (a verse, or a saying), the checks that never needed
// the model — the specialist's list, the mushaf and Dorar — are run on it directly. It answers only when one of them gives a
// strong positive result; for anything else it returns null and the normal path (extraction by the model, then the same checks)
// runs. It never answers «not found»: finding the claims in a long or mixed post is the model's work, and a text this path
// cannot place is not evidence that nothing exists. Off unless FAST_PATH=1.
import { matnOverlap, matnTokens } from "./arabic";
import { arabicRun } from "./claims";
import { hasPressure, stripPressure } from "./chainPressure";
import type { Claim } from "./claims";
import { GRADES } from "./gradeMap";
import { STATES } from "./states";
import { verifyClaimParts, type VerifiedClaim, type VerifyDeps } from "./verify";

export const fastPathEnabled = (): boolean => process.env.FAST_PATH === "1";

const MAX_CHARS = 300;
const MIN_WORDS = 3;

/** «قال رسول الله ﷺ:», «قال تعالى:», «عن النبي ﷺ»: the words that introduce a quotation and are not part of it. */
const LEAD_IN =
  /^\s*(?:و?قال\s+(?:رسول\s+الله|النبي|الله|ربنا)(?:\s+(?:تعالى|عز\s+وجل))?|و?قال\s+تعالى|عن\s+النبي|حديث\s+شريف|قرآن\s+مجيد)(?:\s*(?:ﷺ|صلى\s+الله\s+عليه\s+و?سلم|\(ص\)))?\s*[:،,\-–—]*\s*/;
const WRAP = /^[\s«»“”"'`‘’()[\]{}﴿﴾*_]+|[\s«»“”"'`‘’()[\]{}﴿﴾*_.،,:;]+$/gu;

const letters = (s: string) => s.replace(/[^\p{L}]/gu, "");

/** The quotation a text is, or null when it is not one short Arabic quotation that stands alone. */
export function singleQuotation(text: string): string | null {
  let t = text.trim();
  if (!t || t.length > MAX_CHARS || /\n\s*\S/.test(t) || /[؟?]/.test(t)) return null;
  if (hasPressure(t)) {
    const rest = stripPressure(t);
    if (!rest || !t.includes(rest)) return null;
    t = rest;
  }
  for (let i = 0; i < 2; i++) t = t.replace(LEAD_IN, "");
  t = t.replace(WRAP, "").trim();
  // one quotation: no second quoted piece, no sentence after a full stop
  if ((t.match(/[«“"﴿]/g)?.length ?? 0) > 1 || /[۔.!؛]\s*\S/.test(t)) return null;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < MIN_WORDS || !text.includes(t)) return null;
  // all Arabic: no Urdu or English words around it
  const run = arabicRun(t);
  if (!run || letters(run).length < letters(t).length * 0.95) return null;
  return t;
}

/** How much of the asked text one narration holds: a near wording is not the text (an invented saying often has a real one close to it). */
const DORAR_OVERLAP_MIN = 0.9;

/** A result strong enough to answer on its own: the specialist's list, a verse, or narrations Dorar graded for this very text. */
function strong(r: VerifiedClaim): boolean {
  if (r.lookupFailed) return false;
  if (r.basis === "specialist-list") return true;
  if (r.basis === "quran") return r.state === STATES.verseOk || r.state === STATES.verseWrong;
  if (r.basis === "dorar") {
    if (!r.dorar?.narrations.length || !(r.state === GRADES[0] || r.state === GRADES[1] || r.state === GRADES[2])) return false;
    const asked = matnTokens(r.claim.query);
    return r.dorar.narrations.some((n) => (matnOverlap(asked, matnTokens(n.matn)) ?? 0) >= DORAR_OVERLAP_MIN);
  }
  return false;
}

/** The results for the text, or null when the normal path must run. */
export async function fastPath(text: string, deps: VerifyDeps): Promise<VerifiedClaim[] | null> {
  const quote = singleQuotation(text);
  if (!quote) return null;
  const run = arabicRun(quote) ?? quote;
  const claim: Claim = {
    kind: "hadith",
    textAsWritten: quote,
    spanCheck: "exact",
    arabicSpan: run,
    query: run,
    queryIsTranslation: false,
    language: letters(run) === letters(quote) ? "ar" : "mixed",
    attributedTo: null,
    citedSource: null,
    warnings: [],
  };
  try {
    const results = await verifyClaimParts(claim, deps);
    if (results.length !== 1 || !strong(results[0])) return null;
    // a verse is a «quran» claim, as the normal path would have made it
    return results[0].basis === "quran" ? [{ ...results[0], claim: { ...results[0].claim, kind: "quran" } }] : results;
  } catch {
    return null;
  }
}

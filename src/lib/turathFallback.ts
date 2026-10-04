// When Dorar has nothing on a hadith or on a scholar's saying, the books of Turath may hold the text. Turath gives no
// verdict, so the claim never becomes «مقبول» or «ضعيف» from it, and it is not «غير حاسم» either: that would clash with
// a passage that itself says «موضوع». It ends as «موجود في كتب التراث», shown as «موجود», and the passages are shown
// (specialist's decision, 2026-10-05). No sentence about a ruling, or the lack of one, is added.
import type { TurathLookupOutcome } from "./hadithMatch";
import { STATES } from "./states";

export interface TurathPatch {
  state: typeof STATES.turathFound;
  basis: "turath";
  notes: string[];
}

/**
 * The change a Turath result makes to a claim already checked against the Quran, the specialist's list and Dorar:
 * only a hadith or a scholar's saying that ended as «لم يُعثر عليه» and whose text the books hold. Anything else is null.
 */
export function turathPatch(
  result: { state: string; basis: string; notes: string[]; claim: { kind: string } },
  outcome: TurathLookupOutcome,
): TurathPatch | null {
  if (result.claim.kind !== "hadith" && result.claim.kind !== "scholar_quote") return null;
  if (result.basis !== "none" || result.state !== STATES.notFound) return null;
  if (outcome.status !== "success" || outcome.references.length === 0) return null;
  return { state: STATES.turathFound, basis: "turath", notes: ["ورد النص في كتب التراث"] };
}

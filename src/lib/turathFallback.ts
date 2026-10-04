// When Dorar has nothing on a hadith or on a scholar's saying, the books of Turath may hold the text. Turath gives
// no verdict, so the claim never becomes «مقبول» or «ضعيف» from it: it ends as «غير حاسم» and the card says where
// the text was found (specialist's decision, 2026-10-04). The grading rule «لا ينسب حديث دون مصدر وحكم معتمد» holds:
// the card says outright that Dorar has no verdict.
import type { TurathLookupOutcome } from "./hadithMatch";
import { STATES } from "./states";

export type TurathPatchReason = "no-ruling" | "dorar-unavailable";

export interface TurathPatch {
  state: typeof STATES.unsure;
  basis: "turath";
  reason: TurathPatchReason;
  notes: string[];
}

export const DORAR_UNAVAILABLE_NOTE = "تعذّر البحث في الدرر";

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

  const dorarDown = result.notes.some((n) => n.startsWith(DORAR_UNAVAILABLE_NOTE));
  return {
    state: STATES.unsure,
    basis: "turath",
    reason: dorarDown ? "dorar-unavailable" : "no-ruling",
    notes: [dorarDown ? "تعذّر البحث في الدرر؛ ورد النص في كتب التراث" : "ورد النص في كتب التراث؛ ولا حكم صريح في الدرر"],
  };
}

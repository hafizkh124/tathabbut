// «هل تقصد؟»: when a quoted verse fits more than one place, the user picks the verse they mean, and the result follows that choice.
import type { ClaimResult } from "./clientTypes";
import { stateOfVerse } from "./states";

/** The claim as it reads when the user has chosen candidate `pick` (0 = the best match, which is the default). */
export function applyPick(claim: ClaimResult, pick: number | undefined): ClaimResult {
  const list = claim.verse?.candidates;
  if (!claim.verse || !list || pick === undefined || pick <= 0 || !list[pick]) return claim;
  const chosen = list[pick];
  return { ...claim, state: stateOfVerse(chosen.wording), verse: { ...chosen, candidates: list } };
}

/** Which candidate is showing now (0 when the claim has no choice to make). */
export function pickedIndex(claim: ClaimResult): number {
  const list = claim.verse?.candidates;
  if (!claim.verse || !list) return 0;
  const i = list.findIndex((c) => c.surah === claim.verse?.surah && c.ayah === claim.verse?.ayah);
  return i < 0 ? 0 : i;
}

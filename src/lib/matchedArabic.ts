import type { ClaimResult } from "./clientTypes";

/** Show the retrieved narration, not the model's reconstructed search query. */
export function matchedArabic(r: ClaimResult): string | null {
  if (!r.claim.queryIsTranslation) return null;
  return r.dorar?.narrations[0]?.matn?.trim() || null;
}

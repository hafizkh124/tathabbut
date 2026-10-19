import type { ClaimResult } from "./clientTypes";

/** Show the retrieved narration, not the model's reconstructed search query: the narration of the book the post names
 *  when there is one (it is shown first, citedBook.ts), else the first narration. */
export function matchedArabic(r: ClaimResult): string | null {
  if (!r.claim.queryIsTranslation) return null;
  return (r.dorar?.cited?.narration ?? r.dorar?.narrations[0])?.matn?.trim() || null;
}

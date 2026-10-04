// Decides whether a Turath passage holds THE TEXT the user asked about, or only some of its words.
// Turath's search is a keyword AND-search: invented text returns nothing (live, 2026-10-04), but a real phrase can
// still come back inside passages that merely discuss it, so the check is stricter than Dorar's 60% (specialist's
// decision, 2026-10-04): the whole phrase inside the passage, or about 80% of its content words.
import { matnTokens, normalizeArabic } from "./arabic";

export const TURATH_MIN_COVERAGE = 0.8;
/** With fewer content words than this the coverage figure means little, so only the whole phrase counts. */
const MIN_WORDS_FOR_COVERAGE = 3;

const letters = (s: string) => normalizeArabic(s).replace(/[^ء-ي\s]/g, " ").replace(/\s+/g, " ").trim();

export function isSameText(query: string, passage: string): boolean {
  const q = letters(query);
  if (!q) return false;
  const p = letters(passage);
  if (p.includes(q)) return true;

  const qTok = matnTokens(query);
  if (qTok.size < MIN_WORDS_FOR_COVERAGE) return false;
  const pTok = matnTokens(passage);
  return [...qTok].filter((w) => pTok.has(w)).length / qTok.size >= TURATH_MIN_COVERAGE;
}

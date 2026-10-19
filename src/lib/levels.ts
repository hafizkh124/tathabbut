// The content level (أ–د) of a result, from docs/04-verification-rules.md §4.6. A display label only: it changes no state and
// no behaviour. «أ» settled core information, «ب» explanation with its reference, «ج» disputed or unresolved, «د» fatwa or personal case.
import { GRADES } from "./gradeMap";
import { toneOf } from "./gradeStyle";
import { STATES } from "./states";

export const LEVELS = ["A", "B", "C", "D"] as const;
export type Level = (typeof LEVELS)[number];

const VERSE_STATES: readonly string[] = [STATES.verseOk, STATES.verseWrong, STATES.verseContext, STATES.verseTranslated];

/**
 * - A: a verse (found, misquoted, cut from its context, or a translated text: the mushaf answers directly) and a hadith graded مقبول.
 * - B: a weak or very weak hadith, and the specialist's own «wrongly attributed» statuses: the verdict is explained with its named author.
 * - C: غير حاسم, not found, a general fiqh question, a text found only in the books of Turath: the disagreement is shown, or nothing is claimed.
 * - D: a personal case or a request for a fatwa: no ruling, a referral.
 * An unknown wording is read as C, never as A.
 */
export function levelOf(state: string): Level {
  const s = state.trim();
  if (s === STATES.fatwa) return "D";
  if (s === GRADES[0] || VERSE_STATES.includes(s)) return "A";
  const tone = toneOf(s);
  if (tone === "weak" || tone === "veryWeak" || tone === "misquote") return "B";
  return "C";
}

// One line over the results of a post: «4 texts, only 1 established», with the share of each kind for the colour bar.
// Counts come from the states alone, so the line can never say more than the cards below it.
import { GRADES } from "./gradeMap";
import { toneOf, type Tone } from "./gradeStyle";
import { STATES } from "./states";

export interface Summary {
  total: number;
  /** a hadith graded مقبول, or a verse quoted correctly */
  established: number;
  /** a weak or very weak hadith, a misquoted verse, a wrongly attributed saying */
  problem: number;
  /** not found, غير حاسم, fiqh, found in Turath only */
  unresolved: number;
  /** a personal case: referral */
  referral: number;
}

const ESTABLISHED: readonly string[] = [GRADES[0], STATES.verseOk];
const PROBLEM_TONES: readonly Tone[] = ["weak", "veryWeak", "misquote"];

export function summarize(states: string[]): Summary {
  const out: Summary = { total: states.length, established: 0, problem: 0, unresolved: 0, referral: 0 };
  for (const state of states) {
    const s = state.trim();
    if (ESTABLISHED.includes(s)) out.established++;
    else if (s === STATES.fatwa) out.referral++;
    else if (PROBLEM_TONES.includes(toneOf(s))) out.problem++;
    else out.unresolved++;
  }
  return out;
}

/** Which sentence says it: null for one text (the card says it), or none established / only one / all / some. */
export type SummaryKind = "all" | "none" | "one" | "some";
export function summaryKind(s: Summary): SummaryKind | null {
  if (s.total < 2) return null;
  if (s.established === s.total) return "all";
  if (s.established === 0) return "none";
  return s.established === 1 ? "one" : "some";
}

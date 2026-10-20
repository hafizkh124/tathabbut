// Finds the questions العلماء already answered for a visitor's question or text, in our copy of them (migration 014). Server-only:
// the table is open to the service key alone. A match that is not clearly about the same matter is left out, never shown as a guess.
import { foldText, type AlulamaHit, type AlulamaKind } from "./alulama";
import { rpc, serviceConfig, type RestConfig } from "./supabaseRest";

/** Words of a question that say nothing about its matter (folded). Left in, «جائز» and «حکم» would match half of the site. */
const STOP = new Set(
  [
    "کیا", "ہے", "ہیں", "ہو", "ہوں", "ہوتا", "ہوتی", "ہوگا", "ہوگی", "کا", "کی", "کے", "کو", "میں", "سے", "پر", "اور", "یا", "تو", "بھی", "ہی", "نے", "اس", "یہ", "وہ", "جو", "کہ",
    "جائز", "ناجائز", "حکم", "احکام", "شرعی", "کیسا", "کیسی", "کیسے", "مسئلہ", "مسائل", "سوال", "بارے", "متعلق", "حیثیت", "صورت", "کرنا", "کرنے", "کرتے", "کر", "دینا", "ہونا",
    "شیخ", "صاحب", "مہربانی", "رہنمائی", "براہ", "السلام", "علیکم", "جزاکم", "اللہ", "خیرا",
  ].map(foldText),
);

/** The words of a question that carry its matter: folded, no filler. */
export const queryTokens = (text: string): string[] => foldText(text).split(" ").filter((w) => w.length >= 2 && !STOP.has(w));

/** How much of the query is in the text (the share of its longer words): each longer word counts when its first letters are there (Urdu inflects its endings). */
export function coverage(tokens: string[], text: string): number {
  const words = tokens.filter((w) => w.length >= 3);
  if (!words.length) return 0;
  const hay = foldText(text);
  return words.filter((w) => hay.includes(w.length >= 4 ? w.slice(0, w.length - 1) : w)).length / words.length;
}

export interface MatchOptions {
  cfg?: RestConfig | null;
  minScore?: number;
  /** how much of the query's words must be in the answer's title and start */
  minCoverage?: number;
  call?: typeof rpc;
}

/** At most three answered questions of the asked kind, best first; an empty list when nothing is clearly the same matter. */
export async function matchAlulama(query: string, kind: AlulamaKind, opts: MatchOptions = {}): Promise<AlulamaHit[]> {
  const tokens = queryTokens(query);
  if (!tokens.some((w) => w.length >= 3)) return [];
  // a hadith is asked by its wording, so its words stay together; a topic is a few key words
  const q = tokens.join(" ");
  if (kind === "hadith_ruling" && tokens.length < 3) return [];
  const call = opts.call ?? rpc;
  const hits = await call<AlulamaHit[]>(opts.cfg === undefined ? serviceConfig() : opts.cfg, "match_alulama", { q, k: kind, min_score: opts.minScore ?? 0.55, max_results: 8 });
  // for a topic of two words both must be there; of three, two; of four, three. A hadith's wording needs 0.6 of its words.
  const need = opts.minCoverage ?? (kind === "hadith_ruling" ? 0.6 : 0.66);
  const seen = new Set<number>();
  return hits
    .filter((h) => (seen.has(h.id) ? false : (seen.add(h.id), true)))
    .filter((h) => coverage(tokens, `${h.title} ${h.answer_snippet}`) >= need)
    // a title that holds more of the asked words comes first; the database's score orders the rest (Array.sort is stable)
    .map((h) => ({ h, inTitle: coverage(tokens, h.title) }))
    .sort((a, b) => b.inTitle - a.inTitle)
    .map(({ h }) => h)
    .slice(0, 3);
}

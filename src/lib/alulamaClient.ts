// The screen's side of العلماء: asked for after /api/verify has answered, like the books of Turath (turathClient.ts).
import type { AlulamaHit, AlulamaKind } from "./alulama";
import type { AlulamaView, ClaimResult } from "./clientTypes";
import { GRADES } from "./gradeMap";
import { STATES } from "./states";

const hasArabic = (s: string) => /[ء-ي]/.test(s);

/** The text of an answer as it is translated and signed: the title, a blank line, the start of the answer. */
export const answerText = (h: { title: string; answer_snippet: string }) => `${h.title}\n\n${h.answer_snippet}`.trim();

/** The address a visitor goes to with a case of their own (the contact page of العلماء). */
export const ALULAMA_ASK_URL = "https://alulama.org/ulama-rabeta-urdu/";

/**
 * What to look for on العلماء, or null.
 * - a general fiqh question that has an Urdu topic: the fatwas on that topic. A personal case is never searched: no ruling is
 *   given on it, and its words never leave the page;
 * - a hadith, athar or scholar's saying that Dorar could not settle: العلماء' answered questions about that text.
 */
export function alulamaKindOf(c: ClaimResult): AlulamaKind | null {
  const kind = c.claim.kind;
  if (kind === "question") return c.state === STATES.fiqh && (c.claim.topicUr || c.claim.topicEn) ? "fatwa" : null;
  if (kind !== "hadith" && kind !== "scholar_quote") return null;
  if (c.basis === "quran" || c.basis === "kind") return null;
  if (c.state !== STATES.notFound && c.state !== GRADES[3]) return null;
  return hasArabic(c.claim.query) && c.claim.query.trim().split(/\s+/).length >= 3 ? "hadith_ruling" : null;
}

/**
 * What is searched for on العلماء, in every language the question was given in: the Urdu topic always (most answers are Urdu),
 * and beside it the English topic for an English question or the Arabic one for an Arabic question (a few answers are in those).
 */
export function alulamaQueriesOf(c: ClaimResult, kind: AlulamaKind): string[] {
  if (kind !== "fatwa") return [c.claim.query];
  const lang = c.claim.language;
  return [c.claim.topicUr, lang === "en" || !c.claim.topicUr ? c.claim.topicEn : null, lang === "ar" ? c.claim.topic : null].filter((q): q is string => Boolean(q));
}

const UNAVAILABLE: AlulamaView = { status: "unavailable" };

/** Never throws: a failure is «unavailable» and the card stays as it is. */
export async function fetchAlulama(query: string | string[], kind: AlulamaKind): Promise<AlulamaView> {
  try {
    const res = await fetch("/api/alulama", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Array.isArray(query) ? { queries: query, kind } : { query, kind }) });
    if (!res.ok) return UNAVAILABLE;
    const data = (await res.json()) as { status?: string; hits?: AlulamaHit[] };
    if (data.status === "found" && data.hits?.length) return { status: "found", kind, hits: data.hits };
    return { status: "none" };
  } catch {
    return UNAVAILABLE;
  }
}

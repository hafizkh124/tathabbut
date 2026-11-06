// Why a claim ended as «not found». «Not found» used to be one message for very different things (a text that is
// no hadith, a question, a text with no Arabic to search, a text the books really do not have); the card now says
// which, so the person knows what to do next. Kept apart from verify.ts so the browser can import it.
import { foldUrdu } from "./arabic";

export type NotFoundReason =
  /** a text in Urdu or English that could not be turned into Arabic wording to search with */
  | "no-arabic"
  /** a question or a topic, not a text to check */
  | "question"
  /** a saying with no attribution to the Prophet ﷺ or a scholar: nothing to verify it against */
  | "unattributed"
  /** the post names a book and number, but no text could be read at that number and the text itself is missing */
  | "reference"
  /** the text was found at the number named, but Dorar gives no verdict on it */
  | "reference-no-grade";

const QUESTION_START = /^(?:هل|ما\s+(?:هي|هو|حكم|معني)|ماذا|لماذا|كيف|متي|اين|من\s+(?:هو|هي)|تفسير|شرح|حكم|كيا|كيون|كيسي|كون|كب|كهاں|what|why|how|is\s+it|is\s+this|does|do)(?=\s|$)/i;

/** A text that asks (a question word first, a question mark, or «هل يوجد…») instead of saying something to check. */
export function looksLikeQuestion(text: string): boolean {
  const t = foldUrdu(text).trim();
  return QUESTION_START.test(t) || /[?؟]\s*$/.test(t);
}

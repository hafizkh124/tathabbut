// A link that opens Dorar already narrowed to the book a narration comes from, with that narration's own words.
// Dorar's API gives no address for a single hadith, but its search page takes the book (s[]) and the words (q), so the
// user lands on that very hadith, usually as the only result. The book ids come from Dorar's own search form
// (scripts/fetch-dorar-books.ts). When the book cannot be told with certainty the link is the plain search.
import books from "../data/dorarBooks.json";
import { normalizeArabic } from "./arabic";

interface Book {
  id: number;
  name: string;
}

const BOOKS = books as Book[];
const SEARCH = "https://dorar.net/hadith/search";
/** Dorar's search wants every word; a long hadith is searched by its opening words only. */
const MAX_WORDS = 10;
/** Shorter than this, "contains" matches are too loose to trust («الأم», «العلل»…). */
const MIN_PARTIAL = 6;

const BY_NAME = new Map<string, number>();
const NORMALIZED = BOOKS.map((b) => ({ id: b.id, n: normalizeArabic(b.name).replace(/^كتاب /, "") }));
for (const b of NORMALIZED) if (!BY_NAME.has(b.n)) BY_NAME.set(b.n, b.id);

/** The Dorar id of the book named by a narration's «المصدر», or null when it is not one book for certain. */
export function dorarBookId(source: string | undefined): number | null {
  if (!source) return null;
  const n = normalizeArabic(source).replace(/^كتاب /, "").trim();
  if (!n) return null;
  const exact = BY_NAME.get(n);
  if (exact !== undefined) return exact;
  if (n.length < MIN_PARTIAL) return null;
  // one name that contains the other, and only one such book
  const near = NORMALIZED.filter((b) => b.n.length >= MIN_PARTIAL && (b.n.includes(n) || n.includes(b.n)));
  return near.length === 1 ? near[0].id : null;
}

/** The first words of a text as Dorar's search wants them: no diacritics, no punctuation, and without Dorar's own
 *  additions in [brackets] (they are not part of the hadith). */
export function searchWords(text: string): string {
  return normalizeArabic(text.replace(/\[[^\]]*\]/g, " "))
    .replace(/[^ء-ي\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_WORDS)
    .join(" ");
}

export function dorarSearchUrl(text: string, source?: string): string {
  const id = dorarBookId(source);
  const q = encodeURIComponent(searchWords(text));
  return `${SEARCH}?q=${q}${id ? `&s%5B%5D=${id}` : ""}`;
}

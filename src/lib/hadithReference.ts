// A hadith named by its book and number («Sahih Bukhari#187», «صحیح مسلم : 250», «سنن ابی داؤد، حدیث نمبر 4160»):
// read as a book and a number, fetched from the hadith-api dataset (public JSON files, one small file per hadith),
// and given back as the Arabic text found at that number. Nothing here grades a hadith: the text found is searched in
// Dorar like any other text (verify.ts), and a number that gives no text leaves the claim to the usual way.
import { foldUrdu, normalizeArabic } from "./arabic";
import muslimAbdAlBaqi from "../data/muslim-abd-al-baqi.json";

export type HadithBook = "bukhari" | "muslim" | "abudawud" | "tirmidhi" | "nasai" | "ibnmajah";

/** How each book is named in the notes: the Arabic title, as Dorar writes it in its «source» field. */
export const BOOK_TITLES: Record<HadithBook, string> = {
  bukhari: "صحيح البخاري",
  muslim: "صحيح مسلم",
  abudawud: "سنن أبي داود",
  tirmidhi: "جامع الترمذي",
  nasai: "سنن النسائي",
  ibnmajah: "سنن ابن ماجه",
};

/** The word that names each book in a post (folded: Urdu letters as Arabic, no harakat; Latin in lower case). */
const BOOK_WORDS: { book: HadithBook; words: RegExp }[] = [
  { book: "bukhari", words: /^(?:بخاري|بخارى|bukhari|bukhary|bokhari|buchari)$/ },
  { book: "muslim", words: /^(?:مسلم|muslim)$/ },
  { book: "abudawud", words: /^(?:داود|داوود|dawud|dawood|daud|daood|abudawud|abudaud|abudawood)$/ },
  { book: "tirmidhi", words: /^(?:ترمذي|ترمذى|tirmidhi|tirmizi|termizi|tirmedhi|tirmidzi)$/ },
  { book: "nasai", words: /^(?:نسايي|نساي|نسائي|nasai|nasa|nasaee|nesai|nisai)$/ },
  { book: "ibnmajah", words: /^(?:ماجه|ماجة|majah|maja|majjah|majaa)$/ },
];

/** Words that may stand between the book and the number («حدیث نمبر», «hadith no.») and mean nothing else. */
const BETWEEN = /^(?:حديث|حديثا|hadith|hadees|hadis|نمبر|رقم|no|number|num|h)$/i;
/** A number right after one of these is a volume or a page, never a hadith. */
const NOT_A_HADITH_NUMBER = /^(?:ج|جلد|ص|صفحه|page|p|pg|vol|volume|كتاب|باب)$/i;

export interface HadithReference {
  book: HadithBook;
  number: number;
  /** the words of the text that gave the reference, as written */
  matched: string;
}

/**
 * The book and the hadith number a text gives, or null. The number must follow the book's name directly (a few joining
 * words allowed): «ترمذی 2645», «Sahih Muslim#5959», «سنن ابی داؤد، حدیث نمبر 4160». A number after «ج» or «ص» (volume,
 * page) or written «1/123» is not a hadith number. A book this does not know (Mishkat, Musnad Ahmad) gives null.
 */
export function parseHadithReference(text: string): HadithReference | null {
  const t = foldUrdu(text).toLowerCase();
  const tokens = [...t.matchAll(/[\p{L}\p{N}]+/gu)].map((m) => ({ w: m[0], start: m.index ?? 0, end: (m.index ?? 0) + m[0].length }));
  for (let i = 0; i < tokens.length; i++) {
    // «abu dawud» is two words, «ibn majah» too: the last one names the book
    const book = BOOK_WORDS.find((b) => b.words.test(tokens[i].w))?.book;
    if (!book) continue;
    // Muslim alone is a name too: it must be named as the book («صحيح مسلم», «Sahih Muslim») or stand next to its number
    let j = i + 1;
    while (j < tokens.length && BETWEEN.test(tokens[j].w) && j - i < 4) j++;
    const num = tokens[j];
    if (!num || !/^\d{1,5}$/.test(num.w)) continue;
    const before = tokens[j - 1]?.w ?? "";
    if (NOT_A_HADITH_NUMBER.test(before)) continue;
    const after = t.slice(num.end);
    if (/^\s*[/]\s*\d/.test(after)) continue; // «1/123»: volume and page
    const number = Number(num.w);
    if (number < 1) continue;
    return { book, number, matched: text.slice(tokens[i].start, num.end) };
  }
  return null;
}

// ---------- fetching ----------

const DATASET = "https://raw.githubusercontent.com/fawazahmed0/hadith-api/1/editions";
export const HADITH_FETCH_TIMEOUT_MS = 4_000;

export type HadithFetch = (url: string) => Promise<unknown>;

/** The files never change: the edge keeps them for a month. */
const defaultFetch: HadithFetch = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(HADITH_FETCH_TIMEOUT_MS), next: { revalidate: 30 * 24 * 3600 } });
  if (!res.ok) throw new Error(`hadith dataset: HTTP ${res.status}`);
  return res.json();
};

export interface NumberedHadith {
  book: HadithBook;
  /** the number the post gave */
  number: number;
  /** which numbering the number was read in */
  numbering: "standard" | "abd-al-baqi";
  /** the Arabic text found at that number, with its chain */
  text: string;
}

async function textAt(book: HadithBook, hadithNumber: number, fetcher: HadithFetch): Promise<string | null> {
  const data = (await fetcher(`${DATASET}/ara-${book}/${hadithNumber}.min.json`)) as { hadiths?: { hadithnumber?: number; text?: string }[] };
  const h = data.hadiths?.find((x) => x.hadithnumber === hadithNumber) ?? data.hadiths?.[0];
  const text = h?.text?.trim();
  return text || null;
}

/** The Muslim hadith numbers (the dataset's own numbering) that stand under one number of Muhammad Fuad Abd al-Baqi's. */
export function muslimByAbdAlBaqi(n: number): number[] {
  const v = (muslimAbdAlBaqi as Record<string, number | number[]>)[String(n)];
  return v === undefined ? [] : Array.isArray(v) ? v.slice(0, 3) : [v];
}

/**
 * The hadith(s) at a book and number, best reading first; empty when the book has nothing at that number or the
 * dataset cannot be reached (a failure is never an answer). Sahih Muslim is cited in two numberings: Abd al-Baqi's
 * (up to 3033; the one Dorar prints) comes first, the dataset's own numbering (to 7563) after it.
 */
export async function fetchNumberedHadith(ref: HadithReference, fetcher: HadithFetch = defaultFetch): Promise<NumberedHadith[]> {
  const out: NumberedHadith[] = [];
  const add = async (numbering: NumberedHadith["numbering"], at: number) => {
    try {
      const text = await textAt(ref.book, at, fetcher);
      if (text && !out.some((o) => o.text === text)) out.push({ book: ref.book, number: ref.number, numbering, text });
    } catch {
      /* not there, or unreachable: nothing at this reading */
    }
  };
  if (ref.book === "muslim") {
    const [first] = muslimByAbdAlBaqi(ref.number);
    if (first !== undefined) await add("abd-al-baqi", first);
    if (ref.number <= 7563) await add("standard", ref.number);
  } else {
    await add("standard", ref.number);
  }
  return out;
}

// ---------- the wording of the hadith, without its chain ----------

const SAID = /(?:قال|يقول|فقال|وقال|سمعت)\s+(?:رسول\s+الله|النبي)(?:\s+صلي\s+الله\s+عليه\s+وسلم)?|(?:ان|عن)\s+(?:رسول\s+الله|النبي)(?:\s+صلي\s+الله\s+عليه\s+وسلم)?/;
const ISNAD_WORDS = new Set(["حدثنا", "حدثني", "اخبرنا", "اخبرني", "عن", "ح", "قال", "سمعت"]);

/**
 * A stretch of the hadith's own wording to search with: after the words that open the Prophet's speech when there are
 * some, else from the middle of the text (a chain stands at the start). At most `max` words, folded as Dorar's
 * search takes them. A search by a stretch finds the narrations that contain it, whichever wording they have around it.
 */
export function matnQuery(text: string, max = 12): string {
  const folded = normalizeArabic(text).replace(/[^ء-ي\s]/g, " ").replace(/\s+/g, " ").trim();
  const words = folded.split(" ").filter(Boolean);
  if (words.length <= max) return folded;
  const m = SAID.exec(folded);
  let start: number;
  if (m) {
    start = folded.slice(0, m.index + m[0].length).split(" ").filter(Boolean).length;
  } else {
    // skip the chain: past the last word of it near the start, else a third in
    let k = 0;
    while (k < Math.min(words.length - max, 30) && (ISNAD_WORDS.has(words[k]) || k < 6 || /^(?:بن|ابن|ابي|ابو)$/.test(words[k]) || words[k].length <= 3)) k++;
    start = Math.max(k, Math.floor(words.length / 3));
  }
  start = Math.min(start, Math.max(0, words.length - max));
  // a leading «قال» or «ان» only joins the speech to its opening
  while (start < words.length - 3 && (words[start] === "قال" || words[start] === "ان" || words[start] === "انه")) start++;
  return words.slice(start, start + max).join(" ");
}

/** How much of the shorter text's content words the longer one has: 0 to 1, null when a text is too short to judge. */
export function sameHadith(a: string, b: string): number | null {
  const tokens = (s: string) => new Set(normalizeArabic(s).replace(/[^ء-ي\s]/g, " ").split(/\s+/).filter((w) => w.length > 3));
  const x = tokens(a);
  const y = tokens(b);
  if (x.size < 3 || y.size < 3) return null;
  let shared = 0;
  for (const w of x) if (y.has(w)) shared++;
  return shared / Math.min(x.size, y.size);
}

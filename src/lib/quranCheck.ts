// Checks a quoted verse word by word against the mushaf text (quranpedia Hafs, standard spelling — checked:
// «الصلاه»، «السماوات»، «ابراهيم» occur, the Uthmani «الصلوه»، «السموات» never do, so correct quotes do not look wrong).
// Comparison is on normalized words (no harakat; أ إ آ → ا; ة → ه; Urdu keyboard letters folded), so only a real
// change of word is reported: «الصابرون» for «الصابرين», a missing word, an added word.
import { normalizeArabic } from "./arabic";
import { foldUrduLetters } from "./claims";
import { publicConfig, rpc, type RestConfig } from "./supabaseRest";

export interface VerseHit {
  surah: number;
  ayah: number;
  surah_name_ar: string;
  /** the mushaf text with harakat (column named text_uthmani in 001; the dump is standard spelling) */
  text_uthmani: string;
  text_clean: string;
  score: number;
}

export type WordDiff =
  | { op: "replaced"; typed: string; correct: string }
  | { op: "missing"; correct: string }
  | { op: "added"; typed: string };

export interface WordingCheck {
  exact: boolean;
  /** The quotation cuts the verse off from what qualifies it (CONTEXT_CUTS). */
  contextOmitted?: true;
  /** For a cut verse that is complete in itself: the adjoining verse to read with it, from the mushaf (CONTEXT_CUTS). */
  contextContinuation?: { text: string; endAyah: number };
  /** The verse's own words (with harakat) for the stretch that was quoted. */
  correctText: string;
  diffs: WordDiff[];
  /** edits ÷ quoted words: 0 = exact. */
  distance: number;
}

const words = (s: string) => normalizeArabic(foldUrduLetters(s)).replace(/[^ء-ي\s]/g, " ").split(/\s+/).filter(Boolean);

/**
 * Quotations known to cut a verse off from what qualifies it, approved one by one by the specialist (4:43 on 2026-10-04,
 * 107:4 on 2026-10-05). A match gets the «context omitted» state; a verse that is complete in itself also shows the verse
 * that qualifies it, copied from our mushaf table (quranpedia Hafs), never written by the model.
 */
export const CONTEXT_CUTS: { surah: number; ayah: number; quote: RegExp; continuation?: { text: string; endAyah: number } }[] = [
  { surah: 4, ayah: 43, quote: /^و?لا تقربوا الصلاه$/ },
  { surah: 107, ayah: 4, quote: /^فويل للمصلين$/, continuation: { text: "الَّذِينَ هُمْ عَنْ صَلَاتِهِمْ سَاهُونَ", endAyah: 5 } },
];

/**
 * A quote copied from a mushaf in the Uthmani script (it carries one of its signs: superscript alif ٰ, alif wasla ٱ,
 * maddah ٓ, small waw/ya ۥ ۦ ۧ, the silent-letter zero ۟, small meem ۢ ۭ, or the QPC sukun ۡ). Detection as in
 * Abdur Rahman's branch «eval». A typed quote carries none of them and keeps the strict comparison.
 */
// …or a hamza written on the line after a short vowel (أَفَرَءَيْتُم), where the standard text gives it a seat.
const UTHMANI = /[ٰٓٱۥۦۭۧ۟ۢۡ]|[َ-ِ]ء/;
/** Marks the superscript alif in a key; it stands for an alif or for no letter. */
const SUPERSCRIPT = "\u0001";

/**
 * Reads one Uthmani word as the standard (imlaei) spelling would, using only documented differences:
 * - Tanzil, «Uthmani vs Simple» (tanzil.net/docs/uthmani_minimal, version_1.1_updates): alif wasla ٱ is a plain alif;
 *   the maddah, the silent-letter zero (قَالُوا۟ ⇒ قالوا), small meem and tatweel are signs, not letters; the small
 *   waw/ya after the pronoun هـ is not written in the standard text (بِهِۦ ⇒ بِهِ، لَهُۥ ⇒ لَهُ).
 * - رسم المصحف، قاعدة الحذف (المقنع للداني; الإتقان للسيوطي): an alif left out of the line and marked with a
 *   superscript alif (إِبْرَٰهِيمَ، ٱلسَّمَٰوَٰتِ) — the standard text writes it in some words (إبراهيم، السماوات)
 *   and not in others (الرحمن، ذلك، هذا), so it may stand for an alif or for nothing; a ya left out and marked with a
 *   small ya inside a word (إِبْرَٰهِـۧمَ، ٱلنَّبِيِّـۧنَ) is a ya.
 *   The same rule leaves out one lam of «الليل، الذي، التي، اللاتي» (ٱلَّيْلِ، ٱلَّٰتِى): it is put back.
 * - قاعدة البدل: the waw written for an alif before ة, with a superscript alif (ٱلصَّلَوٰةَ، ٱلزَّكَوٰةَ، ٱلْحَيَوٰةِ) is the alif;
 *   the ya written for an alif inside a word, with a superscript alif (ءَاتَىٰهُ، أَدْرَىٰكَ) is the alif (آتاه، أدراك).
 * - قاعدة الهمز: a hamza written on the line before an alif (ءَامَنُوا۟), or above a tatweel before an alif (لَـَٔايَٰتٍ),
 *   is the madd alif (آمنوا، لآيات); a hamza written above with no seat (شَيْـًٔا) is a ya-seat hamza (شيئا); a hamza
 *   on the line after a fatha inside a word (أَفَرَءَيْتُم) sits on an alif (أفرأيتم).
 * A full alif in the quote is never read as nothing: «قَالَ» is never «قُلْ».
 */
function uthmaniKey(word: string): string {
  const w = word
    .replace(/^([وفبلك][َِ]?)?([ٱا])ل(?=(?:َّ|َّ)ـ?[يٰ])/, "$1$2لل") // قاعدة الحذف (definite article, lam with shadda): ٱلَّيْلِ، ٱلَّٰتِى ⇒ الليل، اللاتي
    .replace(/وٰ(?=[ً-ْ]*ة)/g, "ا") // قاعدة البدل: الصلوٰة
    .replace(/ىٰ(?=.*[ء-ي])/g, "ا") // قاعدة البدل: ءَاتَىٰهُ ⇒ آتاه (not at the end: رَمَىٰ stays)
    .replace(/(?<=ه[َ-ِ]?)[ۥۦ](?=[ً-ْٓۖ-ۜ]*$)/, "") // بِهِۦ، لَهُۥ: the pronoun's small letter (end of word)
    .replace(/[ۦۧ]/g, "ي") // إِبْرَٰهِـۧمَ، يُحْىِۦ: the small ya is a ya
    .replace(/ء(?=[ً-ْ]*ا)/g, "") // ءَامَنُوا۟ ⇒ امنوا
    .replace(/ـ?َ?َٔ?(?=[ً-ْ]*ا)/g, "") // لَـَٔايَٰتٍ ⇒ لآيات
    .replace(/ـ?(?:َٔ|َٔ)/g, "أ").replace(/ـ?ٔ/g, "ئ") // الهمز: an open hamza after a sukun sits on an alif (يَسْـَٔلُونَ ⇒ يسألون); otherwise on a ya seat (شَيْـًٔا ⇒ شيئا، يَـُٔودُهُۥ ⇒ يئوده)
    .replace(/(?<=َ)ء(?=[ً-ْ]*[ء-ي])/g, "أ").replace(/(?<=ُ)ء(?=[ً-ْ]*[ء-ي])/g, "ؤ").replace(/(?<=ِ)ء(?=[ً-ْ]*[ء-ي])/g, "ئ") // قاعدة الهمز: «تكتب حال سكونها بحرف حركة ما قبلها»: أَفَرَءَيْتُم ⇒ أفرأيتم، رُءْيَاكَ ⇒ رؤياك
    .replace(/ٰ/g, SUPERSCRIPT);
  return normalizeArabic(foldUrduLetters(w)).replace(/[^\u0621-\u064A\u0001]/g, "");
}

/** An Uthmani key equals a standard word when each superscript alif is read as an alif or as nothing. */
function uthmaniEquals(key: string, standard: string): boolean {
  if (!key.includes(SUPERSCRIPT)) return key === standard;
  // a key holds Arabic letters and the marker only, so its parts need no escaping
  const pattern = key.split(SUPERSCRIPT).join("\u0627?");
  return new RegExp(`^${pattern}$`).test(standard);
}

/** رسم المصحف، قاعدة الحذف: the vocative «يا» written joined to the next word (يَٰٓأَيُّهَا) is two words in the standard text. */
const splitVocative = (s: string) => s.replace(/(^|\s)([وف]َ?)?يَ?ـ?ٰٓ?(?=[ء-ي])/g, "$1$2يَا ");

/** The verse's display words, aligned with its normalized words (waqf marks such as ۚ are not words). */
function verseWords(v: VerseHit): { clean: string[]; shown: string[] } {
  const shown = v.text_uthmani.replace(/﻿/g, "").split(/\s+/).filter((w) => words(w).length > 0);
  const clean = shown.map((w) => words(w).join(""));
  return { clean, shown };
}

/** Word-level edit distance with the operations, between the quote and one stretch of the verse. */
function align(a: string[], b: string[], eq: (x: string, y: string) => boolean = (x, y) => x === y) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (eq(a[i - 1], b[j - 1]) ? 0 : 1));
  const ops: ({ op: "same" | "replaced"; ai: number; bj: number } | { op: "added"; ai: number } | { op: "missing"; bj: number })[] = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (eq(a[i - 1], b[j - 1]) ? 0 : 1)) {
      ops.unshift({ op: eq(a[i - 1], b[j - 1]) ? "same" : "replaced", ai: i - 1, bj: j - 1 });
      i--;
      j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      ops.unshift({ op: "added", ai: i - 1 });
      i--;
    } else {
      ops.unshift({ op: "missing", bj: j - 1 });
      j--;
    }
  }
  return { cost: d[a.length][b.length], ops };
}

/** Compares the quote with the best-fitting stretch of the verse (a quote is usually part of a verse). */
export function compareWithVerse(quoted: string, verse: VerseHit): WordingCheck {
  const uthmani = UTHMANI.test(quoted);
  const typedShown = (uthmani ? splitVocative(quoted) : quoted).split(/\s+/).filter((w) => words(w).length > 0);
  const typed = typedShown.map((w) => words(w).join(""));
  const { clean, shown } = verseWords(verse);
  // A copied Uthmani quote is compared word by word through its documented standard reading; a typed one strictly.
  const typedCmp = uthmani ? typedShown.map(uthmaniKey) : typed;
  const eq = uthmani ? uthmaniEquals : undefined;
  // Specialist-reviewed 13:11 omission: keep the whole related stretch rather
  // than letting edit distance shorten it before «ما بأنفسهم».
  const reviewedQuote = verse.surah === 13 && verse.ayah === 11
    && typed.join(" ") === "ان الله لا يغير ما بقوم حتي يغيروا انفسهم";
  const reviewedWords = words("إن الله لا يغير ما بقوم حتى يغيروا ما بأنفسهم");
  const reviewedStart = reviewedQuote ? clean.findIndex((_, i) => reviewedWords.every((w, j) => clean[i + j] === w)) : -1;
  let best = { cost: Infinity, start: 0, len: 0, ops: [] as ReturnType<typeof align>["ops"] };
  for (let len = Math.max(1, typed.length - 2); len <= Math.min(clean.length, typed.length + 2); len++) {
    for (let start = 0; start + len <= clean.length; start++) {
      if (reviewedStart >= 0 && (start !== reviewedStart || len !== reviewedWords.length)) continue;
      const r = align(typedCmp, clean.slice(start, start + len), eq);
      if (r.cost < best.cost || (r.cost === best.cost && len === typed.length && best.len !== typed.length)) best = { cost: r.cost, start, len, ops: r.ops };
    }
  }
  const window = shown.slice(best.start, best.start + best.len);
  const diffs: WordDiff[] = [];
  for (const o of best.ops) {
    if (o.op === "replaced") diffs.push({ op: "replaced", typed: typedShown[o.ai], correct: window[o.bj] });
    else if (o.op === "added") diffs.push({ op: "added", typed: typedShown[o.ai] });
    else if (o.op === "missing") diffs.push({ op: "missing", correct: window[o.bj] });
  }
  const cut = CONTEXT_CUTS.find((c) => c.surah === verse.surah && c.ayah === verse.ayah && c.quote.test(typed.join(" ")));
  return {
    exact: best.cost === 0,
    ...(cut ? { contextOmitted: true as const } : {}),
    ...(cut?.continuation ? { contextContinuation: cut.continuation } : {}),
    correctText: window.join(" "),
    diffs,
    distance: typed.length ? best.cost / typed.length : 1,
  };
}

/** Normalized form used for the database search (same as quran_verses.text_clean). */
export const searchForm = (s: string) => words(s).join(" ");

export async function matchVerses(quoted: string, cfg: RestConfig | null = publicConfig(), minScore = 0.5): Promise<VerseHit[]> {
  const q = searchForm(quoted);
  if (q.split(" ").length < 2) return [];
  return rpc<VerseHit[]>(cfg, "match_verses", { q, min_score: minScore, max_results: 5 });
}

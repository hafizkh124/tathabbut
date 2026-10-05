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

/** The verse's display words, aligned with its normalized words (waqf marks such as ۚ are not words). */
function verseWords(v: VerseHit): { clean: string[]; shown: string[] } {
  const shown = v.text_uthmani.replace(/﻿/g, "").split(/\s+/).filter((w) => words(w).length > 0);
  const clean = shown.map((w) => words(w).join(""));
  return { clean, shown };
}

/** Word-level edit distance with the operations, between the quote and one stretch of the verse. */
function align(a: string[], b: string[]) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  const ops: ({ op: "same" | "replaced"; ai: number; bj: number } | { op: "added"; ai: number } | { op: "missing"; bj: number })[] = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) {
      ops.unshift({ op: a[i - 1] === b[j - 1] ? "same" : "replaced", ai: i - 1, bj: j - 1 });
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
  const typedShown = quoted.split(/\s+/).filter((w) => words(w).length > 0);
  const typed = typedShown.map((w) => words(w).join(""));
  const { clean, shown } = verseWords(verse);
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
      const r = align(typed, clean.slice(start, start + len));
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

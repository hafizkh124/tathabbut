// Checks a quoted verse word by word against the mushaf text (quranpedia Hafs, standard spelling — checked:
// «الصلاه»، «السماوات»، «ابراهيم» occur, the Uthmani «الصلوه»، «السموات» never do, so correct quotes do not look wrong).
// Comparison is on normalized words (no harakat; أ إ آ → ا; ة → ه; Urdu keyboard letters folded), so only a real
// change of word is reported: «الصابرون» for «الصابرين», a missing word, an added word.
import { normalizeArabic } from "./arabic";
import { foldUrduLetters } from "./claims";
import { publicConfig, restHeaders, rpc, type RestConfig } from "./supabaseRest";

export interface VerseHit {
  surah: number;
  ayah: number;
  surah_name_ar: string;
  /** the mushaf text with harakat (column named text_uthmani in 001; the dump is standard spelling) */
  text_uthmani: string;
  text_clean: string;
  score: number;
  /** The same verse as other mushafs write it (quran_verse_scripts: Uthmani, IndoPak), when fetched. */
  scripts?: VerseScriptText[];
}

/** One verse in another script, as stored in quran_verse_scripts (migration 007). */
export interface VerseScriptText {
  script: "uthmani" | "indopak";
  text: string;
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
  /** The quote was compared with this script's text (it fitted it better than the standard text). */
  script?: VerseScriptText["script"];
}

/** Characters that are not words (zero-width spaces, annotation signs such as «ؕ»), and the dotless «ٮ» some IndoPak texts
 *  write for «ى»: encodings, not spellings. */
const encodingFold = (s: string) => s.replace(/[​-‏﻿ؐ-ؚ]/g, "").replace(/ٮ/g, "ى");
const words = (s: string) => normalizeArabic(foldUrduLetters(encodingFold(s))).replace(/[^ء-ي\s]/g, " ").split(/\s+/).filter(Boolean);

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
function verseWords(text: string): { clean: string[]; shown: string[] } {
  const shown = text.replace(/﻿/g, "").split(/\s+/).filter((w) => words(w).length > 0);
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

/**
 * Compares the quote with the best-fitting stretch of the verse (a quote is usually part of a verse): with the standard
 * text (an Uthmani quote through its documented standard reading), and with each stored script of the verse word for
 * word (its own spelling, so no rule is needed). The closest wins; a script's text only when it fits strictly better,
 * so the standard text and its reviewed cases decide every quote the standard text already fits.
 */
export function compareWithVerse(quoted: string, verse: VerseHit): WordingCheck {
  let best = compareWithText(quoted, verse, verse.text_uthmani, UTHMANI.test(quoted));
  for (const s of verse.scripts ?? []) {
    if (best.exact) break;
    const w = compareWithText(quoted, verse, s.text, false);
    if (w.distance < best.distance) best = { ...w, script: s.script };
  }
  return best;
}

/**
 * Some mushaf texts break a word in two at a ligature («دَآ بَّةٍ», «ذٰ لِكُمۡ», quran.com's IndoPak): two typed pieces
 * are read as one word when only the joined word is in the text.
 */
function joinBrokenWords(typedShown: string[], clean: string[]): string[] {
  const inText = new Set(clean);
  const key = (w: string) => words(w).join("");
  const out = [...typedShown];
  for (let i = 0; i + 1 < out.length; i++) {
    const [a, b] = [key(out[i]), key(out[i + 1])];
    if (inText.has(a + b) && !(inText.has(a) && inText.has(b))) out.splice(i, 2, out[i] + out[i + 1]);
  }
  return out;
}

function compareWithText(quoted: string, verse: VerseHit, text: string, uthmani: boolean): WordingCheck {
  const { clean, shown } = verseWords(text);
  const pieces = (uthmani ? splitVocative(quoted) : quoted).split(/\s+/).filter((w) => words(w).length > 0);
  const typedShown = uthmani ? pieces : joinBrokenWords(pieces, clean);
  const typed = typedShown.map((w) => words(w).join(""));
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

/** The verses that sit inside a pasted text of several verses (migration 008: how much of each verse is in the text). */
export async function matchVersesInText(quoted: string, cfg: RestConfig | null = publicConfig(), minScore = 0.75): Promise<VerseHit[]> {
  const q = searchForm(quoted);
  if (q.split(" ").length < 2) return [];
  return rpc<VerseHit[]>(cfg, "match_verses_in_text", { q, min_score: minScore, max_results: 100 });
}

// ---------- a paste of several verses ----------

/** Consecutive verses of one surah found one after the other in a quote, and where they sit in it (character offsets). */
export interface VerseRun {
  verses: VerseHit[];
  start: number;
  end: number;
}
/** The quote cut into the verse runs found in it and the stretches between them, in the quote's order. */
export type QuoteSegment = ({ kind: "run" } & VerseRun) | { kind: "gap"; start: number; end: number };

/**
 * Only for finding where a verse sits in a quote, never for judging its wording: the letters every spelling of the
 * mushaf writes the same way (no alif, hamza, waw or ya), so «ٱلصَّلَوٰةَ» and «الصلاة», «يَٰٓأَيُّهَا» and «يا أيها»
 * are found in the same place. Words with nothing left («يا») are skipped on both sides.
 */
const placeKey = (w: string) => words(w).join("").replace(/[اويء]/g, "");

/** The quote's words with their character offsets. */
function quoteTokens(quote: string) {
  const out: { key: string; start: number; end: number }[] = [];
  for (const m of quote.matchAll(/\S+/g)) {
    const key = placeKey(m[0]);
    if (key) out.push({ key, start: m.index!, end: m.index! + m[0].length });
  }
  return out;
}

/** A verse may be at most this share of its words off from the stretch of the quote it is placed on. */
const PLACE_MAX_COST = 0.3;
/**
 * A verse found on its own (no neighbour beside it) must have at least this many words («الرحمن», «طه» are everywhere)
 * and sit in the quote word for word: verses that share most of their words (2:255 and 20:110) must not stand in for
 * each other. A verse misquoted on its own is left to the one-verse check, which reports the change.
 */
const LONE_VERSE_MIN_WORDS = 3;

/** Every place in the quote (token positions) where the verse's words sit, allowing a few changed words. */
function placements(verseKeys: string[], q: string[]): { from: number; to: number; cost: number }[] {
  const n = verseKeys.length;
  if (!n) return [];
  // Edit distance with free ends in the quote: d[i][j] = best cost of the verse's first i words ending at quote word j.
  let prev = Array.from({ length: q.length + 1 }, () => 0);
  let prevStart = Array.from({ length: q.length + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i++) {
    const cur = [i];
    const curStart = [0];
    for (let j = 1; j <= q.length; j++) {
      const diag = prev[j - 1] + (verseKeys[i - 1] === q[j - 1] ? 0 : 1);
      const up = prev[j] + 1;
      const left = cur[j - 1] + 1;
      if (diag <= up && diag <= left) { cur[j] = diag; curStart[j] = prevStart[j - 1]; }
      else if (up <= left) { cur[j] = up; curStart[j] = prevStart[j]; }
      else { cur[j] = left; curStart[j] = curStart[j - 1]; }
    }
    prev = cur;
    prevStart = curStart;
  }
  const max = Math.floor(PLACE_MAX_COST * n);
  const out: { from: number; to: number; cost: number }[] = [];
  for (let j = 1; j <= q.length; j++) {
    const c = prev[j];
    if (c > max || c > (prev[j - 1] ?? Infinity) || (j < q.length && c > prev[j + 1])) continue;
    const p = { from: prevStart[j], to: j, cost: c };
    const last = out[out.length - 1];
    if (last && p.from < last.to) { if (p.cost <= last.cost) out[out.length - 1] = p; } // one place per occurrence, the longer on a tie
    else out.push(p);
  }
  return out;
}

/**
 * Cuts a quote of several verses into runs of consecutive verses. Each hit is placed wherever it sits in the quote
 * (a verse repeated in a surah, like «فبأي آلاء ربكما تكذبان», may sit in several places); runs chain a verse to the
 * next one of the same surah placed right after it; the runs covering the most words are kept, without overlap.
 * Words in no run are returned as gaps, for the caller to check on their own.
 */
export function findVerseRuns(quote: string, hits: VerseHit[]): QuoteSegment[] {
  const tokens = quoteTokens(quote);
  const q = tokens.map((t) => t.key);
  type Placed = { hit: VerseHit; from: number; to: number; cost: number; words: number; prev?: Placed; total: number; count: number };
  const placed: Placed[] = [];
  for (const hit of hits) {
    const keys = words(hit.text_uthmani).map(placeKey).filter(Boolean);
    for (const p of placements(keys, q)) placed.push({ hit, from: p.from, to: p.to, cost: p.cost, words: keys.length, total: p.to - p.from, count: 1 });
  }
  placed.sort((a, b) => a.from - b.from || a.to - b.to);
  // Longest chain ending at each placement: the previous verse of the same surah, ending where this one starts (±1 word).
  for (const p of placed) {
    for (const o of placed) {
      if (o === p || o.hit.surah !== p.hit.surah || o.hit.ayah !== p.hit.ayah - 1) continue;
      if (Math.abs(p.from - o.to) > 1) continue;
      if (o.total + (p.to - p.from) > p.total) { p.prev = o; p.total = o.total + (p.to - p.from); p.count = o.count + 1; }
    }
  }
  const chains = placed
    .filter((p) => p.count > 1 || (p.words >= LONE_VERSE_MIN_WORDS && p.cost === 0))
    .sort((a, b) => b.total - a.total || b.count - a.count);
  const taken: VerseRun[] = [];
  const used: [number, number][] = [];
  for (const end of chains) {
    const verses: Placed[] = [];
    for (let p: Placed | undefined = end; p; p = p.prev) verses.unshift(p);
    const from = verses[0].from;
    const to = end.to;
    if (used.some(([a, b]) => from < b && a < to)) continue;
    used.push([from, to]);
    taken.push({ verses: verses.map((v) => v.hit), start: tokens[from].start, end: tokens[to - 1].end });
  }
  taken.sort((a, b) => a.start - b.start);
  // The words between runs, as gaps.
  const segments: QuoteSegment[] = [];
  let at = 0;
  const gapAt = (from: number, to: number) => {
    const inside = tokens.filter((t) => t.start >= from && t.end <= to);
    if (inside.length) segments.push({ kind: "gap", start: inside[0].start, end: inside[inside.length - 1].end });
  };
  for (const r of taken) {
    gapAt(at, r.start);
    segments.push({ kind: "run", ...r });
    at = r.end;
  }
  gapAt(at, quote.length);
  return segments;
}

/** Copied from a mushaf: it carries verse numbers («﴿١﴾», «۝») or the Uthmani script's signs. */
export const looksCopiedFromMushaf = (s: string) => /[﴾﴿۝]/.test(s) || UTHMANI.test(s);

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const arabicNumber = (n: number) => String(n).replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)]);

/**
 * A run of verses as one text to compare a quote with: the verses' own wording one after the other, each followed by
 * its number «﴿٢﴾» (the number is not a word, so the comparison skips it). Keeps the first verse's place.
 */
export function joinVerses(verses: VerseHit[]): VerseHit {
  const join = (texts: string[]) => texts.map((t, i) => `${t.replace(/﻿/g, "").trim()} ﴿${arabicNumber(verses[i].ayah)}﴾`).join(" ");
  const scripts = (["uthmani", "indopak"] as const).flatMap((script) => {
    const texts = verses.map((v) => v.scripts?.find((s) => s.script === script)?.text);
    return texts.every((t): t is string => Boolean(t)) ? [{ script, text: join(texts) }] : [];
  });
  return {
    ...verses[0],
    text_uthmani: join(verses.map((v) => v.text_uthmani)),
    text_clean: verses.map((v) => v.text_clean).join(" "),
    score: Math.min(...verses.map((v) => v.score)),
    ...(scripts.length ? { scripts } : {}),
  };
}

/** The stored scripts (quran_verse_scripts) of the given verses, by "surah:ayah". */
export async function fetchVerseScripts(keys: { surah: number; ayah: number }[], cfg: RestConfig | null = publicConfig()): Promise<Map<string, VerseScriptText[]>> {
  const out = new Map<string, VerseScriptText[]>();
  const unique = [...new Map(keys.map((k) => [`${k.surah}:${k.ayah}`, k])).values()];
  if (!unique.length) return out;
  if (!cfg) throw new Error("Supabase is not configured");
  const or = unique.map((k) => `and(surah.eq.${k.surah},ayah.eq.${k.ayah})`).join(",");
  const res = await fetch(`${cfg.url.replace(/\/+$/, "")}/rest/v1/quran_verse_scripts?select=surah,ayah,script,text&or=(${or})`, {
    headers: restHeaders(cfg.key),
    signal: AbortSignal.timeout(5_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`quran_verse_scripts: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  for (const r of (await res.json()) as { surah: number; ayah: number; script: VerseScriptText["script"]; text: string }[]) {
    const k = `${r.surah}:${r.ayah}`;
    out.set(k, [...(out.get(k) ?? []), { script: r.script, text: r.text }]);
  }
  return out;
}

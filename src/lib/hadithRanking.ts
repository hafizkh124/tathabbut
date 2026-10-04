// Hadith ranking and filtering engine for Dorar Al-Saniyya results (decisions of 2026-10-04).
// Order of a narration: grade group, then book tier, then closeness to the user's text, then the muhaddith.
// 1. Grade: مقبول first, then غير حاسم, ضعيف, شديد الضعف.
// 2. Book tier: Sahihayn > the four Sunan (with Al-Albani's Sahih/Da'if books on them) > every other book.
//    A narration that covers less than half of the user's text loses its tier advantage.
// 3. Text closeness, then scholar priority: Sheikh Al-Albani > prominent scholars > others.
// 4. When the text is authenticated in Sahihayn, the non-accepted narrations are kept apart in a collapsed section.

import { matnOverlap, matnTokens, normalizeArabic } from "./arabic";
import type { Grade } from "./gradeMap";
import type { GradedNarration } from "./hadithMatch";

export enum BookTier {
  Sahihayn = 1, // صحيح البخاري، صحيح مسلم
  SunanArbaa = 2, // سنن أبي داود، الترمذي، النسائي، ابن ماجه
  Other = 3, // بقية الكتب
}

const SAHIHAYN_SET = new Set(["صحيح البخاري", "صحيح مسلم"].map(normalizeArabic));

/** Strict check for Sahih al-Bukhari or Sahih Muslim itself. */
export function isSahihayn(source?: string): boolean {
  if (!source) return false;
  return SAHIHAYN_SET.has(normalizeArabic(source.trim()));
}

// Exact names only. A keyword match also took «المراسيل لأبي داود», «سؤالات أبي داود», «حاشية السندي على النسائي»,
// «شرح علل الترمذي»… (26 books of Dorar's 773 for the four names).
const SUNAN = ["سنن أبي داود", "سنن الترمذي", "جامع الترمذي", "سنن النسائي", "سنن ابن ماجه", "سنن ابن ماجة"];
const SUNAN_VERDICT_BOOKS = ["أبي داود", "الترمذي", "النسائي", "ابن ماجه", "ابن ماجة"].flatMap((b) => [`صحيح ${b}`, `ضعيف ${b}`]);
const SUNAN_SET = new Set([...SUNAN, ...SUNAN_VERDICT_BOOKS].map(normalizeArabic));

/** Determines the authority tier of a book source. */
export function getBookTier(source?: string): BookTier {
  if (!source) return BookTier.Other;
  const s = normalizeArabic(source.trim());
  if (SAHIHAYN_SET.has(s)) return BookTier.Sahihayn;
  if (SUNAN_SET.has(s)) return BookTier.SunanArbaa;
  return BookTier.Other;
}

const PROMINENT_SCHOLARS = [
  "ابن حجر",
  "الذهبي",
  "ابن كثير",
  "أحمد شاكر",
  "شعيب الأرنؤوط",
  "شعيب الأرناؤوط", // Dorar's spelling
  "النووي",
  "ابن تيمية",
  "ابن القيم",
  "ابن عبد البر",
  "العراقي",
  "الهيثمي",
  "الدارقطني",
  "ابن خزيمة",
  "ابن حبان",
  "البيهقي",
  "الحاكم",
].map(normalizeArabic);

const ALBANI_NORMALIZED = normalizeArabic("الألباني");

/**
 * Priority score for scholars:
 * Sheikh Al-Albani = 100
 * Prominent imams and muhaqqiqin = 50
 * Other scholars = 10
 * None = 0
 */
export function getScholarPriority(muhaddith?: string): number {
  if (!muhaddith) return 0;
  const m = normalizeArabic(muhaddith.trim());
  if (!m || m === "-") return 0;

  if (m.includes(ALBANI_NORMALIZED)) return 100;
  if (PROMINENT_SCHOLARS.some((p) => m.includes(p))) return 50;
  return 10;
}

const cleanLetters = (s: string) => normalizeArabic(s).replace(/[^ء-ي\s]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Measures how closely and completely a narration matches the user's query text.
 * Returns a score in [0, 1].
 */
export function calculateTextCloseness(query: string, matn: string): number {
  const qClean = cleanLetters(query);
  const mClean = cleanLetters(matn);
  if (!qClean || !mClean) return 0;

  const qTok = matnTokens(query);
  const mTok = matnTokens(matn);
  if (qTok.size === 0) return 0;

  const matchedTokens = [...qTok].filter((w) => mTok.has(w)).length;
  const coverage = matchedTokens / qTok.size; // share of user query words found in matn
  const overlap = matnOverlap(qTok, mTok) ?? 0;
  // Only a narration that holds the whole text earns this: a mere fragment of the query is not «close».
  const contained = mClean.includes(qClean);

  return Math.min(1, coverage * 0.7 + (contained ? 0.2 : 0) + overlap * 0.1);
}

/** Below this closeness a narration covers too little of the user's text to keep its book-tier advantage. */
export const MIN_TIER_CLOSENESS = 0.5;
/** A Sahihayn narration only counts as «this text» when it is at most this far from the closest narration. */
const SAHIHAYN_CLOSENESS_MARGIN = 0.2;

export interface RankedResults {
  /** The primary narration to highlight in the main card */
  primary: GradedNarration;
  /** Secondary narrations for "Other results" */
  secondary: GradedNarration[];
  /** Non-accepted narrations kept apart when the hadith is authenticated in Sahihayn */
  weakVariants: GradedNarration[];
  /** All acceptable narrations in ranked order */
  allRanked: GradedNarration[];
  /** Whether the hadith is authenticated in Sahihayn */
  inSahihayn: boolean;
}

const GRADE_ORDER: Record<Grade, number> = {
  "مقبول": 0,
  "غير حاسم": 1,
  "ضعيف": 2,
  "شديد الضعف أو لا أصل له": 3,
};

/**
 * Sort key of a narration for one query. Lower is better.
 * Grade first, then tier (a narration under MIN_TIER_CLOSENESS sorts as if it were in an «other» book),
 * then closeness (differences under 0.08 count as equal), then the muhaddith.
 */
function narrationComparator(query: string) {
  const closeness = new Map<GradedNarration, number>();
  const close = (n: GradedNarration) => {
    let c = closeness.get(n);
    if (c === undefined) closeness.set(n, (c = calculateTextCloseness(query, n.matn)));
    return c;
  };
  const tier = (n: GradedNarration) => (close(n) < MIN_TIER_CLOSENESS ? BookTier.Other : getBookTier(n.source));

  return (a: GradedNarration, b: GradedNarration) => {
    const gDiff = GRADE_ORDER[a.grade] - GRADE_ORDER[b.grade];
    if (gDiff !== 0) return gDiff;

    const tDiff = tier(a) - tier(b);
    if (tDiff !== 0) return tDiff;

    const scoreDiff = close(b) - close(a);
    if (Math.abs(scoreDiff) > 0.08) return scoreDiff;

    return getScholarPriority(b.muhaddith) - getScholarPriority(a.muhaddith);
  };
}

/**
 * Comprehensive ranking and filtering for Dorar results.
 * The primary narration is the first of the ranked list, so a weak verdict of Al-Albani never outranks an accepted one.
 */
export function rankAndFilterDorarResults(query: string, narrations: GradedNarration[]): RankedResults {
  if (!narrations.length) {
    throw new Error("Cannot rank an empty list of narrations");
  }

  const bestCloseness = Math.max(...narrations.map((n) => calculateTextCloseness(query, n.matn)));
  const inSahihayn = narrations.some(
    (n) =>
      isSahihayn(n.source) &&
      n.grade === "مقبول" &&
      calculateTextCloseness(query, n.matn) >= bestCloseness - SAHIHAYN_CLOSENESS_MARGIN,
  );

  const cmp = narrationComparator(query);
  const mainGroup = (inSahihayn ? narrations.filter((n) => n.grade === "مقبول") : [...narrations]).sort(cmp);
  const weakVariants = inSahihayn ? narrations.filter((n) => n.grade !== "مقبول").sort(cmp) : [];

  const [primary, ...secondary] = mainGroup;
  return { primary, secondary, weakVariants, allRanked: mainGroup, inSahihayn };
}

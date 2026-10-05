// From Dorar's answer (always 15 results, even for invented text) keep only the narrations that are this text,
// grade each muhaddith's verdict with the specialist's rules, and summarize.
import { matnOverlap, matnTokens, normalizeArabic } from "./arabic";
import type { DorarResult } from "./dorar";
import { classifyVerdict, displayGrade, GRADES, type Grade } from "./gradeMap";
import { getBookTier } from "./hadithRanking";
import type { TurathPassage } from "./turathApi";

export const MAX_TURATH_PASSAGE_CHARS = 1_500;

export interface TurathReference {
  excerpt: string;
  citation: string;
  book: { id: string; title: string };
  author?: { id?: string; name?: string };
  /** Canonical Turath book ID from the source locator. */
  bookId: string;
  /** Keep Turath's internal page separate from a printed page number. */
  pageLocator?: { internalPage?: number; printedPage?: number; volume?: string };
  url: string;
  /** Turath's own order: 0 = the best match of its category */
  provenance?: { rank: number; totalMatches: number; truncated: boolean };
  /** The server's signature on this excerpt (turathSign.ts): only a signed excerpt can be sent to /api/translate. */
  sig?: string;
  /** The Turath category the passage was searched in (the book's type shown to the reader). */
  category?: { id: string; title: string };
}

export type TurathLookupOutcome =
  /** `partial`: some of the category searches failed, so «no reference» is not conclusive. */
  | { status: "success"; references: TurathReference[]; partial?: true }
  | { status: "unavailable"; references: [] };

/** Purely adapts Turath passages for our response/UI; it never turns a source into a hadith grade. */
export function adaptTurathPassages(passages: TurathPassage[], category?: { id: string; title: string }): TurathReference[] {
  const seenPages = new Set<string>();
  const references: TurathReference[] = [];
  const ranked = passages.map((passage, index) => ({ passage, index })).sort((a, b) => a.passage.rank - b.passage.rank || a.index - b.index);

  for (const { passage } of ranked) {
    const bookId = passage.book.id;
    const { internalPage, printedPage, volume } = passage.location;
    if (internalPage !== undefined) {
      const key = `${bookId}:${internalPage}`;
      if (seenPages.has(key)) continue;
      seenPages.add(key);
    }

    const pageLocator =
      internalPage !== undefined || printedPage !== undefined || volume !== undefined
        ? {
            ...(internalPage !== undefined ? { internalPage } : {}),
            ...(printedPage !== undefined ? { printedPage } : {}),
            ...(volume !== undefined ? { volume } : {}),
          }
        : undefined;
    // the lookup is already bounded; the cap is enforced again at this boundary
    const excerpt = passage.text.slice(0, MAX_TURATH_PASSAGE_CHARS).replace(/[�-�]$/, "");

    references.push({
      excerpt,
      citation: passage.citation,
      book: { id: passage.book.id, title: passage.book.title },
      ...(passage.author ? { author: { ...passage.author } } : {}),
      bookId,
      ...(pageLocator ? { pageLocator } : {}),
      url: passage.url || "https://app.turath.io/",
      provenance: { rank: passage.rank, totalMatches: passage.totalMatches, truncated: passage.truncated },
      ...(category ? { category: { ...category } } : {}),
    });
  }

  return references;
}

export interface GradedNarration extends DorarResult {
  /** Visible wording difference; does not change the narration's grade. */
  textVariant?: "additional" | "different";
  scope?: "isnad" | "hadith" | "narrator";
  grade: Grade;
  confidence: "high" | "medium" | "low";
  caution: boolean;
  /** why this narration was taken to be the same text */
  matchedBy: "contained" | "overlap" | "all-words";
}

const letters = (s: string) => normalizeArabic(s).replace(/[^ء-ي\s]/g, " ").replace(/\s+/g, " ").trim();

/** A named day/prayer in the quotation must occur in the retrieved text.
 * This catches the observed Thursday/Asr vs Maghrib mismatch without changing
 * the existing coverage threshold. It is not a general semantic verifier. */
function preservesExplicitContext(query: string, matn: string): boolean {
  const required = query.match(/(?<![ء-ي])(?:الاحد|الاثنين|الثلاثاء|الاربعاء|الخميس|الجمعه|السبت|الفجر|الظهر|العصر|المغرب|العشاء)(?![ء-ي])/g) ?? [];
  const sourceWords = new Set(matn.split(" "));
  return required.every((word) => sourceWords.has(word));
}

/**
 * A narration is this text when one contains the other, when it has most of THE POST'S content words, or (for a
 * short text) all of its words. Coverage is measured on the post's words, not on the smaller of the two sets:
 * measured on the smaller set, «اطلبوا العلم من المهد إلى اللحد» took the «اطلبوا العلم ولو بالصين» narrations
 * (live case, 2026-10-04).
 */
export function selectRelevant(query: string, results: DorarResult[], minCoverage = 0.6): GradedNarration[] {
  const q = letters(query);
  if (!q) return [];
  const qTok = matnTokens(query);
  const qWords = q.split(" ").filter((w) => w.length >= 3);
  const out: GradedNarration[] = [];
  for (const r of results) {
    const m = letters(r.matn);
    if (!preservesExplicitContext(q, m)) continue;
    const mTok = matnTokens(r.matn);
    const coverage = qTok.size >= 3 && mTok.size >= 3 ? [...qTok].filter((w) => mTok.has(w)).length / qTok.size : null;
    const contained = m.includes(q) || (m.split(" ").length >= 3 && q.includes(m));
    const matchedBy = contained
      ? "contained"
      // With only three content words, two shared nouns do not identify a narration:
      // «أرسل ... عشرة ... الجنة» must not match «عشرة في الجنة» while losing the action.
      : coverage !== null && coverage >= (qTok.size <= 3 ? 1 : minCoverage) && (matnOverlap(qTok, mTok) ?? 0) >= minCoverage
        ? "overlap"
        : coverage === null && qWords.length > 0 && qWords.every((w) => m.includes(w))
          ? "all-words"
          : null;
    if (!matchedBy) continue;
    const textVariant = m === q ? undefined : ` ${m} `.includes(` ${q} `) ? "additional" as const : "different" as const;
    const g = classifyVerdict(r.verdict ?? "", r.muhaddith ?? "");
    out.push({ ...r, ...(textVariant ? { textVariant } : {}), scope: g.scope, grade: g.grade, confidence: g.confidence, caution: displayGrade(g).caution, matchedBy });
  }
  return out;
}

export interface GradeSummary {
  grade: Grade;
  counts: Record<Grade, number>;
  /** how the summary was reached, for the card and the review queue */
  basis: string;
  /** some muhaddithun accept it and others weaken it: the card says so and shows the minority too */
  disputed: boolean;
  /** one of the matching narrations is in Sahih al-Bukhari or Sahih Muslim */
  inSahihayn: boolean;
}

const SEVERITY: Record<Grade, number> = { "شديد الضعف أو لا أصل له": 3, ضعيف: 2, مقبول: 1, "غير حاسم": 0 };

/** Only the two Sahihs themselves: not «شرح البخاري…», «التاريخ الكبير», «المستدرك على الصحيحين», nor
 *  «أحاديث من صحيح البخاري أعلها الدارقطني», which contains the name but is a book of criticism (all seen in Dorar). */
const SAHIHAYN_SOURCES = new Set(["صحيح البخاري", "صحيح مسلم"].map(normalizeArabic));
export const inSahihayn = (n: DorarResult): boolean => SAHIHAYN_SOURCES.has(normalizeArabic((n.source ?? "").trim()));

/**
 * One state from several muhaddithun (the specialist's decision, 2026-10-04):
 * - a text whose narration is in Sahih al-Bukhari or Sahih Muslim is مقبول, with no "disputed" caution;
 * - otherwise the grade most of them gave (غير حاسم not counted); on a tie the grade given in the higher book tier
 *   wins (decision of 2026-10-04), then the more severe grade; the card warns when acceptance and weakness are both
 *   present;
 * - no explicit verdict → غير حاسم.
 */
export function summarizeGrades(items: GradedNarration[]): GradeSummary {
  const counts = Object.fromEntries(GRADES.map((g) => [g, 0])) as Record<Grade, number>;
  for (const it of items) counts[it.grade]++;
  if (items.some(inSahihayn)) return { grade: "مقبول", counts, basis: "في صحيح البخاري أو صحيح مسلم", disputed: false, inSahihayn: true };
  const graded = GRADES.filter((g) => g !== "غير حاسم" && counts[g] > 0);
  if (!graded.length) return { grade: "غير حاسم", counts, basis: "لا حكم صريح بين النتائج المطابقة", disputed: false, inSahihayn: false };
  const bestTier = (g: Grade) => Math.min(...items.filter((it) => it.grade === g).map((it) => getBookTier(it.source)));
  const grade = graded.reduce((a, b) => {
    if (counts[b] !== counts[a]) return counts[b] > counts[a] ? b : a;
    if (bestTier(b) !== bestTier(a)) return bestTier(b) < bestTier(a) ? b : a;
    return SEVERITY[b] > SEVERITY[a] ? b : a;
  });
  const disputed = counts["مقبول"] > 0 && counts["ضعيف"] + counts["شديد الضعف أو لا أصل له"] > 0;
  return { grade, counts, basis: `أكثر المحدثين (${counts[grade]} من ${graded.reduce((n, g) => n + counts[g], 0)})`, disputed, inSahihayn: false };
}

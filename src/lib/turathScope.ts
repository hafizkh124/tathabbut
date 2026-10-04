// Which Turath book categories are searched for which kind of claim (specialist's decision, 2026-10-04).
// An unfiltered search buried the books under lectures, fatwa sites and manuscript catalogues (live probe: «إنما الأعمال
// بالنيات» returned no Bukhari or Muslim in its first ten), while a category filter returned the books. Turath accepts
// ONE category per search, so a kind with several categories is searched with several parallel requests; the passage
// is labelled with the category it was found in.
// Category ids are Turath's own (Turath's category list, read 2026-10-05).

export interface TurathCategory {
  id: string;
  title: string;
}

export const CATEGORIES = {
  sunnah: { id: "6", title: "كتب السنة" },
  raqaiq: { id: "23", title: "الرقائق والآداب والأذكار" },
  history: { id: "25", title: "التاريخ" },
  tarajim: { id: "26", title: "التراجم والطبقات" },
  hanafi: { id: "14", title: "الفقه الحنفي" },
  maliki: { id: "15", title: "الفقه المالكي" },
  shafii: { id: "16", title: "الفقه الشافعي" },
  hanbali: { id: "17", title: "الفقه الحنبلي" },
  fatawa: { id: "22", title: "الفتاوى" },
} as const satisfies Record<string, TurathCategory>;

/** hadith / scholar_quote: the asked TEXT is looked for. fiqh: a TOPIC (a few words from a question) is looked for. */
export type TurathLookupKind = "hadith" | "scholar_quote" | "fiqh";

export const SCOPES: Record<TurathLookupKind, readonly TurathCategory[]> = {
  hadith: [CATEGORIES.sunnah],
  // a saying of a companion or scholar is recorded in many kinds of books
  scholar_quote: [CATEGORIES.sunnah, CATEGORIES.raqaiq, CATEGORIES.tarajim, CATEGORIES.history],
  // general fiqh: one search per madhhab (so each school speaks in its own books), and the fatwa collections (specialist, 2026-10-05)
  fiqh: [CATEGORIES.hanafi, CATEGORIES.maliki, CATEGORIES.shafii, CATEGORIES.hanbali, CATEGORIES.fatawa],
};

/**
 * How a kind is searched. `fetch`: passages asked of Turath per category. `keep`: passages kept per category. `total`: passages
 * kept in all. `strict`: a passage must hold the asked text (a text); otherwise (a topic) the passages that hold it as a phrase
 * come first and Turath's own order follows, because its search needs every word but not near each other.
 */
export const LOOKUP_LIMITS: Record<TurathLookupKind, { fetch: number; keep: number; total: number; strict: boolean }> = {
  hadith: { fetch: 10, keep: 10, total: 10, strict: true },
  scholar_quote: { fetch: 10, keep: 10, total: 10, strict: true },
  fiqh: { fetch: 10, keep: 2, total: 10, strict: false },
};

export const isLookupKind = (k: unknown): k is TurathLookupKind => k === "hadith" || k === "scholar_quote" || k === "fiqh";

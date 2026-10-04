// Which Turath book categories are searched for which kind of claim (specialist's decision, 2026-10-04).
// An unfiltered search buried the books under lectures, fatwa sites and manuscript catalogues (live probe: «إنما الأعمال
// بالنيات» returned no Bukhari or Muslim in its first ten), while a category filter returned the books. Turath accepts
// ONE category per search, so a kind with several categories is searched with several parallel requests; the passage
// is labelled with the category it was found in.
// Category ids are Turath's own (nusus catalogue, scanned 2026-03-23).

export interface TurathCategory {
  id: string;
  title: string;
}

export const CATEGORIES = {
  sunnah: { id: "6", title: "كتب السنة" },
  raqaiq: { id: "23", title: "الرقائق والآداب والأذكار" },
  history: { id: "25", title: "التاريخ" },
  tarajim: { id: "26", title: "التراجم والطبقات" },
} as const satisfies Record<string, TurathCategory>;

export type TurathLookupKind = "hadith" | "scholar_quote";

export const SCOPES: Record<TurathLookupKind, readonly TurathCategory[]> = {
  hadith: [CATEGORIES.sunnah],
  // a saying of a companion or scholar is recorded in many kinds of books
  scholar_quote: [CATEGORIES.sunnah, CATEGORIES.raqaiq, CATEGORIES.tarajim, CATEGORIES.history],
};

export const isLookupKind = (k: unknown): k is TurathLookupKind => k === "hadith" || k === "scholar_quote";

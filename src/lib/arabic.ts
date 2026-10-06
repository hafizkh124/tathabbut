// Arabic normalization and matn token overlap.

/** Narration boilerplate that says nothing about which hadith it is. */
export const COMMON_WORDS: ReadonlySet<string> = new Set([
  "قال", "قالت", "قالوا", "رسول", "الله", "النبي", "عليه", "وسلم", "صلي",
  "حدثنا", "حدثني", "اخبرنا", "اخبرني", "سمعت", "روي", "عنه", "عنها",
  "رضي", "بن", "ابن", "ابي", "عبد", "كان", "كانت", "الذي", "التي", "علي",
  "الي", "من", "في", "عن", "انه", "انها", "هذا", "هذه", "ذلك",
]);

/** Strip tashkeel and Quranic marks; fold alif forms, alif maqsura, ta marbuta and hamza carriers. */
export function normalizeArabic(text: string): string {
  if (!text) return "";
  return text
    .replace(/[ً-ٰٟۖ-ۜ۟-۪ۨ-ۭـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

/** Content words of a matn: normalized, boilerplate removed, short tokens dropped. */
export function matnTokens(text: string): Set<string> {
  return new Set(
    normalizeArabic(text)
      .split(/[\s،.:؛()«»"'\-\[\]]+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 3 && !COMMON_WORDS.has(w)),
  );
}

/**
 * Content-word overlap normalized by the smaller set, so an abridged narration still
 * matches its fuller version. `null` when either side is too short to judge.
 */
export function matnOverlap(a: ReadonlySet<string>, b: ReadonlySet<string>): number | null {
  if (a.size < 3 || b.size < 3) return null;
  let shared = 0;
  for (const w of b) if (a.has(w)) shared++;
  return shared / Math.min(a.size, b.size);
}

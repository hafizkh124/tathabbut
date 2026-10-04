// Turath's passage text is a page of a book with a little HTML left in it (live: «&quot;» shown on the screen). These
// helpers clean it for display and find the asked phrase inside it so the reader's eye lands on it.
import { normalizeArabic } from "./arabic";

const NAMED: Record<string, string> = { quot: '"', amp: "&", lt: "<", gt: ">", apos: "'", nbsp: " " };

/** Tags removed first, then entities decoded, so «&lt;» in the text stays a «<» and is not read as a tag. */
export function cleanTurathText(s: string): string {
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
      }
      return NAMED[e.toLowerCase()] ?? m;
    });
}

const letters = (w: string) => normalizeArabic(w).replace(/[^ء-ي]/g, "");

/** The character range of the first place the whole phrase stands in the text, ignoring diacritics and punctuation; else null. */
export function findPhrase(text: string, phrase: string): [number, number] | null {
  const words = phrase.split(/\s+/).map(letters).filter(Boolean);
  if (!words.length) return null;
  const tokens: { w: string; start: number; end: number }[] = [];
  for (const m of text.matchAll(/\S+/g)) {
    const w = letters(m[0]);
    if (w) tokens.push({ w, start: m.index, end: m.index + m[0].length });
  }
  for (let i = 0; i + words.length <= tokens.length; i++) {
    if (words.every((w, k) => tokens[i + k].w === w)) return [tokens[i].start, tokens[i + words.length - 1].end];
  }
  return null;
}

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

/** Little words that say nothing about which passage this is; they never count towards a near match on their own. */
const STOP = new Set(["في", "من", "على", "الى", "عن", "ان", "او", "ما", "لا", "قال", "هو", "هي", "ثم", "قد", "كل", "به", "له"]);

/**
 * Where the reader should look: the whole phrase if it stands in the text (findPhrase), otherwise the shortest stretch that
 * holds the most of its words — at least two of them and at least half — so a passage matched on most of its words is still
 * marked. Null when nothing comes close enough.
 */
export function findClosest(text: string, phrase: string): [number, number] | null {
  const exact = findPhrase(text, phrase);
  if (exact) return exact;
  const wanted = Array.from(new Set(phrase.split(/\s+/).map(letters).filter((w) => w && !STOP.has(w))));
  if (wanted.length < 2) return null;
  const need = Math.max(2, Math.ceil(wanted.length / 2));
  const tokens: { w: string; start: number; end: number }[] = [];
  for (const m of text.matchAll(/\S+/g)) {
    const w = letters(m[0]);
    if (w) tokens.push({ w, start: m.index, end: m.index + m[0].length });
  }
  const reach = wanted.length * 2;
  let best: { n: number; i: number; j: number } | null = null;
  for (let i = 0; i < tokens.length; i++) {
    if (!wanted.includes(tokens[i].w)) continue;
    const seen = new Set<string>();
    for (let j = i; j < tokens.length && j - i < reach; j++) {
      if (!wanted.includes(tokens[j].w)) continue;
      seen.add(tokens[j].w);
      if (!best || seen.size > best.n || (seen.size === best.n && j - i < best.j - best.i)) best = { n: seen.size, i, j };
    }
  }
  return best && best.n >= need ? [tokens[best.i].start, tokens[best.j].end] : null;
}

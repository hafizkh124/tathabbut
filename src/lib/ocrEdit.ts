// Fixing one unsure word of a text read from a picture, without opening the whole text for editing.
// Pure functions (the screen is src/components/TextConfirm.tsx); nothing here is sent or stored.
import type { Piece } from "./highlight";

/** The text with piece `index` replaced by `next`; every other character is kept. An empty `next` removes the word. */
export function replacePiece(pieces: Piece[], index: number, next: string): string {
  return pieces.map((p, i) => (i === index ? next : p.text)).join("");
}

/** The unsure words still to look at: those the person has not accepted as they are. */
export function stillUnsure(uncertain: string[], accepted: ReadonlySet<string>): string[] {
  return uncertain.filter((w) => !accepted.has(w.trim()));
}

/** Hides the extra spaces left when a word is removed or typed with spaces around it, but only around `next`'s edges
 *  (the rest of the reading, with its line breaks, is not touched). */
export function cleanWord(next: string): string {
  return next.replace(/[\r\n]+/g, " ").trim();
}

/** Undo history: each text before an edit, newest last. Capped so a long session cannot grow it without bound. */
export function pushHistory(history: string[], previous: string, max = 50): string[] {
  if (history[history.length - 1] === previous) return history;
  const next = [...history, previous];
  return next.length > max ? next.slice(next.length - max) : next;
}

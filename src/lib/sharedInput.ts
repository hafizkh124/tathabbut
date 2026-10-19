// What another app shared to Tathabbut (the share sheet, see manifest.ts): the fields as the browser hands them over, turned
// into the one text the person would have pasted. Pure, so it can be tested; public/sw.js and share-target/route.ts use the
// same field names and cache keys.

import { foldUrdu } from "./arabic";

/** Where public/sw.js keeps a share until the page picks it up; the page empties it straight after. */
export const SHARE_CACHE = "tathabbut-share";
export const SHARED_TEXT_KEY = "/__shared/text";
export const SHARED_IMAGE_KEY = "/__shared/image";

export interface SharedFields {
  title?: string | null;
  text?: string | null;
  url?: string | null;
}

/**
 * One text from the shared fields. WhatsApp puts the whole message in `text`; other apps split it into a title and a link,
 * or repeat the link inside the text. Each part is kept once, in the order title, text, link; a title that the text already
 * begins with (a page sharing its own heading) is dropped.
 */
export function sharedText({ title, text, url }: SharedFields): string {
  const t = title?.trim() ?? "";
  const body = text?.trim() ?? "";
  const link = url?.trim() ?? "";
  const parts: string[] = [];
  if (t && !body.startsWith(t)) parts.push(t);
  if (body) parts.push(body);
  if (link && !body.includes(link)) parts.push(link);
  return parts.join("\n");
}

/** The words of a text, Urdu and Arabic letters folded together, without tashkeel, digits and marks. */
const words = (text: string) => foldUrdu(text).split(/[^\p{L}]+/u).filter((w) => w.length > 1);

/** The share of `a`'s words that `b` also has. */
const covered = (a: string[], b: string[]) => {
  const have = new Set(b);
  return a.length ? a.filter((w) => have.has(w)).length / a.length : 1;
};

/** How much of one text the other must hold for the two to be taken as the same words. */
const SAME = 0.8;

/**
 * The text to check when a picture comes with a caption. WhatsApp often sends a post as an image with the same words as
 * its caption; the reading and the caption then differ only in marks, Urdu or Arabic letter forms («ی» or «ي»), «ﷺ»
 * against «صلی اللہ علیہ وسلم», and the picture's own watermark words (team lead's tests, 2026-10-19: the one text came
 * back as two claims). Same words: one of them is used (the longer); different words: both.
 */
export function mergeCaption(reading: string, caption: string): string {
  const c = words(caption);
  if (!c.length) return reading;
  const r = words(reading);
  if (covered(c, r) >= SAME) return reading; // the picture already says it
  if (covered(r, c) >= SAME) return caption.trim().length > reading.trim().length ? caption : reading; // the caption is the fuller text
  return `${reading}
${caption}`;
}

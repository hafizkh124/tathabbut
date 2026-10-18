// What another app shared to Tathabbut (the share sheet, see manifest.ts): the fields as the browser hands them over, turned
// into the one text the person would have pasted. Pure, so it can be tested; public/sw.js and share-target/route.ts use the
// same field names and cache keys.

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

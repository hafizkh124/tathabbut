// The links under «Via» (عبر / بواسطہ): only the site a text was actually read from, and each link opens the very place.
// Checked by hand on 2026-10-05: quranpedia's verse page is /surah/1/{surah}/{ayah} (the old /quran/{s}:{a} gave 404), and a
// Turath book id and page key open the same page on Shamela (/book/{id}/{page}: 3 of 3 books compared, same text).

export const quranpediaUrl = (surah: number, ayah: number) => `https://quranpedia.net/surah/1/${surah}/${ayah}`;

export const shamelaPageUrl = (bookId: string, internalPage: number) => `https://shamela.ws/book/${bookId}/${internalPage}`;

/** Sites a reference in the specialist's list may point to, with the name shown for them. */
const SITES: Record<string, "via.alulama"> = { "alulama.org": "via.alulama" };

/** A reference that ends with a web address: the address goes under «Via», the rest stays as the reference. */
export function splitReferenceUrl(reference: string): { text: string; url?: string; site?: "via.alulama"; host?: string } {
  const m = reference.match(/https?:\/\/[^\s،,]+/);
  if (!m) return { text: reference };
  const url = m[0].replace(/[.)\]]+$/, "");
  const text = reference.replace(m[0], "").replace(/[\s،,]+$/, "").replace(/^[\s،,]+/, "").replace(/\s{2,}/g, " ");
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return { text: reference };
  }
  return { text, url, host, site: SITES[host] };
}

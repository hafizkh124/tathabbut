// Cleaning for the quranpedia translation dumps (ids 1966 Urdu / 1948 English, King Fahd Complex).
// Each `translated_text` there is: the ayah's translation, then `<br />____…<br />`, then the
// translators' footnotes. Only the translation is used; the footnotes (tafsir remarks and
// hadith we have not reviewed) stay out of the product. The raw text is kept by the caller.

const FOOTNOTE_SEPARATOR = /<br\s*\/?>\s*_{5,}\s*<br\s*\/?>/i;
/** Tags that break the flow of text; inline ones (span, strong) are dropped without a gap. */
const BLOCK_TAG = /<\/?(?:br|td|tr|th|table|tbody|h[1-6]|p|div|li|ul|ol)\b[^>]*>/gi;
const ANY_TAG = /<[^>]+>/g;

export type TranslationLang = "ur" | "en";

export function cleanTranslation(raw: string, lang: TranslationLang): string {
  let text = raw.split(FOOTNOTE_SEPARATOR)[0];
  // A stray ">" is left at the end of the Urdu of 4:106 and 7:21 in the source.
  text = text.replace(BLOCK_TAG, " ").replace(ANY_TAG, "").replace(/[<>]/g, "").replace(/ /g, " ");
  // The English dump prefixes each ayah with its own number ("255. Allâh!…").
  if (lang === "en") text = text.replace(/^\s*\d+\.\s*/, "");
  // Footnote call-outs: "*" in the Urdu, "[3]" in the English. Parenthetical glosses are translation.
  text = text.replace(/\*+/g, "").replace(/\[\d+\]/g, "");
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?)،۔؛؟])/g, "$1")
    .trim();
}

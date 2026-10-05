import { normalizeArabic } from "./arabic";
import type { Locale } from "./i18n/dict";

/** The Sahihayn's own records are attributed as inclusion in the book, not a spoken verdict.
 * Other scholars' judgements on these books keep their own attribution. */
export function sahihAttribution(n: { source?: string; muhaddith?: string }, locale: Locale): string | null {
  const source = normalizeArabic(n.source ?? "");
  const scholar = normalizeArabic(n.muhaddith ?? "");
  const imam = source === "صحيح البخاري" && scholar === "البخاري" ? "bukhari"
    : source === "صحيح مسلم" && scholar === "مسلم" ? "muslim" : null;
  if (!imam) return null;
  const name = imam === "bukhari" ? { ar: "البخاري", ur: "بخاری", en: "al-Bukhari" } : { ar: "مسلم", ur: "مسلم", en: "Muslim" };
  return locale === "ur" ? `امام ${name.ur} نے اپنی صحیح میں روایت کیا ہے۔`
    : locale === "ar" ? `أخرجه الإمام ${name.ar} في صحيحه.` : `Imam ${name.en} narrated it in his Sahih.`;
}

export const isDorarAddition = (verdict: string | undefined): boolean => /^\s*\[[\s\S]+\]\s*$/.test(verdict ?? "");

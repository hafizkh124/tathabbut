// The text that goes to the clipboard / the share sheet: each claim, its result, and where it comes from. Plain text, so it pastes into WhatsApp.
import type { ClaimResult } from "./clientTypes";
import { dorarSearchUrl } from "./dorarLink";
import { stateLabel, translate, type Locale } from "./i18n/dict";
import { sahihAttribution } from "./sahihAttribution";
import { matchedArabic } from "./matchedArabic";
import { quranpediaUrl, splitReferenceUrl } from "./viaLinks";

export const APP_URL = "https://tathabbut-rho.vercel.app";

/** The data holds «سورة البقرة»; the sentence adds the word «سورة» itself, in the user's language. */
export const plainSurah = (name: string) => name.replace(/^سورة\s+/, "");

/** The first place a result can be traced to, as one line: book and page for a hadith, surah and verse for the Quran. */
export function sourceLine(r: ClaimResult, locale: Locale): string | null {
  if (r.verse) {
    const surah = plainSurah(r.verse.surahName);
    return locale === "en" ? `Surah ${surah}, verse ${r.verse.ayah}` : locale === "ur" ? `سورہ ${surah}، آیت ${r.verse.ayah}` : `سورة ${surah}، الآية ${r.verse.ayah}`;
  }
  const n = r.dorar?.narrations[0];
  if (n?.source) return [n.source, n.reference].filter(Boolean).join(" — ");
  if (r.saying?.reference) return splitReferenceUrl(r.saying.reference).text;
  const book = r.turath && r.turath.status === "success" ? r.turath.references[0]?.book.title : undefined;
  return book ?? null;
}

/** The link a reader can open to check a result: the verse's page, the hadith in its book on Dorar, or the article a list entry cites. */
export function sourceUrl(r: ClaimResult): string | null {
  if (r.verse) return quranpediaUrl(r.verse.surah, r.verse.ayah);
  const n = r.dorar?.narrations[0];
  if (n?.matn) return dorarSearchUrl(n.matn, n.source);
  if (r.dorar?.externalUrls?.dorar) return r.dorar.externalUrls.dorar;
  if (r.saying) return splitReferenceUrl(r.saying.reference ?? "").url ?? r.saying.externalUrls?.dorar ?? null;
  return null;
}

/**
 * The short text for WhatsApp and the like (specialist, 2026-10-05): per claim its words, the result, the source with its
 * scholar, the correct form of a misquoted verse, and a link to check it; the details stay in the app, so no wording-variant
 * or narrator-criticism notes here. The app's address closes it.
 */
export function buildShareText(results: ClaimResult[], locale: Locale): string {
  const blocks = results.map((r) => {
    const quote = r.claim.arabicSpan || r.claim.textAsWritten;
    const lines = [`«${quote}»`, `${translate(locale, "share.grade")}: ${stateLabel(r.state, locale, true)}`];
    const n = r.dorar?.narrations[0];
    const src = sourceLine(r, locale);
    if (src) lines.push(`${translate(locale, "label.source")}: ${src}`);
    if (n?.muhaddith) lines.push(`${translate(locale, "label.scholar")}: ${n.muhaddith}`);
    const arabic = matchedArabic(r);
    if (arabic) lines.push(`${translate(locale, "label.matchedArabic")}: ${arabic}`, translate(locale, "note.translationMatch"));
    if (n?.scope === "isnad" && /هالك/.test(n.verdict ?? "")) lines.push(translate(locale, "note.halikIsnad"));
    const attribution = n && sahihAttribution(n, locale);
    if (attribution) lines.push(attribution);
    if (r.verse?.wording?.contextOmitted) lines.push(translate(locale, "verse.contextWarning"));
    if (r.verse && (r.verse.wording?.contextOmitted || r.verse.wording?.exact === false)) lines.push(`${translate(locale, "label.mushaf")}: ${r.verse.text}`);
    if (r.saying?.correct_text) lines.push(`${translate(locale, "label.correct")}: ${r.saying.correct_text}`);
    if (r.claim.kind === "question" && r.claim.scope !== "general") lines.push(translate(locale, "fatwa.warn"));
    const url = sourceUrl(r);
    if (url) lines.push(`${translate(locale, "share.link")}: ${url}`);
    return lines.join("\n");
  });
  return `${blocks.join("\n\n")}\n\n${translate(locale, "share.footer")}: ${APP_URL}`;
}

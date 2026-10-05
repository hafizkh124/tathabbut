// The text that goes to the clipboard / the share sheet: each claim, its result, and where it comes from. Plain text, so it pastes into WhatsApp.
import type { ClaimResult } from "./clientTypes";
import { stateLabel, translate, type Locale } from "./i18n/dict";
import { isDorarAddition, sahihAttribution } from "./sahihAttribution";
import { matchedArabic } from "./matchedArabic";

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
  if (r.saying?.reference) return r.saying.reference;
  const book = r.turath && r.turath.status === "success" ? r.turath.references[0]?.book.title : undefined;
  return book ?? null;
}

export function buildShareText(results: ClaimResult[], locale: Locale, appName = "تَثَبُّت"): string {
  const blocks = results.map((r) => {
    const quote = r.claim.arabicSpan || r.claim.textAsWritten;
    const lines = [`«${quote}»`, stateLabel(r.state, locale, true)];
    const src = sourceLine(r, locale);
    if (src) lines.push(src);
    const n = r.dorar?.narrations[0];
    const arabic = matchedArabic(r);
    if (arabic) lines.push(`${translate(locale, "label.matchedArabic")}: ${arabic}`, translate(locale, "note.translationMatch"));
    if (n?.scope === "isnad" && /هالك/.test(n.verdict ?? "")) lines.push(translate(locale, "note.halikIsnad"));
    if (n?.scope === "narrator") {
      if (n.muhaddith) lines.push(`${translate(locale, "label.scholar")}: ${n.muhaddith}`);
      if (n.verdict) lines.push(`${translate(locale, "label.words")}: ${n.verdict}`);
      lines.push(translate(locale, "note.narratorCriticism"));
    }
    const attribution = n && sahihAttribution(n, locale);
    if (attribution) lines.push(attribution);
    const variants = [...(r.dorar?.narrations ?? []), ...(r.dorar?.weakVariants ?? [])].filter((item) => item.textVariant);
    if (variants.length) {
      lines.push(translate(locale, "note.variantSummary"));
      for (const item of variants) {
        lines.push(translate(locale, item.textVariant === "additional" ? "note.additionalWording" : "note.differentWording"));
        lines.push(`${translate(locale, "label.narrationText")}: ${item.matn}`);
        if (item.source) lines.push([item.source, item.reference].filter(Boolean).join(" — "));
        if (item.muhaddith) lines.push(`${translate(locale, "label.scholar")}: ${item.muhaddith}`);
        if (item.verdict) lines.push(`${translate(locale, isDorarAddition(item.verdict) ? "label.dorarGrade" : "label.words")}: ${item.verdict}`);
        if (item.scope === "narrator") lines.push(translate(locale, "note.narratorCriticism"));
        if (item.scope === "isnad" && /هالك/.test(item.verdict ?? "")) lines.push(translate(locale, "note.halikIsnad"));
      }
    }
    if (r.verse?.wording?.contextOmitted) lines.push(translate(locale, "verse.contextWarning"));
    if (r.verse && (r.verse.wording?.contextOmitted || r.verse.wording?.exact === false)) {
      lines.push(`${translate(locale, "label.mushaf")}: ${r.verse.text}`);
    }
    if (r.claim.kind === "question" && r.claim.scope !== "general") lines.push(translate(locale, "fatwa.warn"));
    return lines.join("\n");
  });
  return `${blocks.join("\n\n")}\n\n— ${appName}`;
}

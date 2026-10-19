// The text that goes to the clipboard / the share sheet: each claim, its result, and where it comes from. Plain text, so it pastes into WhatsApp.
import type { ClaimResult } from "./clientTypes";
import { stateLabel, translate, type Locale } from "./i18n/dict";
import { sahihAttribution } from "./sahihAttribution";
import { matchedArabic } from "./matchedArabic";
import { splitReferenceUrl } from "./viaLinks";
import { toneOf, type Tone } from "./gradeStyle";

export const APP_URL = "https://tathabbut.alulama.org";

/** The data holds «سورة البقرة»; the sentence adds the word «سورة» itself, in the user's language. */
export const plainSurah = (name: string) => name.replace(/^سورة\s+/, "");

/** The first place a result can be traced to, as one line: book and page for a hadith, surah and verse for the Quran. */
export function sourceLine(r: ClaimResult, locale: Locale): string | null {
  if (r.verse) {
    const surah = plainSurah(r.verse.surahName);
    return locale === "en" ? `Surah ${surah}, verse ${r.verse.ayah}` : locale === "ur" ? `سورہ ${surah}، آیت ${r.verse.ayah}` : `سورة ${surah}، الآية ${r.verse.ayah}`;
  }
  const n = r.dorar?.narrations[0];
  if (n?.source) return [n.source, n.reference].filter(Boolean).join("، ");
  if (r.saying?.reference) return splitReferenceUrl(r.saying.reference).text;
  const book = r.turath && r.turath.status === "success" ? r.turath.references[0]?.book.title : undefined;
  return book ?? null;
}

/** «أخرجه الإمام مسلم في صحيحه.» with the hadith number before the closing stop: «…في صحيحه، 41.» */
function withNumber(sentence: string, reference: string | undefined): string {
  if (!reference) return sentence;
  const stop = sentence.match(/[.۔]$/)?.[0] ?? "";
  return `${sentence.slice(0, sentence.length - stop.length)}، ${reference}${stop}`;
}

/** The mark before a result's state in the shared text: the colour of the app's badge for that state (gradeStyle.ts), so a
 *  reader sees the result at a glance. The words always say it too; the mark never stands alone. */
export const TONE_MARK: Record<Tone, string> = {
  accepted: "🟢",
  verse: "🟢",
  weak: "🟡",
  veryWeak: "🔴",
  misquote: "🟠",
  unsure: "⚪",
  notFound: "⚪",
  translated: "🔵",
  fatwa: "🟣",
  found: "🟤",
};

/** WhatsApp's bold. Elsewhere the stars stay as plain marks, which still read as emphasis. */
const bold = (s: string) => `*${s}*`;

/** The difference between a quoted verse and the mushaf, word by word, as the app shows it (ClaimDetail → Diffs). */
function diffLines(r: ClaimResult, locale: Locale): string[] {
  return (r.verse?.wording?.diffs ?? []).map((d) =>
    d.op === "replaced"
      ? translate(locale, "diff.replaced", { typed: d.typed ?? "", correct: d.correct ?? "" })
      : d.op === "missing"
        ? translate(locale, "diff.missing", { correct: d.correct ?? "" })
        : translate(locale, "diff.added", { typed: d.typed ?? "" }),
  );
}

/**
 * The short text for WhatsApp and the like (specialist, 2026-10-05/06; layout by the team lead, 2026-10-19). It opens with
 * the platform's name; several claims are numbered. Per claim: its words, then its result marked with the badge's colour,
 * then
 * - a hadith of the Sahihayn: the result is one line, «أخرجه الإمام مسلم في صحيحه، 41.», which holds book, imam and number;
 * - a misquoted verse: what differs, the verse as the mushaf has it, and its place, in that order;
 * - any other result: the source and its scholar;
 * then, for an Urdu or English claim, the Arabic text it was matched to (never dropped), and for a personal question the
 * warning. No links to sources at all (the app shows them); no wording-variant, narrator or isnad notes. Only the app's
 * address closes it: the link to these very results when they have one (resultUrl).
 */
export function buildShareText(results: ClaimResult[], locale: Locale): string {
  const blocks = results.map((r, i) => {
    // a question goes by its topic, as on the screen (ClaimDetail): a person's own case never leaves in their words
    const quote = r.claim.kind === "question" ? r.claim.topic : r.claim.arabicSpan || r.claim.textAsWritten;
    const head = [results.length > 1 ? bold(`${i + 1}.`) : "", quote ? `«${quote}»` : ""].filter(Boolean).join(" ");
    const lines = head ? [head] : [];
    const mark = TONE_MARK[toneOf(r.state)];
    const n = r.dorar?.narrations[0];
    const sahih = n && sahihAttribution(n, locale);
    if (sahih) lines.push(`${mark} ${bold(withNumber(sahih, n.reference))}`);
    else lines.push(`${mark} ${bold(stateLabel(r.state, locale, true))}`);

    if (r.verse) {
      // the mistake, then the right wording, then where it stands in the mushaf (an omitted context is the state itself,
      // and the full wording follows, so the app's warning is not repeated here)
      lines.push(...diffLines(r, locale));
      // as the app shows it (ClaimDetail): for a misquote, a translated verse, or a verse read in another qira'a
      const tone = toneOf(r.state);
      if (tone === "misquote" || tone === "translated" || r.verse.wording?.qiraat?.length) lines.push(`${translate(locale, "label.mushaf")}: ${r.verse.text}`);
      for (const q of r.verse.wording?.qiraat ?? [])
        lines.push(`${translate(locale, "label.qiraa")}: «${q.typed}» ${translate(locale, "qiraa.of", { readers: readersLine(q.readers) })}`);
    }
    if (r.saying?.correct_text) lines.push(`${translate(locale, "label.correct")}: ${r.saying.correct_text}`);
    if (!sahih) {
      const src = sourceLine(r, locale);
      if (src) lines.push(`${translate(locale, "label.source")}: ${src}`);
      if (n?.muhaddith) lines.push(`${translate(locale, "label.scholar")}: ${n.muhaddith}`);
    }
    const arabic = matchedArabic(r);
    if (arabic) lines.push(`${translate(locale, "label.matchedArabic")}: ${arabic}`, translate(locale, "note.translationMatch"));
    if (r.claim.kind === "question" && r.claim.scope !== "general") lines.push(translate(locale, "fiqh.refer"));
    return lines.join("\n");
  });
  return `${bold(translate(locale, "share.header"))}\n\n${blocks.join("\n\n")}\n\n${translate(locale, "share.more")}:\n${resultUrl(results)}`;
}

/** The address that closes a shared text: the link to these results (/r/<id>-<id>…, src/lib/sharedClaims.ts) when each
 *  of them has one, else the app itself. */
export function resultUrl(results: ClaimResult[]): string {
  const ids = results.map((r) => r.shareId);
  return ids.length > 0 && ids.every(Boolean) ? `${APP_URL}/r/${ids.join("-")}` : APP_URL;
}

/** What became of a share: the system sheet took it, it was copied instead, the person closed the sheet, or nothing worked. */
export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

/** The system share sheet where there is one; where there is none, or it fails (Windows often has no target), the text is
 *  copied so the person can paste it themselves, and the page says so. */
export async function shareOrCopy(text: string): Promise<ShareOutcome> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ text });
      return "shared";
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}

export const whatsappUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

/** The readers of a reading in Arabic, as scholars name them: «حمزة (خلف، خلاد)، والكسائي (أبو الحارث، الدوري)». The
 *  tenth imam Khalaf is «خلف العاشر», so he is not taken for Hamza's rawi of the same name. */
export function readersLine(readers: { id: number; imam: string; ruwat: string[] }[]): string {
  return readers
    .map((r, i) => `${i ? "و" : ""}${r.id === 10 ? "خلف العاشر" : r.imam}${r.ruwat.length ? ` (${r.ruwat.join("، ")})` : ""}`)
    .join("، ");
}

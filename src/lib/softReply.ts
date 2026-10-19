// A reply the reader can send back to whoever forwarded a message that does not hold: thanks, a gentle note naming the result and
// who said it, what is established on the matter (when there is something), and the Prophet's ﷺ reminder not to pass on
// everything one hears. Composed ONLY from what the result already says (its state, its named scholar and source, the mushaf's
// wording), like the shared text: nothing here is a verdict of our own and no model writes any of it.
import type { ClaimResult } from "./clientTypes";
import { stateLabel, translate, type Locale } from "./i18n/dict";
import { toneOf } from "./gradeStyle";
import { diffLines, resultUrl, sourceLine } from "./shareText";

/** What is established on the same matter (the sahih alternative): Dorar's own text, with its book and number. */
export interface Alternative {
  matn: string;
  source: string;
  reference?: string;
}

/** A soft reply is for a text that does not hold: weak, very weak, a misquoted verse, a wrongly attributed saying, or not found. */
export function softReplyApplies(r: ClaimResult): boolean {
  if (r.claim.kind === "question") return false;
  const tone = toneOf(r.state);
  return tone === "weak" || tone === "veryWeak" || tone === "misquote" || tone === "notFound";
}

export function buildSoftReply(r: ClaimResult, locale: Locale, alt?: Alternative | null): string {
  const t = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) => translate(locale, key, params);
  const quote = r.claim.arabicSpan || r.claim.textAsWritten;
  const tone = toneOf(r.state);
  const lines = [t("soft.thanks"), "", t("soft.note", { quote })];

  if (tone === "notFound") {
    lines.push(t("soft.notFound"));
  } else {
    lines.push(t("soft.verdict", { state: stateLabel(r.state, locale, true) }));
    if (r.verse) {
      lines.push(t("soft.verse"), ...diffLines(r, locale));
      if (r.verse.wording?.correctText || r.verse.text) lines.push(`${t("label.mushaf")}: ${r.verse.text}`);
    }
    const n = r.dorar?.narrations[0];
    const src = sourceLine(r, locale);
    if (r.saying?.verdict_by) lines.push(`${t("label.scholar")}: ${r.saying.verdict_by}`);
    else if (n?.muhaddith) lines.push(`${t("label.scholar")}: ${n.muhaddith}`);
    if (src && !r.verse) lines.push(`${t("label.source")}: ${src}`);
    if (r.saying?.correct_text) lines.push(`${t("label.correct")}: ${r.saying.correct_text}`);
  }

  if (alt) lines.push("", t("soft.alt", { matn: alt.matn, source: [alt.source, alt.reference].filter(Boolean).join("، ") }));
  lines.push("", t("soft.remind", { cite: t("soft.remind.cite") }));
  const url = resultUrl([r]);
  lines.push("", `${t("soft.more")} ${url}`);
  return lines.join("\n");
}

// For a signed partner (src/lib/partner.ts) the answer also carries the short text for WhatsApp, made by the same code as the
// app's share button, so the partner does not rebuild it. It is an extra field: it can never change or break the answer.
import type { ClaimResult } from "./clientTypes";
import type { Locale } from "./i18n/dict";
import { partnerPerson } from "./partner";
import { buildShareText } from "./shareText";

const LOCALES: ReadonlySet<string> = new Set(["ar", "en", "ur"]);

/** The locale the partner asked for (ar, en or ur); Urdu when it said nothing or something else. */
export const partnerLocale = (value: unknown): Locale => (typeof value === "string" && LOCALES.has(value) ? (value as Locale) : "ur");

/** The WhatsApp text of these results for a signed partner request, or undefined (not a partner, nothing to say, or any failure). */
export function whatsappTextFor(request: Request, claims: ClaimResult[], locale: Locale): string | undefined {
  try {
    if (!claims.length || !partnerPerson(request)) return undefined;
    return buildShareText(claims, locale);
  } catch {
    return undefined;
  }
}

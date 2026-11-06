// The language a first-time visitor sees, before they have chosen one. Arabic stays the default for everyone else;
// Urdu is the start for a phone set to Urdu and for a phone in Pakistan's time zone (most Pakistani phones are set to
// English, so the language list alone would miss them). A saved choice always wins over this guess (see i18n.tsx).
import type { Locale } from "./dict";

const PAKISTAN_ZONES = new Set(["Asia/Karachi"]);

export function guessLocale(languages: readonly string[] | undefined, timeZone: string | undefined, fallback: Locale): Locale {
  const tags = (languages ?? []).map((l) => l.toLowerCase());
  if (tags.some((l) => l === "ur" || l.startsWith("ur-"))) return "ur";
  if (timeZone && PAKISTAN_ZONES.has(timeZone)) return "ur";
  return fallback;
}

/** Reads the browser; any failure (blocked, no Intl) falls back. */
export function guessLocaleFromBrowser(fallback: Locale): Locale {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return guessLocale(navigator.languages?.length ? navigator.languages : [navigator.language], zone, fallback);
  } catch {
    return fallback;
  }
}

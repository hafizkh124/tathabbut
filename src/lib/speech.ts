// Speaking the text instead of typing it. The browser's own speech recognition (Web Speech API) turns the voice into words;
// nothing here calls our AI quota, and the words only land in the text box, where they can be fixed before «check».
// Pure helpers live here (tested); the hook that holds the microphone is src/lib/useSpeech.ts.
import type { Locale } from "./i18n/dict";

/** The language the recogniser listens for, from the interface language. */
export function speechLang(locale: Locale): string {
  if (locale === "ur") return "ur-PK";
  if (locale === "ar") return "ar-SA";
  return "en-US";
}

/** The words of one recognition result list, in order. Each result's first alternative is the browser's best guess. */
export function transcriptOf(results: ArrayLike<ArrayLike<{ transcript: string }>>): string {
  const parts: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const best = results[i]?.[0]?.transcript?.trim();
    if (best) parts.push(best);
  }
  return parts.join(" ");
}

/** What was already in the box plus what was said, with one space between them (none when either is empty). */
export function joinSpoken(base: string, spoken: string): string {
  const b = base.replace(/\s+$/, "");
  const s = spoken.trim();
  if (!s) return base;
  return b ? `${b} ${s}` : s;
}

export type SpeechProblem = "denied" | "none" | "network" | "mic" | "other";

/** The recogniser's error code as the problem to tell the person about; null for an error that is not a problem
 *  (the person stopped it, or the recogniser was cut off to start again). */
export function problemOf(code: string): SpeechProblem | null {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "denied";
    case "no-speech":
      return "none";
    case "network":
      return "network";
    case "audio-capture":
      return "mic";
    case "aborted":
      return null;
    default:
      return "other";
  }
}

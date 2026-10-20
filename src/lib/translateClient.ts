// The screen's side of the translation: one request per (excerpt, language), remembered for the visit, never throwing.
import type { TranslateLang } from "./translate";

const asked = new Map<string, Promise<string | null>>();

/** The translation of a signed excerpt, or null when it could not be made (the Arabic is then simply shown alone). */
export function fetchTranslation(text: string, sig: string, to: TranslateLang, f: typeof fetch = fetch): Promise<string | null> {
  const key = `${to}:${sig}`;
  const known = asked.get(key);
  if (known) return known;
  const pending = (async () => {
    try {
      const res = await f("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, sig, to }) });
      if (!res.ok) return null;
      const data = (await res.json()) as { translation?: unknown };
      return typeof data.translation === "string" && data.translation.trim() ? data.translation : null;
    } catch {
      return null;
    }
  })();
  asked.set(key, pending);
  // a failure is not remembered: asking again later may work
  void pending.then((t) => {
    if (t === null) asked.delete(key);
  });
  return pending;
}

/** What has been translated of العلماء answers, by signature and language: the shared text uses it when it is there. */
const answers = new Map<string, string>();
export const knownAnswerTranslation = (sig: string | undefined, to: string): string | undefined => (sig ? answers.get(`${to}:${sig}`) : undefined);

/** The translation of a signed answer of العلماء (Urdu) into Arabic or English, or null; the Urdu is then simply shown alone. */
export function fetchAnswerTranslation(text: string, sig: string, to: "ar" | "en", f: typeof fetch = fetch): Promise<string | null> {
  const key = `from-ur:${to}:${sig}`;
  const known = asked.get(key);
  if (known) return known;
  const pending = (async () => {
    try {
      const res = await f("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, sig, from: "ur", to }) });
      if (!res.ok) return null;
      const data = (await res.json()) as { translation?: unknown };
      const t = typeof data.translation === "string" && data.translation.trim() ? data.translation : null;
      if (t) answers.set(`${to}:${sig}`, t);
      return t;
    } catch {
      return null;
    }
  })();
  asked.set(key, pending);
  void pending.then((t) => {
    if (t === null) asked.delete(key);
  });
  return pending;
}

/** Forgets what was asked (tests). */
export const forgetTranslations = () => {
  asked.clear();
  answers.clear();
};

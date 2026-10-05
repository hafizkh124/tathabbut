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

/** Forgets what was asked (tests). */
export const forgetTranslations = () => asked.clear();

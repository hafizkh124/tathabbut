// The fiqh topic of a question: the only thing of a question that ever leaves for the books. Pure and free of server code, so the
// screen and the server share it.

const squash = (s: string) => s.replace(/\s+/g, " ").trim();
const trimPunct = (s: string) => squash(s).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{M}\p{N}]+$/gu, "");

const MAX_TOPIC_WORDS = 6;
const MAX_TOPIC_CHARS = 60;

/**
 * The topic the books are asked about, or null. The model writes it, so it is checked: Arabic letters and spaces only
 * (no digits, Latin or Urdu-only letters, so no name written in another script and no figure from a story), a few words, and short.
 * Only this ever leaves for the books, never the asker's own words.
 */
export function cleanTopic(raw: string | undefined): string | null {
  const t = squash(trimPunct(raw ?? ""));
  if (!t || t.length > MAX_TOPIC_CHARS) return null;
  if (!/^[ء-يً-ْ\s]+$/.test(t)) return null;
  const words = t.split(" ");
  return words.length <= MAX_TOPIC_WORDS && t.replace(/[ً-ْ\s]/g, "").length >= 3 ? t : null;
}

const MAX_URDU_TOPIC_CHARS = 50;

/**
 * The same topic in Urdu, for finding questions already answered on العلماء. Checked like the Arabic one: letters (Arabic or Urdu)
 * and spaces only, up to six words, short; so no name, no figure and no detail of the asker's story goes with it.
 */
export function cleanTopicUrdu(raw: string | undefined): string | null {
  const t = squash(trimPunct(raw ?? ""));
  if (!t || t.length > MAX_URDU_TOPIC_CHARS) return null;
  if (!/^[ء-ۿً-ْٰ\s]+$/.test(t) || /[٠-٩۰-۹]/.test(t)) return null;
  const words = t.split(" ");
  return words.length <= 6 && t.replace(/[ً-ْٰ\s]/g, "").length >= 3 ? t : null;
}

const MAX_EN_TOPIC_CHARS = 50;

/** The same topic in English, for finding English answers on العلماء: Latin letters and spaces only, a few words, short. */
export function cleanTopicEn(raw: string | undefined): string | null {
  const t = squash(trimPunct(raw ?? ""));
  if (!t || t.length > MAX_EN_TOPIC_CHARS || !/^[A-Za-z][A-Za-z'’\- ]*$/.test(t)) return null;
  return t.split(" ").length <= 5 && t.replace(/[^A-Za-z]/g, "").length >= 3 ? t : null;
}

/** The other names of a matter that the model gives (at most `max`), each cleaned like a topic; what does not pass is left out. */
export function cleanTerms(raw: unknown, clean: (s: string) => string | null, max = 3): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    // two names in one string («نیوتہ اور نیوندرا», «a / b», «a، b») are two names: each is looked up alone
    // (only when each side is a short name: a longer text is not a list)
    const parts = typeof x === "string" ? x.split(/\s+(?:اور|یا|و|and|or)\s+|\s*[،,/|؛;]\s*/i).map((n) => n.trim()).filter(Boolean) : [];
    const names = typeof x === "string" ? (parts.length > 1 && parts.every((n) => n.split(/\s+/).length <= 2) ? parts : [x]) : [];
    for (const name of names) {
      const t = clean(name);
      if (t && !out.includes(t)) out.push(t);
      if (out.length >= max) return out;
    }
  }
  return out;
}

/** A topic that may be sent to العلماء' search, whatever its language: letters and spaces only, a few words, short (never a story). */
export const cleanTopicAny = (raw: string): string | null => cleanTopicUrdu(raw) ?? cleanTopicEn(raw);

/**
 * The topic as the reader should see it: in the interface language when the model gave it, with the Arabic words the books were
 * searched with beside it (Turath's books are Arabic, so Arabic is what they are asked in).
 */
export function topicLabel(c: { topic?: string | null; topicUr?: string | null; topicEn?: string | null }, locale: "ar" | "en" | "ur"): { main: string | null; arabic: string | null } {
  const main = (locale === "ur" ? c.topicUr : locale === "en" ? c.topicEn : c.topic) || c.topic || null;
  return { main, arabic: c.topic && main !== c.topic ? c.topic : null };
}

/** Words that open a topic without naming the matter; Turath's search needs every word, and they only narrow it. */
const GENERIC_OPENERS = new Set(["حكم", "احكام", "أحكام", "مسألة", "مسائل", "باب", "كتاب"]);

/** What the books are searched with: the topic without a generic opening word (the screen still shows the whole topic). */
export function topicQuery(topic: string): string {
  const words = topic.split(" ");
  const rest = GENERIC_OPENERS.has(words[0]) ? words.slice(1).join(" ") : topic;
  return rest.replace(/[ً-ْ\s]/g, "").length >= 3 ? rest : topic;
}

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

/** Words that open a topic without naming the matter; Turath's search needs every word, and they only narrow it. */
const GENERIC_OPENERS = new Set(["حكم", "احكام", "أحكام", "مسألة", "مسائل", "باب", "كتاب"]);

/** What the books are searched with: the topic without a generic opening word (the screen still shows the whole topic). */
export function topicQuery(topic: string): string {
  const words = topic.split(" ");
  const rest = GENERIC_OPENERS.has(words[0]) ? words.slice(1).join(" ") : topic;
  return rest.replace(/[ً-ْ\s]/g, "").length >= 3 ? rest : topic;
}

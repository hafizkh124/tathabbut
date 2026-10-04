// Finds the religious claims in a pasted post (or in the text read from a screenshot).
// The model only POINTS at text; it is never trusted to copy Arabic faithfully. In a live test (2026-10-03)
// gemini-3.8-flash silently "corrected" «إن الله مع الصابرون» to «الصابرين» — the very mistake Tathabbut must catch.
// So every span the model returns is checked against the post itself, and the wording we search with and judge is
// always the post's own text. The model's Arabic is used only to translate a claim written in Urdu or English, and
// such a query is flagged so that it is never used to judge wording.
import { normalizeArabic } from "./arabic";
import { generateJson, type GeminiImage, type GenerateResult } from "./gemini";

export const CLAIM_KINDS = ["hadith", "quran", "scholar_quote", "question", "other"] as const;
export type ClaimKind = (typeof CLAIM_KINDS)[number];

export interface Claim {
  kind: ClaimKind;
  /** Exactly as in the post (checked). */
  textAsWritten: string;
  /** "loose": found only after ignoring diacritics, letter forms and punctuation. */
  spanCheck: "exact" | "loose";
  /** The Arabic wording inside the claim, exactly as typed in the post; null when the claim has none. */
  arabicSpan: string | null;
  /** What we search with. */
  query: string;
  /** The query is the model's Arabic rendering of an Urdu/English claim: fine for finding, never for judging wording. */
  queryIsTranslation: boolean;
  language: "ar" | "ur" | "en" | "mixed";
  attributedTo: string | null;
  citedSource: string | null;
  /** Things the checks noticed, e.g. the model altered the Arabic. */
  warnings: string[];
  /** Only for a «question»: whether it is the asker's own case or a general rule. In doubt it is «personal». */
  scope?: "personal" | "general";
  /** Only for a «question»: the fiqh topic in Arabic (a few words, no names or story), the only thing the books are asked. */
  topic?: string | null;
}

export interface Extraction {
  claims: Claim[];
  dropped: { text: string; reason: string }[];
  model?: string;
  ms?: number;
}

interface RawClaim {
  kind?: string;
  text_as_written?: string;
  arabic_span?: string;
  arabic_translation?: string;
  attributed_to?: string;
  cited_source?: string;
  question_scope?: string;
  topic_ar?: string;
}

export const CLAIMS_SCHEMA = {
  type: "OBJECT",
  properties: {
    claims: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          kind: { type: "STRING", enum: [...CLAIM_KINDS] },
          text_as_written: { type: "STRING" },
          arabic_span: { type: "STRING" },
          arabic_translation: { type: "STRING" },
          attributed_to: { type: "STRING" },
          cited_source: { type: "STRING" },
          question_scope: { type: "STRING", enum: ["personal", "general"] },
          topic_ar: { type: "STRING" },
        },
        required: ["kind", "text_as_written"],
      },
    },
  },
  required: ["claims"],
};

export function claimsPrompt(post: string): string {
  return `You find the religious claims in a social-media post so that a hadith specialist's tool can check them.
For each claim return:
- kind: "hadith" (attributed to the Prophet ﷺ), "quran" (presented as a verse of the Quran), "scholar_quote" (attributed to a scholar, imam or companion), "question" (asks for a ruling, a fatwa or evidence), "other" (any other religious promise or instruction, e.g. "send this to ten people and enter Paradise").
- text_as_written: the claim copied from the post character for character, without the narration around it ("the Prophet said:") and WITHOUT correcting anything, even an obvious mistake.
- arabic_span: the Arabic wording inside text_as_written, copied character for character with any mistakes kept. Empty if the claim has no Arabic wording.
- arabic_translation: only when arabic_span is empty: the Arabic wording this claim refers to, for searching hadith and Quran databases. Empty otherwise.
- attributed_to and cited_source: exactly as written in the post, or empty.
- question_scope (only for kind "question"): "general" ONLY when the question asks for a rule in the abstract and mentions no event, no person and no situation of the asker or of anyone (no "I", "we", "my", "our", no named or described person, no concrete act that already happened). A scenario is NOT general even when it speaks of "someone" ("if a man does X in such a state, what then?", "what if ..."): a general question only names the matter and asks its ruling ("what is the ruling on X?", "how is X done?", "what is the nisab of X?"). Anything else is "personal": a case that happened, a scenario or hypothetical, a decision the asker must take, a family, marriage, divorce, inheritance, money or worship matter told as a story, or any doubt. When in doubt answer "personal".
- topic_ar (only for kind "question"): the fiqh topic of the question as the title of a chapter in a fiqh book, in Arabic, two or three words, naming the matter only and not starting with «حكم» or «أحكام» (for example «صلاة الجمعة للمسافر», «سجود السهو», «طلاق الغضبان»). It must contain no name, no number, no detail of the asker's story and no answer or ruling.
Never judge whether a claim is authentic. Never add a claim that is not in the post.

POST:
${post}`;
}

// ---------- text helpers ----------

/** Urdu keyboards type ی ک ہ for Arabic ي ك ه; fold them so the same words compare equal. */
export function foldUrduLetters(s: string): string {
  return s.replace(/ی/g, "ي").replace(/ک/g, "ك").replace(/[ہۂ]/g, "ه").replace(/ۃ/g, "ة");
}
const squash = (s: string) => s.replace(/\s+/g, " ").trim();
/** For a loose comparison: no diacritics, unified letters, no punctuation. */
const loose = (s: string) =>
  normalizeArabic(foldUrduLetters(s))
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
/** Leading/trailing punctuation the model may include or drop (quotes, «», ۔ ، : etc.). */
const trimPunct = (s: string) => squash(s).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{M}\p{N}]+$/gu, "");

function findIn(haystack: string, needle: string): "exact" | "loose" | null {
  const n = trimPunct(needle);
  if (!n) return null;
  if (squash(haystack).includes(n)) return "exact";
  const ln = loose(n);
  return ln && loose(haystack).includes(ln) ? "loose" : null;
}

/** When a span only matches loosely, take the post's own words for it (so a model's added hamza or harakat is not kept). */
export function recoverSlice(post: string, needle: string): string | null {
  const target = loose(needle);
  const words = [...post.matchAll(/\S+/g)];
  const n = trimPunct(needle).split(/\s+/).length;
  for (const size of [n, n - 1, n + 1, n + 2]) {
    if (size < 1) continue;
    for (let i = 0; i + size <= words.length; i++) {
      const start = words[i].index!;
      const last = words[i + size - 1];
      const slice = post.slice(start, last.index! + last[0].length);
      if (loose(slice) === target) return trimPunct(slice);
    }
  }
  return null;
}

/** Letters that occur in Urdu but not in Arabic. */
const URDU_ONLY = /[ٹڈڑںےۓھگپچژ]/;
/** Common Urdu words written only with letters Arabic also has. Matched as typed (Urdu ی ک ہ), so the Arabic
 *  «الله» or «من» never counts as Urdu; words Arabic itself uses (ان، من، اس…) are deliberately absent. */
const URDU_WORDS = new Set(["کہ", "ہے", "ہیں", "کی", "کا", "کے", "کو", "اور", "یہ", "وہ", "تو", "بھی", "یعنی", "فرمایا", "فرماتے", "فرماتا", "حدیث", "ہو", "جو", "جس", "کر", "کرو", "اگر", "تم", "ہم", "آپ", "جب", "تک", "لیے", "ساتھ", "والا", "والے", "کیا", "اللہ"]);

/** The longest run of Arabic-looking words (at least two) in a claim, sliced from the original text. */
export function arabicRun(text: string): string | null {
  let best: { start: number; end: number; words: number } | null = null;
  let cur: { start: number; end: number; words: number } | null = null;
  for (const m of text.matchAll(/\S+/g)) {
    const raw = m[0];
    const word = raw.replace(/[^\p{L}\p{M}]/gu, "");
    const arabicLooking = /[ء-ي]/.test(word) && !URDU_ONLY.test(word) && !/[A-Za-z]/.test(word) && !URDU_WORDS.has(word);
    if (arabicLooking) {
      const end = m.index! + raw.length;
      if (cur) {
        cur.end = end;
        cur.words += 1;
      } else {
        cur = { start: m.index!, end, words: 1 };
      }
      if (!best || cur.words > best.words) best = { start: cur.start, end: cur.end, words: cur.words };
    } else {
      cur = null;
    }
  }
  return best && best.words >= 2 ? trimPunct(text.slice(best.start, best.end)) : null;
}

// ---------- the checks ----------

const MAX_CLAIMS = 12;

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

/** Applies every check to the model's raw answer. Pure, so it is tested without the model. */
export function checkClaims(post: string, raw: RawClaim[]): Extraction {
  const claims: Claim[] = [];
  const dropped: Extraction["dropped"] = [];
  const seen = new Set<string>();

  for (const r of raw) {
    const given = trimPunct(r.text_as_written ?? "");
    if (!given) continue;
    const spanCheck = findIn(post, given);
    if (!spanCheck) {
      dropped.push({ text: given, reason: "not in the post" });
      continue;
    }
    // From here on only the post's own words are used.
    const text = spanCheck === "exact" ? given : (recoverSlice(post, given) ?? given);
    const key = loose(text);
    if (seen.has(key)) continue;
    seen.add(key);

    const warnings: string[] = [];
    let arabicSpan: string | null = null;
    const modelSpan = trimPunct(r.arabic_span ?? "");
    if (modelSpan) {
      if (squash(text).includes(modelSpan)) arabicSpan = modelSpan;
      else {
        warnings.push(`model altered the Arabic: «${modelSpan}»`);
        arabicSpan = arabicRun(text);
      }
    }
    const translation = trimPunct(r.arabic_translation ?? "");
    const queryIsTranslation = !arabicSpan && Boolean(translation);
    const query = arabicSpan ? foldUrduLetters(arabicSpan) : translation || text;
    const language: Claim["language"] = arabicSpan
      ? loose(arabicSpan) === loose(text)
        ? "ar"
        : "mixed"
      : /[A-Za-z]/.test(text) && !/[؀-ۿ]/.test(text)
        ? "en"
        : "ur";
    const kind = (CLAIM_KINDS as readonly string[]).includes(r.kind ?? "") ? (r.kind as ClaimKind) : "other";
    const keepIfInPost = (v?: string) => {
      const s = trimPunct(v ?? "");
      return s && findIn(post, s) ? s : null;
    };
    const asked = kind === "question";
    claims.push({
      kind,
      ...(asked ? { scope: r.question_scope === "general" ? ("general" as const) : ("personal" as const), topic: cleanTopic(r.topic_ar) } : {}),
      textAsWritten: text,
      spanCheck,
      arabicSpan,
      query,
      queryIsTranslation,
      language,
      attributedTo: keepIfInPost(r.attributed_to),
      citedSource: keepIfInPost(r.cited_source),
      warnings,
    });
    if (claims.length >= MAX_CLAIMS) break;
  }
  return { claims, dropped };
}

type Generate = <T>(prompt: string, opts: { schema: object; images?: GeminiImage[] }) => Promise<GenerateResult<T>>;

export async function extractClaims(post: string, deps: { generate?: Generate } = {}): Promise<Extraction> {
  const generate = deps.generate ?? generateJson;
  const text = post.trim();
  if (!text) return { claims: [], dropped: [] };
  const r = await generate<{ claims?: RawClaim[] }>(claimsPrompt(text), { schema: CLAIMS_SCHEMA });
  return { ...checkClaims(text, r.data.claims ?? []), model: r.model, ms: r.ms };
}

/** Reads the text of a screenshot as it is, so the claims can then be checked against what the image says. */
export async function transcribeImage(image: GeminiImage, deps: { generate?: Generate } = {}): Promise<string> {
  const generate = deps.generate ?? generateJson;
  const r = await generate<{ text?: string }>(
    "Transcribe all the text in this image exactly as it appears, keeping the line breaks and every language as written. Do not correct, translate or summarize anything.",
    { schema: { type: "OBJECT", properties: { text: { type: "STRING" } }, required: ["text"] }, images: [image] },
  );
  return (r.data.text ?? "").trim();
}

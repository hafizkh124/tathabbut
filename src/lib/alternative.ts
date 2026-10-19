// The authentic text on the same matter, to offer with a soft reply («اطلبوا العلم ولو بالصين» → «من سلك طريقًا يلتمس فيه علمًا…»,
// Sahih Muslim). The system finds it itself, and the model never writes it:
//   1. a small model gives 2–3 short Arabic search queries made of words an authentic hadith on the same subject would use (search
//      words only: whatever it recalls wrongly simply finds nothing, because what is shown comes from Dorar);
//   2. Dorar is searched with them in Sahih al-Bukhari and Sahih Muslim only, and only a narration its muhaddith graded as in his
//      own Sahih (gradeMap «high») is kept;
//   3. a second small call picks, among the retrieved texts only, the one that says the same thing, or none (it is told to prefer none).
// What is shown is Dorar's own text with its book and number. Off the main path: asked for only when a soft reply is opened.
import { matnTokens, normalizeArabic } from "./arabic";
import { searchDorar, SAHIHAYN_BOOKS, type DorarLookup } from "./dorar";
import { generateJson, type GenerateOptions, type GenerateResult } from "./gemini";
import { classifyVerdict, GRADES } from "./gradeMap";
import type { Alternative } from "./softReply";

/** The small models for these two calls (free quotas far larger than the main chain's): GEMINI_LIGHT_MODELS, comma separated. */
export const lightModels = (): { model: string; fallbackModel?: string } => {
  const [model, ...rest] = (process.env.GEMINI_LIGHT_MODELS || "gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemma-4-26b-a4b-it").split(",").map((m) => m.trim()).filter(Boolean);
  return { model, ...(rest.length ? { fallbackModel: rest.join(",") } : {}) };
};

type Generate = <T>(prompt: string, opts: GenerateOptions) => Promise<GenerateResult<T>>;
type Search = (q: string, limit: number, opts: { books: string[] }) => Promise<DorarLookup>;

const MAX_PHRASES = 3;
const MAX_CANDIDATES = 6;
const MAX_MATN_CHARS = 320;

const words = (s: string) => normalizeArabic(s).split(" ").filter((w) => w.length >= 3);

/** The search queries from the model: Arabic letters and spaces only, two to six words each, at most three, and not mostly the
 *  text's own words (a query that repeats the text only finds the text, not the matter it is about). */
export function cleanPhrases(raw: unknown, claim = ""): string[] {
  if (!Array.isArray(raw)) return [];
  const own = new Set(words(claim));
  return raw
    .filter((p): p is string => typeof p === "string")
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => /^[ء-يً-ْ\s]+$/.test(p) && p.split(" ").length >= 2 && p.split(" ").length <= 6)
    .filter((p) => {
      const w = words(p);
      return w.length > 0 && w.filter((x) => own.has(x)).length / w.length < 0.6;
    })
    .slice(0, MAX_PHRASES);
}

export interface Candidate {
  matn: string;
  source: string;
  reference?: string;
}

/** The narrations of the two Sahihs that their own imam graded (gradeMap «high» مقبول), without repeats. */
export function sahihCandidates(found: DorarLookup[]): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const f of found) {
    if (!f.ok) continue;
    for (const r of f.results) {
      const g = classifyVerdict(r.verdict ?? "", r.muhaddith ?? "");
      if (g.grade !== GRADES[0] || g.confidence !== "high" || !r.source) continue;
      const key = [...matnTokens(r.matn)].sort().join(" ");
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({ matn: r.matn, source: r.source, ...(r.reference ? { reference: r.reference } : {}) });
    }
  }
  return out;
}

const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, s.lastIndexOf(" ", n) > n * 0.6 ? s.lastIndexOf(" ", n) : n)}…`);

export async function findAlternative(claim: string, deps: { generate?: Generate; search?: Search } = {}): Promise<Alternative | null> {
  const generate = deps.generate ?? generateJson;
  const search: Search = deps.search ?? ((q, limit, o) => searchDorar(q, limit, o));
  const models = lightModels();

  const p = await generate<{ phrases?: string[] }>(
    `Below is a text that circulates as a saying of the Prophet ﷺ but is not authentic. Think of its SUBJECT, then give ${MAX_PHRASES} search queries of 3 to 5 words each: the opening words of authentic hadiths on that same subject (as they are in Sahih al-Bukhari or Sahih Muslim), as you remember them, in classical Arabic (for a text about travelling far to seek knowledge: «من سلك طريقا يلتمس فيه علما»). The queries are only search words for a database: do not repeat the words of the text, write no explanation, and say nothing about authenticity. If you do not remember, give the key words of the subject instead.

TEXT:
${claim}`,
    { schema: { type: "OBJECT", properties: { phrases: { type: "ARRAY", items: { type: "STRING" } } }, required: ["phrases"] }, ...models },
  );
  const phrases = cleanPhrases(p.data.phrases, claim);
  if (!phrases.length) return null;

  const found = await Promise.all(phrases.map((q) => search(q, 15, { books: SAHIHAYN_BOOKS }).catch((): DorarLookup => ({ ok: false, error: "network" }))));
  const candidates = sahihCandidates(found).slice(0, MAX_CANDIDATES);
  if (!candidates.length) return null;

  const list = candidates.map((c, i) => `${i + 1}. ${clip(c.matn, MAX_MATN_CHARS)}`).join("\n");
  const pick = await generate<{ choice?: number }>(
    `TEXT:\n${claim}\n\nCANDIDATES (authentic hadiths):\n${list}\n\nWhich ONE candidate states the same meaning as the TEXT (the same teaching about the same matter, not merely the same general topic)? Answer with its number, or 0 if none does. When in doubt answer 0. Do not judge authenticity and do not write anything else.`,
    { schema: { type: "OBJECT", properties: { choice: { type: "INTEGER" } }, required: ["choice"] }, ...models },
  );
  const n = Number(pick.data.choice);
  const chosen = Number.isInteger(n) && n >= 1 && n <= candidates.length ? candidates[n - 1] : null;
  return chosen ? { matn: clip(chosen.matn, MAX_MATN_CHARS), source: chosen.source, ...(chosen.reference ? { reference: chosen.reference } : {}) } : null;
}

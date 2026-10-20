// A second look at a fiqh topic that found nothing: a small model is asked what the words mean and under which other names the
// matter is written (a colloquial or regional word: نیوتہ / نیوندرا = the money gifts of weddings, in Arabic النقوط). Only the TOPIC words
// go to it, never the asker's question, and only the names of the matter come back: they are used to search العلماء and the books,
// and nothing the model writes is shown as an answer. Asked for only when the first search found nothing, so it costs a call only on a miss.
import { generateJson, type GenerateResult } from "./gemini";
import { cleanTerms, cleanTopic, cleanTopicEn, cleanTopicUrdu } from "./topic";

export interface Expansion {
  ur: string[];
  ar: string[];
  en: string[];
}

/** The topic words as the screen has them (any of the three); each already passed the topic check. */
export interface ExpandInput {
  ur?: string;
  ar?: string;
  en?: string;
}

export function expandPrompt(input: ExpandInput): string {
  const given = [input.ur, input.ar, input.en].filter(Boolean).join(" | ");
  return `A reader asked a question of fiqh. Its topic was written as: «${given}».
Some words used in South Asia, the Gulf or in dialect are not found in the usual books under that name (for example نیوتہ / نیوندرا / نیندرا = the money or gifts given at weddings and expected back, in Arabic النقوط; ویل; بھاجی). Work out what the topic means, then give the names under which the matter is written:
- ur: two to five NAMES of the matter in Urdu, of one or two words each, as they stand in the titles of fatwas (for the wedding gifts: «نیوتہ», «سلامی», «شادی میں رقم»), including the usual spellings of the colloquial word; one name in each item, never two joined by «اور», never a question and never a phrase like «… کا حکم»;
- ar: one to three Arabic fiqh terms or chapter titles (2 to 3 words each) under which the classical books treat it;
- en: one or two short English names.
Names of the matter only: no name of a person, no number, no story, no ruling, no explanation. If you do not recognise the words, return empty lists.
Return JSON: {"ur": [...], "ar": [...], "en": [...]}.`;
}

/** The model's names, cleaned like any topic: what does not pass is dropped. */
export function cleanExpansion(raw: { ur?: unknown; ar?: unknown; en?: unknown } | undefined): Expansion {
  return {
    ur: cleanTerms(raw?.ur, cleanTopicUrdu, 6),
    ar: cleanTerms(raw?.ar, cleanTopic, 3),
    en: cleanTerms(raw?.en, cleanTopicEn, 2),
  };
}

const SCHEMA = {
  type: "OBJECT",
  properties: { ur: { type: "ARRAY", items: { type: "STRING" } }, ar: { type: "ARRAY", items: { type: "STRING" } }, en: { type: "ARRAY", items: { type: "STRING" } } },
  required: ["ur", "ar", "en"],
};

type Generate = <T>(prompt: string, opts: { schema: object; timeoutMs?: number }) => Promise<GenerateResult<T>>;

export async function expandTopic(input: ExpandInput, deps: { generate?: Generate } = {}): Promise<Expansion> {
  const generate = deps.generate ?? generateJson;
  const r = await generate<{ ur?: unknown; ar?: unknown; en?: unknown }>(expandPrompt(input), { schema: SCHEMA, timeoutMs: 20_000 });
  return cleanExpansion(r.data);
}

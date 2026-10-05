// Reads the text of a screenshot or photo (Gemini vision) so it can be checked like pasted text.
// The model is told to copy, never to correct: it tends to quietly fix a misquoted verse (checked 2026-10-03), which would hide
// exactly the mistake we are looking for. So the person always sees the reading next to the picture and confirms it.
import { generateJson, type GeminiImage, type GeminiUsage, type GenerateResult } from "./gemini";

export const OCR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
/** Decoded size. The browser shrinks pictures first; a request body on the host is limited to ~4.5 MB. */
export const MAX_IMAGE_BYTES = 3_500_000;
const MAX_UNCERTAIN = 20;

export interface OcrReading {
  text: string;
  /** words the model was unsure of, each one a verbatim piece of `text` */
  uncertain: string[];
}

export const OCR_SCHEMA = {
  type: "OBJECT",
  properties: {
    text: { type: "STRING" },
    uncertain: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["text"],
};

export const OCR_PROMPT = [
  "Transcribe all the text in this image exactly as it appears. Keep the line breaks and every language as written.",
  "Copy the characters as they are drawn. Do NOT correct spelling or grammar, even inside Quran verses or hadith, even if you are sure it is a mistake. Do NOT translate, summarize or add anything.",
  'Put in "uncertain" any words you could not read with confidence, each copied exactly as you wrote it in "text".',
  'If the image has no text, return an empty "text".',
].join("\n");

/** Keeps only what can be trusted: trimmed text, and uncertain words that really are in the text. */
export function checkReading(raw: { text?: unknown; uncertain?: unknown }): OcrReading {
  const text = typeof raw.text === "string" ? raw.text.replace(/\r\n?/g, "\n").trim() : "";
  const listed = Array.isArray(raw.uncertain) ? raw.uncertain : [];
  const seen = new Set<string>();
  const uncertain: string[] = [];
  for (const w of listed) {
    if (typeof w !== "string") continue;
    const word = w.trim();
    if (!word || word.length > 40 || seen.has(word) || !text.includes(word)) continue;
    seen.add(word);
    uncertain.push(word);
    if (uncertain.length >= MAX_UNCERTAIN) break;
  }
  return { text, uncertain };
}

export type ImageCheck = { ok: true; image: GeminiImage } | { ok: false; status: 400 | 413; error: string };

/** Validates what the browser sent: a base64 picture of an accepted type and a sensible size. */
export function validateImage(body: { image?: unknown; mimeType?: unknown }): ImageCheck {
  const mimeType = typeof body.mimeType === "string" ? body.mimeType : "";
  const data = typeof body.image === "string" ? body.image.replace(/^data:[^,]*,/, "") : "";
  if (!(OCR_MIME_TYPES as readonly string[]).includes(mimeType)) return { ok: false, status: 400, error: "mimeType must be image/jpeg, image/png or image/webp" };
  if (!data || !/^[A-Za-z0-9+/]+={0,2}$/.test(data.slice(0, 200))) return { ok: false, status: 400, error: "image must be base64" };
  if (Math.floor((data.length * 3) / 4) > MAX_IMAGE_BYTES) return { ok: false, status: 413, error: "image too large" };
  return { ok: true, image: { mimeType, data } };
}

type Generate = <T>(prompt: string, opts: { schema: object; images?: GeminiImage[] }) => Promise<GenerateResult<T>>;

export async function readImage(image: GeminiImage, deps: { generate?: Generate } = {}): Promise<OcrReading & { model: string; ms: number; usage?: GeminiUsage }> {
  const generate = deps.generate ?? generateJson;
  const r = await generate<{ text?: unknown; uncertain?: unknown }>(OCR_PROMPT, { schema: OCR_SCHEMA, images: [image] });
  return { ...checkReading(r.data), model: r.model, ms: r.ms, ...(r.usage ? { usage: r.usage } : {}) };
}

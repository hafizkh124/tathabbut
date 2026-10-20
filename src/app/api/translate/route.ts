// POST /api/translate  { "text": "<an excerpt as /api/turath returned it>", "sig": "<its signature>", "to": "ur" | "en" }
//                    or  { "text": "<title, blank line, answer as /api/alulama returned them>", "sig": "…", "from": "ur", "to": "ar" | "en" }
//   →  { "translation": "...", "cached": boolean }
// Only server-signed retrieved text (Turath, a similar expression from verification, or an answer of العلماء) is translated.
import { aiQuotaResponse, limited } from "@/lib/rateLimit";
import { isTranslateLang, MAX_TRANSLATE_CHARS, translateExcerpt } from "@/lib/translate";
import { isAnswerLang, translateAnswer } from "@/lib/translateAnswer";
import { supabaseTranslationCache } from "@/lib/turathCache";
import { verifyExcerpt } from "@/lib/turathSign";

export const dynamic = "force-dynamic";
export const maxDuration = 40;

const cache = supabaseTranslationCache();

export async function POST(request: Request) {
  let body: { text?: unknown; sig?: unknown; to?: unknown; from?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON: { text, sig, to }" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text : "";
  if (!text.trim()) return Response.json({ error: "empty text" }, { status: 400 });
  if (text.length > MAX_TRANSLATE_CHARS) return Response.json({ error: `text longer than ${MAX_TRANSLATE_CHARS} characters` }, { status: 400 });
  const fromAnswer = body.from === "ur";
  if (fromAnswer ? !isAnswerLang(body.to) : !isTranslateLang(body.to)) return Response.json({ error: fromAnswer ? 'to must be "ar" or "en"' : 'to must be "ur" or "en"' }, { status: 400 });
  if (!verifyExcerpt(text, body.sig)) return Response.json({ error: "this text was not returned by the books" }, { status: 403 });
  const refused = await limited(request, "translate");
  if (refused) return refused;

  try {
    const r = fromAnswer ? await translateAnswer(text, body.to as "ar" | "en", { cache }) : await translateExcerpt(text, body.to as "ur" | "en", { cache });
    return Response.json({ translation: r.translation, cached: r.cached });
  } catch (err) {
    return aiQuotaResponse(err) ?? Response.json({ error: "could not translate" }, { status: 502 });
  }
}

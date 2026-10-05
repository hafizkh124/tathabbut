// POST /api/translate  { "text": "<an excerpt as /api/turath returned it>", "sig": "<its signature>", "to": "ur" | "en" }
//   →  { "translation": "...", "cached": boolean }
// Only an excerpt that Turath really returned (and the server signed) is translated: the endpoint is not a free translator.
import { isTranslateLang, MAX_TRANSLATE_CHARS, translateExcerpt } from "@/lib/translate";
import { supabaseTranslationCache } from "@/lib/turathCache";
import { verifyExcerpt } from "@/lib/turathSign";

export const dynamic = "force-dynamic";
export const maxDuration = 40;

const cache = supabaseTranslationCache();

export async function POST(request: Request) {
  let body: { text?: unknown; sig?: unknown; to?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON: { text, sig, to }" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text : "";
  if (!text.trim()) return Response.json({ error: "empty text" }, { status: 400 });
  if (text.length > MAX_TRANSLATE_CHARS) return Response.json({ error: `text longer than ${MAX_TRANSLATE_CHARS} characters` }, { status: 400 });
  if (!isTranslateLang(body.to)) return Response.json({ error: 'to must be "ur" or "en"' }, { status: 400 });
  if (!verifyExcerpt(text, body.sig)) return Response.json({ error: "this text was not returned by the books" }, { status: 403 });

  try {
    const r = await translateExcerpt(text, body.to, { cache });
    return Response.json({ translation: r.translation, cached: r.cached });
  } catch {
    return Response.json({ error: "could not translate" }, { status: 502 });
  }
}

// POST /api/ocr  { "image": "<base64>", "mimeType": "image/jpeg" }  →  { text, uncertain } read from a screenshot.
// The picture is sent to Google Gemini for reading and is not stored here.
import { GeminiError } from "@/lib/gemini";
import { readImage, validateImage } from "@/lib/ocr";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

export async function POST(request: Request) {
  let body: { image?: unknown; mimeType?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "body must be JSON: { image, mimeType }" }, { status: 400 });
  }

  const checked = validateImage(body);
  if (!checked.ok) return Response.json({ error: checked.error }, { status: checked.status });

  const t0 = Date.now();
  try {
    const r = await readImage(checked.image);
    return Response.json({ text: r.text, uncertain: r.uncertain, model: r.model, ms: { read: r.ms, total: Date.now() - t0 } });
  } catch (err) {
    const detail = err instanceof GeminiError ? err.message : String(err);
    return Response.json({ error: "could not read the image", detail: detail.slice(0, 200) }, { status: 502 });
  }
}

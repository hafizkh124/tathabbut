// POST /api/ocr  { "image": "<base64>", "mimeType": "image/jpeg" }  →  { text, uncertain } read from a screenshot.
// The picture is sent to Google Gemini for reading and is not stored here.
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
    return Response.json({ text: r.text, uncertain: r.uncertain, model: r.model, usage: r.usage, ms: { read: r.ms, total: Date.now() - t0 } });
  } catch {
    return Response.json({ error: "could not read the image" }, { status: 502 });
  }
}

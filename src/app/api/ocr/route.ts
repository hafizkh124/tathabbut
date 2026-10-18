// POST /api/ocr  { "image": "<base64>", "mimeType": "image/jpeg" }  →  { text, uncertain } read from a screenshot.
// The picture is sent to Google Gemini for reading and is not stored here.
import { later } from "@/lib/later";
import { eventRow, logEvent } from "@/lib/events";
import { readImage, validateImage } from "@/lib/ocr";
import { limited } from "@/lib/rateLimit";

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
  const refused = await limited(request, "ocr");
  if (refused) return refused;

  const t0 = Date.now();
  try {
    const r = await readImage(checked.image);
    later(() => logEvent(eventRow(request, "ocr", { ok: true, chars: r.text.length, ms: Date.now() - t0 })));
    return Response.json({ text: r.text, uncertain: r.uncertain, model: r.model, usage: r.usage, ms: { read: r.ms, total: Date.now() - t0 } });
  } catch {
    later(() => logEvent(eventRow(request, "ocr", { ok: false, ms: Date.now() - t0 })));
    return Response.json({ error: "could not read the image" }, { status: 502 });
  }
}

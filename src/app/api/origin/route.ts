// POST /api/origin  { "text": "<the claim to investigate>" }  →  digital provenance and earliest public records.
import { trackClaimOrigin } from "@/lib/originTracker";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const MAX_QUERY_LEN = 1_000;

export async function POST(request: Request) {
  let text = "";
  try {
    text = String(((await request.json()) as { text?: unknown }).text ?? "").trim();
  } catch {
    return Response.json({ error: "body must be JSON: { text }" }, { status: 400 });
  }

  if (!text) return Response.json({ error: "empty text" }, { status: 400 });
  if (text.length > MAX_QUERY_LEN) {
    return Response.json({ error: `text longer than ${MAX_QUERY_LEN} characters` }, { status: 400 });
  }

  const t0 = Date.now();
  try {
    const report = await trackClaimOrigin(text);
    return Response.json({
      report,
      ms: Date.now() - t0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: "could not investigate origin", detail: message.slice(0, 200) }, { status: 502 });
  }
}

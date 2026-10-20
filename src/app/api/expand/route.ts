// POST /api/expand  { "ur"?: "<topic>", "ar"?: "<topic>", "en"?: "<topic>" }  →  { "ur": [...], "ar": [...], "en": [...] }
// Other names for a fiqh topic that found nothing (src/lib/expand.ts): the model is told what the words may mean and gives only the
// names of the matter. Only topics (short words that already passed the topic check) are taken, never a question or a story.
import { expandTopic, type ExpandInput, type Expansion } from "@/lib/expand";
import { aiQuotaResponse, limited } from "@/lib/rateLimit";
import { cleanTopic, cleanTopicEn, cleanTopicUrdu } from "@/lib/topic";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TTL_MS = 6 * 60 * 60 * 1000;
const kept = new Map<string, { at: number; value: Expansion }>();

export async function POST(request: Request) {
  let body: { ur?: unknown; ar?: unknown; en?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON: { ur?, ar?, en? }" }, { status: 400 });
  }
  const input: ExpandInput = {
    ...(typeof body.ur === "string" && cleanTopicUrdu(body.ur) === body.ur.trim() ? { ur: body.ur.trim() } : {}),
    ...(typeof body.ar === "string" && cleanTopic(body.ar) === body.ar.trim() ? { ar: body.ar.trim() } : {}),
    ...(typeof body.en === "string" && cleanTopicEn(body.en) === body.en.trim() ? { en: body.en.trim() } : {}),
  };
  if (!input.ur && !input.ar && !input.en) return Response.json({ error: "give a short topic: ur, ar or en" }, { status: 400 });

  const key = `${input.ur ?? ""}|${input.ar ?? ""}|${input.en ?? ""}`;
  const hit = kept.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return Response.json(hit.value);

  const refused = await limited(request, "expand");
  if (refused) return refused;
  try {
    const value = await expandTopic(input);
    if (kept.size > 300) kept.clear();
    kept.set(key, { at: Date.now(), value });
    return Response.json(value);
  } catch (err) {
    return aiQuotaResponse(err) ?? Response.json({ error: "could not expand" }, { status: 502 });
  }
}

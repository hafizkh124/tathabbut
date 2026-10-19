// POST /api/event  { "event": "visit" | "share" | …, "device", "source", "locale", "referrer", "data": {…} }  →  204
// What the page reports of its own use (src/lib/analytics.ts, sent with navigator.sendBeacon); stored by src/lib/events.ts.
import { CLIENT_EVENTS, eventRow, logEvent } from "@/lib/events";
import { later } from "@/lib/later";
import { clientAddress, clientKey, memoryCheck } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const MAX_BODY = 4_000;

export async function POST(request: Request) {
  let body: { event?: unknown; device?: unknown; source?: unknown; locale?: unknown; referrer?: unknown; data?: unknown };
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return new Response(null, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }
  const event = typeof body.event === "string" ? body.event : "";
  if (!CLIENT_EVENTS.has(event)) return new Response(null, { status: 400 });
  // enough for any page; stops a loop from filling the table
  if (!memoryCheck(`event:${clientKey(clientAddress(request.headers))}`, 60)) return new Response(null, { status: 429 });

  const data = body.data && typeof body.data === "object" && !Array.isArray(body.data) ? (body.data as Record<string, unknown>) : null;
  const row = eventRow(request, event, data, body);
  later(() => logEvent(row));
  return new Response(null, { status: 204 });
}

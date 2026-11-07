// The specialist's review of "Is this result wrong?" reports (table reports, migration 009). Guarded by ADMIN_TOKEN.
//   GET   /api/admin/reports?reviewed=false|true|all&limit=100   →  { reports: [{ id, text, query, state, locale, reviewed, created_at }] }
//   PATCH /api/admin/reports  { id: number, reviewed: boolean }  →  { ok: true }
import { isAdmin, noteFailure, tooManyFailures } from "@/lib/adminAuth";
import { restHeaders, serviceConfig } from "@/lib/supabaseRest";

export const dynamic = "force-dynamic";

const ip = (request: Request) => request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

function denied(request: Request): Response | null {
  const from = ip(request);
  if (tooManyFailures(from)) return Response.json({ error: "too many attempts, try again in a minute" }, { status: 429 });
  if (isAdmin(request)) return null;
  noteFailure(from);
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  const refused = denied(request);
  if (refused) return refused;
  const cfg = serviceConfig();
  if (!cfg) return Response.json({ error: "Supabase is not configured" }, { status: 503 });

  const params = new URL(request.url).searchParams;
  const which = params.get("reviewed");
  const limit = Math.min(Math.max(Number.parseInt(params.get("limit") ?? "100", 10) || 100, 1), 500);
  const filter = which === "true" ? "&reviewed=eq.true" : which === "all" ? "" : "&reviewed=eq.false";
  try {
    const res = await fetch(`${cfg.url}/rest/v1/reports?select=id,text,query,state,locale,reviewed,created_at&order=created_at.desc&limit=${limit}${filter}`, {
      headers: restHeaders(cfg.key),
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(String(res.status));
    return Response.json({ reports: await res.json() });
  } catch {
    return Response.json({ error: "could not read the reports" }, { status: 502 });
  }
}

export async function PATCH(request: Request) {
  const refused = denied(request);
  if (refused) return refused;
  const cfg = serviceConfig();
  if (!cfg) return Response.json({ error: "Supabase is not configured" }, { status: 503 });

  let body: { id?: unknown; reviewed?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON: { id, reviewed }" }, { status: 400 });
  }
  if (typeof body.id !== "number" || !Number.isSafeInteger(body.id) || body.id < 1 || typeof body.reviewed !== "boolean") {
    return Response.json({ error: "id must be a positive integer and reviewed a boolean" }, { status: 400 });
  }
  try {
    const res = await fetch(`${cfg.url}/rest/v1/reports?id=eq.${body.id}`, {
      method: "PATCH",
      headers: { ...restHeaders(cfg.key), Prefer: "return=minimal" },
      body: JSON.stringify({ reviewed: body.reviewed }),
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(String(res.status));
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "could not save" }, { status: 502 });
  }
}

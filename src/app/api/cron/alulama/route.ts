// GET /api/cron/alulama: the daily upkeep of our copy of العلماء (src/lib/alulamaSync.ts). Called by Vercel's cron with
// «Authorization: Bearer <CRON_SECRET>»; without that secret set, or with another, it does nothing.
import { timingSafeEqual } from "node:crypto";
import { syncAlulama } from "@/lib/alulamaSync";
import { serviceConfig } from "@/lib/supabaseRest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const cfg = serviceConfig();
  if (!cfg) return Response.json({ error: "Supabase is not configured" }, { status: 503 });
  try {
    return Response.json(await syncAlulama(cfg));
  } catch (err) {
    return Response.json({ ok: false, error: (err as Error).message.slice(0, 200) }, { status: 502 });
  }
}

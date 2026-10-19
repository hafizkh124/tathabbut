// GET /api/version: which deployment is live (its commit), so an app left open or installed on a phone can tell the person
// a newer version is ready (src/lib/updateWatch.ts). Nothing secret, never cached.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ id: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev" }, { headers: { "Cache-Control": "no-store" } });
}

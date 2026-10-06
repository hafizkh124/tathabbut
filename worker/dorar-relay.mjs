// Cloudflare Worker that relays calls to dorar.net (dorar.net answers 403 to Vercel's IPs; checked 2026-10-03,
// and from this Worker it answers 200). The app reaches it through DORAR_RELAY_URL / DORAR_RELAY_KEY (src/lib/dorar.ts):
//   GET /dorar?skey=<text>   with header  x-relay-key: <secret>
// Returns Dorar's own JSON untouched. Only the one fixed Dorar endpoint can be reached through it.
// Plain JavaScript on purpose: it is deployed on its own with wrangler and is not part of the Next build.

const DORAR_ENDPOINT = "https://dorar.net/dorar_api.json";
const UA = "Tathabbut/0.1 (Islamic AI Challenge 2026; +https://github.com/hafizkh124/tathabbut)";
const MAX_QUERY_LENGTH = 300;
const CACHE_SECONDS = 3600;

const json = (status, body) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

async function sameKey(given, secret) {
  const enc = new TextEncoder();
  const a = enc.encode(given);
  const b = enc.encode(secret);
  return a.byteLength === b.byteLength && crypto.subtle.timingSafeEqual(a, b);
}

const worker = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method !== "GET" || url.pathname !== "/dorar") return json(404, { error: "not found" });
    if (!env.DORAR_RELAY_KEY || !(await sameKey(request.headers.get("x-relay-key") ?? "", env.DORAR_RELAY_KEY))) {
      return json(401, { error: "unauthorized" });
    }
    const query = (url.searchParams.get("skey") ?? "").trim();
    if (!query || query.length > MAX_QUERY_LENGTH) return json(400, { error: "bad query" });
    // Only these extra Dorar parameters pass, and only as small numbers: a book filter (s[]=6216 is Sahih
    // al-Bukhari, s[]=3088 Sahih Muslim — checked 2026-10-04) and a result page.
    const books = url.searchParams.getAll("s[]");
    const page = url.searchParams.get("page");
    if (books.length > 4 || books.some((b) => !/^\d{1,6}$/.test(b)) || (page !== null && !/^[1-5]$/.test(page))) {
      return json(400, { error: "bad parameter" });
    }
    const extra = books.map((b) => `&s[]=${b}`).join("") + (page ? `&page=${page}` : "");
    const target = `${DORAR_ENDPOINT}?skey=${encodeURIComponent(query)}${extra}`;

    // A good answer is reused for an hour; a failure is never remembered.
    const cacheKey = new Request(`https://relay.cache/dorar?skey=${encodeURIComponent(query)}${extra}`);
    const cached = await caches.default.match(cacheKey);
    if (cached) return json(200, await cached.text());

    let upstream;
    try {
      upstream = await fetch(target, {
        headers: { "User-Agent": UA, "Accept-Language": "ar,en;q=0.9" },
      });
    } catch {
      return json(502, { error: "dorar unreachable" });
    }
    const body = await upstream.text();
    if (upstream.status !== 200) {
      // Visible with `wrangler tail`: which Cloudflare data centre we ran in and what Dorar answered.
      console.log(JSON.stringify({ upstream: upstream.status, colo: request.cf?.colo, cfRay: upstream.headers.get("cf-ray"), bodyStart: body.slice(0, 400) }));
    }
    if (upstream.status === 200) {
      ctx.waitUntil(
        caches.default.put(cacheKey, new Response(body, { headers: { "Cache-Control": `max-age=${CACHE_SECONDS}` } })),
      );
    }
    return json(upstream.status, body);
  },
};

export default worker;

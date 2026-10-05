import { describe, expect, it, vi } from "vitest";
import type { TurathLookupOutcome } from "./hadithMatch";
import { cacheKey, CACHE_TTL_MS, isCacheable, supabaseTranslationCache, supabaseTurathCache, textHash, withCache, type TurathCache } from "./turathCache";

const cfg = { url: "https://p.supabase.co", key: "sb_secret_x" };
const ref = { excerpt: "نص", citation: "ك", book: { id: "1", title: "كتاب" }, bookId: "1", url: "https://app.turath.io/book/1" };
const ok: TurathLookupOutcome = { status: "success", references: [ref] };

const respond = (body: unknown, status = 200) => vi.fn(async () => ({ ok: status < 400, status, json: async () => body }) as unknown as Response);
const urlOf = (f: ReturnType<typeof vi.fn>, i = 0) => String((f.mock.calls[i] as unknown as [string])[0]);

describe("cache key and hash", () => {
  it("is one spelling for a text typed with or without diacritics and with extra spaces", () => {
    expect(cacheKey("  إِنَّمَا   الأعمال بالنيات ")).toBe(cacheKey("إنما الأعمال بالنيات"));
  });
  it("hashes the Arabic text to a sha-256 hex", () => {
    expect(textHash("نص")).toMatch(/^[0-9a-f]{64}$/);
    expect(textHash("نص")).toBe(textHash("نص"));
    expect(textHash("نص")).not.toBe(textHash("نص "));
  });
  it("remembers only a successful and complete answer", () => {
    expect(isCacheable(ok)).toBe(true);
    expect(isCacheable({ status: "success", references: [], partial: true })).toBe(false);
    expect(isCacheable({ status: "unavailable", references: [] })).toBe(false);
  });
});

describe("supabaseTurathCache", () => {
  it("asks for the row of this query and kind, no older than 30 days, and returns it", async () => {
    const f = respond([{ result: ok }]);
    vi.stubGlobal("fetch", f);
    const now = Date.parse("2026-10-05T12:00:00Z");
    const hit = await supabaseTurathCache(cfg, 3000, () => now).get("hadith", "إنما الأعمال بالنيات");
    vi.unstubAllGlobals();

    expect(hit).toEqual(ok);
    const url = urlOf(f);
    expect(url).toContain("/rest/v1/turath_cache?select=result");
    expect(url).toContain(`query_key=eq.${encodeURIComponent(cacheKey("إنما الأعمال بالنيات"))}`);
    expect(url).toContain("kind=eq.hadith");
    expect(decodeURIComponent(url.split("fetched_at=gte.")[1].split("&")[0])).toBe(new Date(now - CACHE_TTL_MS).toISOString());
  });

  it("says nothing cached on no row, an HTTP error, a network error or a row that is not a complete success", async () => {
    const offline = vi.fn(async () => {
      throw new Error("offline");
    });
    for (const f of [respond([]), respond({}, 404), offline, respond([{ result: { status: "unavailable", references: [] } }])]) {
      vi.stubGlobal("fetch", f);
      expect(await supabaseTurathCache(cfg).get("fiqh", "سجود السهو")).toBeNull();
    }
    vi.unstubAllGlobals();
  });

  it("is a no-op, never a throw, when Supabase is not configured", async () => {
    const cache = supabaseTurathCache(null);
    expect(await cache.get("hadith", "نص")).toBeNull();
    await expect(cache.put("hadith", "نص", ok)).resolves.toBeUndefined();
  });

  it("writes an upsert of a complete answer and does not write an outage or a partial answer", async () => {
    const f = respond({}, 201);
    vi.stubGlobal("fetch", f);
    const cache = supabaseTurathCache(cfg, 3000, () => Date.parse("2026-10-05T12:00:00Z"));
    await cache.put("scholar_quote", "قيمة كل امرئ ما يحسنه", ok);
    await cache.put("scholar_quote", "قيمة كل امرئ ما يحسنه", { status: "unavailable", references: [] });
    await cache.put("scholar_quote", "قيمة كل امرئ ما يحسنه", { status: "success", references: [ref], partial: true });
    vi.unstubAllGlobals();

    expect(f).toHaveBeenCalledOnce();
    expect(urlOf(f)).toContain("turath_cache?on_conflict=query_key,kind");
    const [, init] = f.mock.calls[0] as unknown as [string, { method: string; body: string; headers: Record<string, string> }];
    expect(init.method).toBe("POST");
    expect(init.headers.Prefer).toContain("merge-duplicates");
    expect(JSON.parse(init.body)).toMatchObject({ query_key: cacheKey("قيمة كل امرئ ما يحسنه"), kind: "scholar_quote", result: ok, fetched_at: "2026-10-05T12:00:00.000Z" });
  });
});

describe("supabaseTranslationCache", () => {
  it("looks a translation up by the hash of the passage and the language", async () => {
    const f = respond([{ translation: "ترجمہ" }]);
    vi.stubGlobal("fetch", f);
    expect(await supabaseTranslationCache(cfg).get("نص", "ur")).toBe("ترجمہ");
    vi.unstubAllGlobals();
    expect(urlOf(f)).toContain(`turath_translations?select=translation&text_hash=eq.${textHash("نص")}&lang=eq.ur`);
  });

  it("returns null when absent, and writes the hash with the language and the model", async () => {
    vi.stubGlobal("fetch", respond([]));
    expect(await supabaseTranslationCache(cfg).get("نص", "en")).toBeNull();
    const f = respond({}, 201);
    vi.stubGlobal("fetch", f);
    await supabaseTranslationCache(cfg).put("نص", "en", "text", "gemini-x");
    vi.unstubAllGlobals();
    const body = JSON.parse((f.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(body).toMatchObject({ text_hash: textHash("نص"), lang: "en", translation: "text", model: "gemini-x" });
  });
});

describe("withCache", () => {
  const memory = (): TurathCache => {
    const rows = new Map<string, TurathLookupOutcome>();
    return {
      get: async (kind, q) => rows.get(`${kind}:${cacheKey(q)}`) ?? null,
      put: async (kind, q, o) => {
        if (isCacheable(o)) rows.set(`${kind}:${cacheKey(q)}`, o);
      },
    };
  };

  it("looks up once, then answers the same question from the cache", async () => {
    const lookup = vi.fn(async () => ok);
    const cached = withCache(lookup, memory());
    expect(await cached("نص", "hadith")).toEqual(ok);
    expect(await cached("  نَصّ ", "hadith")).toEqual(ok);
    expect(lookup).toHaveBeenCalledOnce();
  });

  it("does not serve a hadith's answer for the same words asked as a fiqh topic", async () => {
    const lookup = vi.fn(async () => ok);
    const cached = withCache(lookup, memory());
    await cached("سجود السهو", "hadith");
    await cached("سجود السهو", "fiqh");
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it("asks again after an outage: an unavailable answer is not remembered", async () => {
    const lookup = vi.fn<() => Promise<TurathLookupOutcome>>().mockResolvedValueOnce({ status: "unavailable", references: [] }).mockResolvedValueOnce(ok);
    const cached = withCache(lookup, memory());
    expect((await cached("نص", "hadith")).status).toBe("unavailable");
    expect((await cached("نص", "hadith")).status).toBe("success");
    expect(lookup).toHaveBeenCalledTimes(2);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import type { DorarLookup, DorarResult } from "./dorar";
import { supabaseDorarCache, type CachedAnswer, type DorarCache } from "./dorarCache";
import { FRESH_MS, lookupDorar } from "./lookup";

const result = (matn: string): DorarResult => ({ rank: 1, matn, verdict: "لا يصح" });
const NOW = Date.parse("2026-10-03T12:00:00Z");
const ago = (ms: number): Date => new Date(NOW - ms);

function fakeCache(initial: CachedAnswer | null) {
  const put = vi.fn(async () => {});
  const cache: DorarCache = { get: vi.fn(async () => initial), put };
  return { cache, put };
}
const liveOk = (matn = "live"): DorarLookup => ({ ok: true, results: [result(matn)] });

describe("lookupDorar", () => {
  it("uses a fresh cached answer without calling Dorar", async () => {
    const { cache, put } = fakeCache({ results: [result("cached")], fetchedAt: ago(1000) });
    const search = vi.fn();
    const r = await lookupDorar("اختلاف أمتي رحمة", { cache, search, now: () => NOW });
    expect(r).toMatchObject({ ok: true, origin: "cache" });
    expect(search).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it("asks Dorar on a miss and remembers the answer under the normalized query", async () => {
    const { cache, put } = fakeCache(null);
    const r = await lookupDorar("اختِلافُ أُمَّتي رَحمةٌ", { cache, search: async () => liveOk(), now: () => NOW });
    expect(r).toMatchObject({ ok: true, origin: "live" });
    expect(put).toHaveBeenCalledWith("اختلاف امتي رحمه", [expect.objectContaining({ matn: "live" })]);
  });

  it("treats an answer older than the freshness window as a miss", async () => {
    const { cache } = fakeCache({ results: [result("old")], fetchedAt: ago(FRESH_MS + 1) });
    const r = await lookupDorar("x", { cache, search: async () => liveOk("new"), now: () => NOW });
    expect(r).toMatchObject({ ok: true, origin: "live", results: [expect.objectContaining({ matn: "new" })] });
  });

  it("falls back to an old cached answer, and says so, when Dorar cannot be reached", async () => {
    const { cache } = fakeCache({ results: [result("old")], fetchedAt: ago(FRESH_MS * 2) });
    const r = await lookupDorar("x", { cache, search: async () => ({ ok: false, error: "http", detail: "403" }), now: () => NOW });
    expect(r).toMatchObject({ ok: true, origin: "stale-cache", results: [expect.objectContaining({ matn: "old" })] });
  });

  it("reports the failure when Dorar is down and nothing is cached", async () => {
    const { cache } = fakeCache(null);
    const r = await lookupDorar("x", { cache, search: async () => ({ ok: false, error: "http", detail: "403" }), now: () => NOW });
    expect(r).toEqual({ ok: false, error: "http", detail: "403" });
  });

  it("returns an empty list, and never an old cache, when Dorar answers 'nothing found'", async () => {
    const { cache, put } = fakeCache({ results: [result("old")], fetchedAt: ago(FRESH_MS * 2) });
    const r = await lookupDorar("x", { cache, search: async () => ({ ok: false, error: "empty" }), now: () => NOW });
    expect(r).toEqual({ ok: true, results: [], origin: "live" });
    expect(put).not.toHaveBeenCalled();
  });
});

describe("supabaseDorarCache", () => {
  afterEach(() => vi.unstubAllGlobals());
  const cfg = { url: "https://p.supabase.co/", key: "sb_secret_abc" };

  it("reads by the normalized key, with the new-style key in apikey only", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json([{ results: [result("a")], fetched_at: "2026-10-01T00:00:00Z" }]));
    vi.stubGlobal("fetch", fetchMock);
    const got = await supabaseDorarCache(cfg).get("اختلاف امتي رحمه");
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toBe(`https://p.supabase.co/rest/v1/dorar_cache?select=results,fetched_at&query_clean=eq.${encodeURIComponent("اختلاف امتي رحمه")}&limit=1`);
    expect(init.headers.apikey).toBe("sb_secret_abc");
    expect(init.headers.Authorization).toBeUndefined();
    expect(got?.fetchedAt.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("upserts on the query key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    await supabaseDorarCache(cfg).put("k", [result("a")]);
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string>; body: string }];
    expect(url).toContain("dorar_cache?on_conflict=query_clean");
    expect(init.method).toBe("POST");
    expect(init.headers.Prefer).toContain("merge-duplicates");
    expect(JSON.parse(init.body)).toMatchObject({ query_clean: "k" });
  });

  it("never throws: a broken or unconfigured cache just means 'nothing cached'", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(await supabaseDorarCache(cfg).get("k")).toBeNull();
    await expect(supabaseDorarCache(cfg).put("k", [])).resolves.toBeUndefined();
    expect(await supabaseDorarCache(null).get("k")).toBeNull();
    await expect(supabaseDorarCache(null).put("k", [])).resolves.toBeUndefined();
  });

  it("sends the old JWT-style key as Bearer too", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json([]));
    vi.stubGlobal("fetch", fetchMock);
    await supabaseDorarCache({ url: "https://p.supabase.co", key: "eyJhbGciOi.jwt.sig" }).get("k");
    const [, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(init.headers.Authorization).toBe("Bearer eyJhbGciOi.jwt.sig");
  });
});

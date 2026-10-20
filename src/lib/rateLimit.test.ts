import { describe, expect, it, vi } from "vitest";
import { checkRateLimit, clientAddress, clientKey, dailyAiLimit, limited, memoryCheck, RULES, rulesFor, secondsLeft, tooManyResponse } from "./rateLimit";
import { EVAL_RUN_ENV } from "./evalRun";
import { logEvent } from "./events";
import { cachedAnswer } from "./sharedClaims";

const request = (ip = "203.0.113.7") => new Request("http://x/api/verify", { method: "POST", headers: { "x-forwarded-for": `${ip}, 10.0.0.1` } });
const cfg = { url: "http://db", key: "k" };

describe("rate limit", () => {
  it("reads the client's own address, not the proxy's", () => {
    expect(clientAddress(request().headers)).toBe("203.0.113.7");
    expect(clientAddress(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
  });

  it("keeps only a keyed hash of the address", () => {
    const key = clientKey("203.0.113.7", "secret");
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(key).not.toContain("203");
    expect(clientKey("203.0.113.7", "secret")).toBe(key);
    expect(clientKey("203.0.113.7", "other")).not.toBe(key);
  });

  it("counts the client's minute, the client's day, then the site's day", () => {
    const rules = rulesFor("verify", "c", 1000);
    expect(rules.map((r) => r.key)).toEqual(["verify:min:c", "verify:day:c", "ai:day:all"]);
    expect(rulesFor("verify", "c", 0)).toHaveLength(2); // site limit off
    expect(rulesFor("alulama", "c", 1000).map((r) => r.key)).toEqual(["alulama:min:c", "alulama:day:c"]); // no AI, no site AI limit
    expect(dailyAiLimit()).toBe(0); // off unless DAILY_AI_LIMIT is set: the free tier bills nothing
  });

  it("lets a request through when the database says all rules are within", async () => {
    const call = vi.fn().mockResolvedValue(0);
    await expect(checkRateLimit(request(), "verify", { cfg, call })).resolves.toEqual({ ok: true });
    const args = call.mock.calls[0][2];
    expect(args.p_keys[0]).toMatch(/^verify:min:[0-9a-f]{32}$/);
    expect(args.p_windows.slice(0, 2)).toEqual([60, 86_400]);
  });

  it("names whose limit refused it: the client's or the site's", async () => {
    const client = await checkRateLimit(request(), "verify", { cfg, call: vi.fn().mockResolvedValue(1) });
    expect(client).toMatchObject({ ok: false, scope: "client" });
    vi.stubEnv("DAILY_AI_LIMIT", "1000"); // the site's limit is a third rule only when it is set
    const site = await checkRateLimit(request(), "verify", { cfg, call: vi.fn().mockResolvedValue(3) });
    expect(site).toMatchObject({ ok: false, scope: "site" });
    vi.unstubAllEnvs();
  });

  it("falls back to this instance's memory when the database fails, and still stops a loop", async () => {
    const call = vi.fn().mockRejectedValue(new Error("down"));
    const ip = "192.0.2.99";
    const results = [];
    const limit = RULES.verify.perMinute;
    for (let i = 0; i <= limit; i++) results.push((await checkRateLimit(request(ip), "verify", { cfg, call })).ok);
    expect(results.filter(Boolean)).toHaveLength(limit);
    expect(results.at(-1)).toBe(false);
  });

  it("memory check forgets after a minute", () => {
    const t = 1_000_000;
    expect(memoryCheck("m", 1, t)).toBe(true);
    expect(memoryCheck("m", 1, t + 1_000)).toBe(false);
    expect(memoryCheck("m", 1, t + 61_000)).toBe(true);
  });

  it("answers 429 with Retry-After", async () => {
    expect(secondsLeft(60, 125_000)).toBe(55);
    const res = tooManyResponse({ ok: false, scope: "site", retryAfter: 30 });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
    expect(await res.json()).toMatchObject({ limit: "site", retryAfter: 30 });
  });

  it("leaves an evaluation run out of the visitors' limits, cache and analytics", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    vi.stubEnv(EVAL_RUN_ENV, "1");
    try {
      expect(await limited(request(), "verify")).toBeNull();
      expect(await cachedAnswer("k", cfg)).toBeNull();
      await logEvent({ device: null, event: "verify", source: null, locale: null, country: null, region: null, city: null, referrer: null, data: null }, cfg);
      expect(f).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    }
  });
});

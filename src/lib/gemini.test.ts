import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fallbackModels, GeminiError, generateJson, jsonIn, quotaOf, resetQuotaMemory } from "./gemini";

const ok = (obj: unknown) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "thinking…", thought: true }, { text: JSON.stringify(obj) }] } }] }), { status: 200 });
const fail = (status: number) => new Response("{}", { status });
const noSleep = async () => {};
/** A free-tier 429 as Google sends it: which quota, and how long to wait. */
const quota = (quotaId: string, retryDelay?: string) =>
  new Response(
    JSON.stringify({
      error: {
        code: 429,
        status: "RESOURCE_EXHAUSTED",
        details: [
          { "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId }] },
          ...(retryDelay ? [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay }] : []),
        ],
      },
    }),
    { status: 429 },
  );
const perDay = () => quota("GenerateRequestsPerDayPerProjectPerModel-FreeTier");
const perMinute = (delay = "7s") => quota("GenerateRequestsPerMinutePerProjectPerModel-FreeTier", delay);
const schema = { type: "OBJECT" };

describe("generateJson", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-3.8-flash");
    vi.stubEnv("GEMINI_FALLBACK_MODEL", "gemini-2.5-flash");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    resetQuotaMemory();
  });

  it("sends the key in a header (never in the URL), the schema, and low thinking", async () => {
    const f = vi.fn().mockResolvedValue(ok({ a: 1 }));
    const r = await generateJson<{ a: number }>("hello", { schema }, { fetch: f, sleep: noSleep });
    expect(r).toMatchObject({ data: { a: 1 }, model: "gemini-3.8-flash" });
    const [url, init] = f.mock.calls[0] as [string, { headers: Record<string, string>; body: string }];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent");
    expect(url).not.toContain("test-key");
    expect(init.headers["x-goog-api-key"]).toBe("test-key");
    const body = JSON.parse(init.body);
    expect(body.generationConfig).toMatchObject({ responseMimeType: "application/json", responseSchema: schema, temperature: 0, thinkingConfig: { thinkingLevel: "low" } });
  });

  it("reports the token counts Gemini returns (for the evaluation's cost figure)", async () => {
    const body = { candidates: [{ content: { parts: [{ text: "{}" }] } }], usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 30, thoughtsTokenCount: 10, totalTokenCount: 160 } };
    const r = await generateJson("x", { schema }, { fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })), sleep: noSleep });
    expect(r.usage).toEqual({ promptTokens: 120, outputTokens: 30, thoughtsTokens: 10, totalTokens: 160 });
  });

  it("ignores thought parts and parses only the answer", async () => {
    const r = await generateJson("x", { schema }, { fetch: vi.fn().mockResolvedValue(ok({ claims: [] })), sleep: noSleep });
    expect(r.data).toEqual({ claims: [] });
  });

  it("retries a 429 on the same model, then uses the fallback (with the 2.x thinking setting)", async () => {
    const f = vi.fn().mockResolvedValueOnce(fail(429)).mockResolvedValueOnce(fail(503)).mockResolvedValueOnce(ok({ a: 2 }));
    const r = await generateJson("x", { schema }, { fetch: f, sleep: noSleep });
    expect(r.model).toBe("gemini-2.5-flash");
    expect(f).toHaveBeenCalledTimes(3);
    expect(JSON.parse((f.mock.calls[2] as [string, { body: string }])[1].body).generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
  });

  it("moves on through several fallback models, each with its own free quota", async () => {
    expect(fallbackModels(" gemini-2.5-flash , gemini-2.5-flash-lite ,")).toEqual(["gemini-2.5-flash", "gemini-2.5-flash-lite"]);
    expect(fallbackModels(undefined)).toEqual(["gemini-2.5-flash"]);
    const f = vi.fn().mockResolvedValueOnce(fail(429)).mockResolvedValueOnce(fail(429)).mockResolvedValueOnce(fail(429)).mockResolvedValueOnce(ok({ a: 3 }));
    const r = await generateJson("x", { schema, fallbackModel: "gemini-2.5-flash,gemini-2.5-flash-lite" }, { fetch: f, sleep: noSleep });
    expect(r.model).toBe("gemini-2.5-flash-lite");
    expect(f).toHaveBeenCalledTimes(4);
  });

  it("does not retry a request the API rejects (400)", async () => {
    const f = vi.fn().mockResolvedValue(fail(400));
    await expect(generateJson("x", { schema }, { fetch: f, sleep: noSleep })).rejects.toMatchObject({ status: 400 });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("sends images inline before the prompt", async () => {
    const f = vi.fn().mockResolvedValue(ok({}));
    await generateJson("read it", { schema, images: [{ mimeType: "image/png", data: "AAAA" }] }, { fetch: f, sleep: noSleep });
    const parts = JSON.parse((f.mock.calls[0] as [string, { body: string }])[1].body).contents[0].parts;
    expect(parts).toEqual([{ inline_data: { mime_type: "image/png", data: "AAAA" } }, { text: "read it" }]);
  });

  it("refuses to run without a key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(generateJson("x", { schema })).rejects.toBeInstanceOf(GeminiError);
  });

  it("reads which free-tier quota a 429 hit, and how long to wait", () => {
    expect(quotaOf(JSON.stringify({ error: { details: [{ violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" }] }] } }))).toEqual({ quota: "day" });
    expect(quotaOf(JSON.stringify({ error: { details: [{ violations: [{ quotaId: "GenerateRequestsPerMinutePerProjectPerModel-FreeTier" }] }, { retryDelay: "42.5s" }] } }))).toEqual({ quota: "minute", retryAfter: 43 });
    expect(quotaOf("not json")).toEqual({});
  });

  it("skips a model out for the day, on this call and the next", async () => {
    const f = vi.fn().mockResolvedValueOnce(perDay()).mockResolvedValueOnce(ok({ a: 1 })).mockResolvedValueOnce(ok({ a: 2 }));
    expect((await generateJson("x", { schema }, { fetch: f, sleep: noSleep })).model).toBe("gemini-2.5-flash");
    expect(f).toHaveBeenCalledTimes(2); // the spent model is not asked twice
    expect((await generateJson("x", { schema }, { fetch: f, sleep: noSleep })).model).toBe("gemini-2.5-flash");
    expect(f).toHaveBeenCalledTimes(3);
  });

  it("says the day's quota is spent when every model is out", async () => {
    const f = vi.fn().mockImplementation(async () => perDay());
    await expect(generateJson("x", { schema }, { fetch: f, sleep: noSleep })).rejects.toMatchObject({ status: 429, quota: "day" });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("waits for the soonest model when every one is busy for the minute, then tries it once more", async () => {
    const sleep = vi.fn(async () => {});
    const f = vi.fn().mockResolvedValueOnce(perMinute("9s")).mockResolvedValueOnce(perMinute("4s")).mockResolvedValueOnce(ok({ a: 1 }));
    const r = await generateJson("x", { schema }, { fetch: f, sleep });
    expect(r.model).toBe("gemini-2.5-flash");
    expect(sleep).toHaveBeenCalledWith(4_000);
  });

  it("gives up on a long wait and says when to try again", async () => {
    const f = vi.fn().mockImplementation(async () => perMinute("50s"));
    const err = await generateJson("x", { schema }, { fetch: f, sleep: noSleep }).catch((e: GeminiError) => e);
    expect(err).toMatchObject({ quota: "minute", retryAfter: 50 });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("passes over a fallback model the API does not know, and leaves it out from then on", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const f = vi.fn().mockResolvedValueOnce(perDay()).mockResolvedValueOnce(fail(404)).mockResolvedValueOnce(ok({ a: 1 }));
    const r = await generateJson("x", { schema, fallbackModel: "gemini-typo,gemini-2.5-flash" }, { fetch: f, sleep: noSleep });
    expect(r.model).toBe("gemini-2.5-flash");
    f.mockResolvedValueOnce(ok({ a: 2 }));
    await generateJson("x", { schema, fallbackModel: "gemini-typo,gemini-2.5-flash" }, { fetch: f, sleep: noSleep });
    expect(f.mock.calls.map((c) => String(c[0]).match(/models\/([^:]+)/)?.[1])).toEqual(["gemini-3.8-flash", "gemini-typo", "gemini-2.5-flash", "gemini-2.5-flash"]);
  });

  it("asks Gemma with the schema in the prompt and reads the JSON out of its reply", async () => {
    const f = vi.fn().mockResolvedValueOnce(perDay()).mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Here it is:\n```json\n{"a": 7}\n```' }] } }] }), { status: 200 }));
    const r = await generateJson<{ a: number }>("find the claims", { schema, fallbackModel: "gemma-4-31b-it" }, { fetch: f, sleep: noSleep });
    expect(r).toMatchObject({ data: { a: 7 }, model: "gemma-4-31b-it" });
    const body = JSON.parse((f.mock.calls[1] as [string, { body: string }])[1].body);
    expect(body.generationConfig).toEqual({ temperature: 0, thinkingConfig: { thinkingLevel: "minimal" } }); // no JSON mode or schema: Gemma refuses them
    expect(body.contents[0].parts.at(-1).text).toContain('{"type":"OBJECT"}');
  });

  it("asks an OpenAI-style provider named by its prefix, with the schema in the prompt and JSON mode", async () => {
    vi.stubEnv("IFM_BASE_URL", "https://api.example/v1/");
    vi.stubEnv("IFM_API_KEY", "ifm-key");
    const chat = new Response(JSON.stringify({ choices: [{ message: { content: '\n{"a": 9}', reasoning: "thinking {not json}" } }], usage: { prompt_tokens: 10, completion_tokens: 30, total_tokens: 40, completion_tokens_details: { reasoning_tokens: 25 } } }), { status: 200 });
    const f = vi.fn().mockResolvedValueOnce(perDay()).mockResolvedValueOnce(chat);
    const r = await generateJson<{ a: number }>("find the claims", { schema, fallbackModel: "ifm:IFM/K2-Horizon-375B-A23B" }, { fetch: f, sleep: noSleep });
    expect(r).toMatchObject({ data: { a: 9 }, model: "ifm:IFM/K2-Horizon-375B-A23B", usage: { promptTokens: 10, outputTokens: 5, thoughtsTokens: 25, totalTokens: 40 } });
    const [url, init] = f.mock.calls[1] as [string, { body: string; headers: Record<string, string> }];
    expect(url).toBe("https://api.example/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer ifm-key");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ model: "IFM/K2-Horizon-375B-A23B", response_format: { type: "json_object" } });
    expect(body.messages[0].content).toContain('{"type":"OBJECT"}');
    vi.unstubAllEnvs();
  });

  it("passes over a provider that is not set up or cannot read the picture, and reads its daily limit", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const f = vi.fn().mockResolvedValueOnce(perDay()).mockResolvedValueOnce(ok({ a: 1 }));
    const r = await generateJson("x", { schema, fallbackModel: "groq:openai/gpt-oss-120b,gemini-2.5-flash" }, { fetch: f, sleep: noSleep });
    expect(r.model).toBe("gemini-2.5-flash");
    expect(f).toHaveBeenCalledTimes(2); // the main model, out for the day, then 2.5: Groq without a key is never called
    const pic = vi.fn().mockResolvedValueOnce(perDay()).mockResolvedValueOnce(ok({ a: 2 }));
    vi.stubEnv("GROQ_API_KEY", "g");
    resetQuotaMemory();
    const p = await generateJson("x", { schema, images: [{ mimeType: "image/png", data: "AA" }], fallbackModel: "groq:openai/gpt-oss-120b,gemini-2.5-flash" }, { fetch: pic, sleep: noSleep });
    expect(p.model).toBe("gemini-2.5-flash"); // a picture skips the provider that reads none
    const first = vi.fn().mockResolvedValueOnce(ok({ a: 3 }));
    const q = await generateJson("x", { schema, images: [{ mimeType: "image/png", data: "AA" }], model: "groq:openai/gpt-oss-120b", fallbackModel: "gemini-2.5-flash" }, { fetch: first, sleep: noSleep });
    expect(q.model).toBe("gemini-2.5-flash"); // also when it is the first model
    vi.stubEnv("GROQ_API_KEY", "g");
    resetQuotaMemory();
    const limit = new Response('{"error":{"message":"Rate limit reached for model on tokens per day (TPD): Limit 200000"}}', { status: 429 });
    const g = vi.fn().mockResolvedValueOnce(perDay()).mockResolvedValueOnce(limit);
    const err = await generateJson("x", { schema, fallbackModel: "groq:openai/gpt-oss-120b" }, { fetch: g, sleep: noSleep }).catch((e: GeminiError) => e);
    expect(err).toMatchObject({ quota: "day" });
    vi.unstubAllEnvs();
  });

  it("does not ask a model that timed out again, and leaves it out for the next request too (2026-10-19)", async () => {
    const hang = () => Promise.reject(new Error("The operation was aborted due to timeout"));
    const f = vi.fn().mockImplementationOnce(hang).mockResolvedValueOnce(ok({ a: 1 }));
    const r = await generateJson("x", { schema, fallbackModel: "gemini-3.5-flash-lite" }, { fetch: f, sleep: noSleep });
    expect(r.model).toBe("gemini-3.5-flash-lite");
    expect(f).toHaveBeenCalledTimes(2); // the slow model once, not twice
    const g = vi.fn().mockResolvedValueOnce(ok({ a: 2 }));
    expect((await generateJson("x", { schema, fallbackModel: "gemini-3.5-flash-lite" }, { fetch: g, sleep: noSleep })).model).toBe("gemini-3.5-flash-lite");
    expect(String(g.mock.calls[0][0])).toContain("gemini-3.5-flash-lite"); // the slow one is skipped straight away
  });

  it("stops within the time budget and says it is busy when nothing answered in time", async () => {
    let t = 0;
    const slow = () => { t += 16_000; return Promise.reject(new Error("The operation was aborted due to timeout")); };
    const f = vi.fn().mockImplementation(slow);
    const err = await generateJson("x", { schema, fallbackModel: "a-1,a-2,a-3,a-4" }, { fetch: f, sleep: noSleep, now: () => t }).catch((e: GeminiError) => e);
    expect(f.mock.calls.length).toBeLessThanOrEqual(3); // 3 × 16 s passes the 45 s budget
    expect(err).toMatchObject({ status: 429, quota: "minute" });
  });

  it("finds the JSON object in a reply with or without a code fence", () => {
    expect(jsonIn('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(jsonIn('The answer: {"a":{"b":2}} done')).toBe('{"a":{"b":2}}');
  });
});

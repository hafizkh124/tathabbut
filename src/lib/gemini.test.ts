import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GeminiError, generateJson } from "./gemini";

const ok = (obj: unknown) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "thinking…", thought: true }, { text: JSON.stringify(obj) }] } }] }), { status: 200 });
const fail = (status: number) => new Response("{}", { status });
const noSleep = async () => {};
const schema = { type: "OBJECT" };

describe("generateJson", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-3.8-flash");
    vi.stubEnv("GEMINI_FALLBACK_MODEL", "gemini-2.5-flash");
  });
  afterEach(() => vi.unstubAllEnvs());

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
});

import { describe, expect, it, vi } from "vitest";
import { extractJsonFromText, trackClaimOrigin, type OriginReport } from "./originTracker";

describe("extractJsonFromText", () => {
  it("extracts json from raw JSON string", () => {
    const json = '{"estimatedDate": "2010", "sourcePlatform": "blog"}';
    expect(extractJsonFromText(json)).toEqual({ estimatedDate: "2010", sourcePlatform: "blog" });
  });

  it("extracts json enclosed in markdown code fences", () => {
    const text = 'Here is the analysis:\n```json\n{"estimatedDate": "2008", "sourcePlatform": "forum"}\n```\nHope it helps!';
    expect(extractJsonFromText(text)).toEqual({ estimatedDate: "2008", sourcePlatform: "forum" });
  });

  it("returns null for non-json text", () => {
    expect(extractJsonFromText("just plain text without any curly braces")).toBeNull();
  });
});

describe("trackClaimOrigin", () => {
  it("parses Gemini search grounding response and returns structured origin report", async () => {
    const mockGeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  estimatedDate: "2008ء کے لگ بھگ",
                  sourcePlatform: "اردو فورمز اور یاہو گروپس",
                  sourceUrl: "https://example.com/forum/thread/123",
                  snippet: "یہ میسج ای میل کے ذریعے پھیلنا شروع ہوا",
                  spreadPattern: "ای میل چینز اور ایس ایم ایس",
                  summary: "یہ تحریر سب سے پہلے 2008 کے قریب ای میل چینز کے ذریعے پھیلائی گئی تھی۔",
                }),
              },
            ],
          },
          groundingMetadata: {
            groundingChunks: [
              {
                web: {
                  uri: "https://example.com/forum/thread/123",
                  title: "بحث فورم موضوع",
                },
              },
              {
                web: {
                  uri: "https://example.org/blog/post",
                  title: "بلاگ آرکائیو",
                },
              },
            ],
          },
        },
      ],
    };

    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => mockGeminiResponse,
    })) as unknown as typeof fetch;

    const report: OriginReport = await trackClaimOrigin("پیغام کو دس لوگوں کو بھیجو", {
      fetch: mockFetch,
      apiKey: "test-fake-key",
      model: "gemini-2.5-flash",
    });

    expect(report.query).toBe("پیغام کو دس لوگوں کو بھیجو");
    expect(report.earliestRecord.estimatedDate).toBe("2008ء کے لگ بھگ");
    expect(report.earliestRecord.sourcePlatform).toBe("اردو فورمز اور یاہو گروپس");
    expect(report.groundingSources.length).toBe(2);
    expect(report.groundingSources[0].url).toBe("https://example.com/forum/thread/123");
    expect(report.summary).toContain("2008 کے قریب");
    expect(report.disclaimer).toContain("تنبیہ");
  });

  it("asks for the requested language and returns that language's disclaimer and fallbacks", async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: "not json" }] } }] }),
    }));
    const f = mockFetch as unknown as typeof fetch;

    const en = await trackClaimOrigin("x", { fetch: f, apiKey: "k", lang: "en" });
    expect(en.lang).toBe("en");
    expect(en.disclaimer).toMatch(/^Note:/);
    expect(en.earliestRecord.estimatedDate).toBe("Unknown");
    const sent = JSON.parse((mockFetch.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(sent.contents[0].parts[0].text).toContain("in clear English");

    const ar = await trackClaimOrigin("x", { fetch: f, apiKey: "k", lang: "ar" });
    expect(ar.disclaimer).toMatch(/^تنبيه/);
    expect(ar.earliestRecord.estimatedDate).toBe("غير معروف");

    const ur = await trackClaimOrigin("x", { fetch: f, apiKey: "k" });
    expect(ur.lang).toBe("ur");
  });

  it("throws error when API key is missing", async () => {
    const prevKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      await expect(trackClaimOrigin("نص")).rejects.toThrow("GEMINI_API_KEY is not set");
    } finally {
      process.env.GEMINI_API_KEY = prevKey;
    }
  });
});

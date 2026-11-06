import { describe, expect, it } from "vitest";
import { acceptTranslationHit, matchVersesByTranslation, type VerseHit } from "./quranCheck";

const hit = (surah: number, ayah: number, score: number, translation_words?: number): VerseHit => ({ surah, ayah, surah_name_ar: "", text_uthmani: "", text_clean: "", score, ...(translation_words ? { translation_words } : {}) });

// The scores measured on 2026-11-07 against the stored Urdu translations.
describe("acceptTranslationHit", () => {
  it("takes the right verse when it leads the next by 0.1", () => {
    expect(acceptTranslationHit([hit(13, 28, 0.545, 28), hit(3, 37, 0.43, 40), hit(31, 23, 0.4, 30)], 9)[0]?.ayah).toBe(28); // a post's wording of 13:28
    expect(acceptTranslationHit([hit(42, 51, 0.62, 42), hit(3, 37, 0.31, 40)], 22)[0]?.ayah).toBe(51);
  });
  it("refuses a verse the text only resembles: a lead under 0.1, or a score under 0.5", () => {
    expect(acceptTranslationHit([hit(7, 128, 0.57, 47), hit(2, 33, 0.48, 30)], 20)).toEqual([]); // lead 0.09
    expect(acceptTranslationHit([hit(3, 165, 0.8, 46), hit(8, 41, 0.79, 60), hit(9, 39, 0.79, 40)], 8)).toEqual([]); // a common phrase fits many verses
    expect(acceptTranslationHit([hit(40, 56, 0.35, 40)], 20)).toEqual([]);
    expect(acceptTranslationHit([], 9)).toEqual([]);
  });
  it("refuses a short text that only sits inside a long verse's translation (59:3: 7 words of 35, score 0.79)", () => {
    expect(acceptTranslationHit([hit(59, 3, 0.79, 35), hit(67, 6, 0.56, 30)], 7)).toEqual([]);
  });
  it("does not trust a hit without the translation's length", () => {
    expect(acceptTranslationHit([hit(13, 28, 0.9)], 9)).toEqual([]);
  });
});

describe("matchVersesByTranslation", () => {
  const cfg = { url: "https://x.supabase.co", key: "k" };
  const withRows = (rows: unknown, ok = true) => {
    const real = globalThis.fetch;
    globalThis.fetch = (async () => ({ ok, status: ok ? 200 : 404, json: async () => rows, text: async () => "no function" })) as unknown as typeof fetch;
    return () => void (globalThis.fetch = real);
  };
  it("a text under five words is not searched", async () => {
    expect(await matchVersesByTranslation("اللہ ہر چیز پر", "ur", cfg)).toEqual([]);
  });
  it("gives the accepted verse", async () => {
    const restore = withRows([hit(13, 28, 0.545, 28), hit(3, 37, 0.43, 40)]);
    try {
      expect((await matchVersesByTranslation("بے شک اللہ کے ذکر سے دلوں کو اطمینان ملتا ہے", "ur", cfg))[0]?.surah).toBe(13);
    } finally {
      restore();
    }
  });
  it("a function that is not there (migration 016 not run) is no match", async () => {
    const restore = withRows({}, false);
    try {
      expect(await matchVersesByTranslation("بے شک اللہ کے ذکر سے دلوں کو اطمینان ملتا ہے", "ur", cfg)).toEqual([]);
    } finally {
      restore();
    }
  });
});

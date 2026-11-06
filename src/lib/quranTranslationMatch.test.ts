import { describe, expect, it } from "vitest";
import { acceptTranslationHit, matchVersesByTranslation, type VerseHit } from "./quranCheck";

const hit = (surah: number, ayah: number, score: number): VerseHit => ({ surah, ayah, surah_name_ar: "", text_uthmani: "", text_clean: "", score });

// The scores measured on 2026-11-07 against the stored Urdu translations.
describe("acceptTranslationHit", () => {
  it("takes the right verse when it leads the next by 0.1", () => {
    expect(acceptTranslationHit([hit(13, 28, 0.545), hit(3, 37, 0.43), hit(31, 23, 0.4)])[0]?.ayah).toBe(28); // a post's wording of 13:28
    expect(acceptTranslationHit([hit(2, 286, 0.62), hit(23, 62, 0.5)])[0]?.ayah).toBe(286);
    expect(acceptTranslationHit([hit(33, 33, 0.52)])[0]?.ayah).toBe(33);
  });
  it("refuses a verse the text only resembles: a lead under 0.1, or a score under 0.5", () => {
    expect(acceptTranslationHit([hit(7, 128, 0.57), hit(2, 33, 0.48)])).toEqual([]); // lead 0.09
    expect(acceptTranslationHit([hit(3, 165, 0.8), hit(8, 41, 0.79), hit(9, 39, 0.79)])).toEqual([]); // a common phrase fits many verses
    expect(acceptTranslationHit([hit(40, 56, 0.35)])).toEqual([]);
    expect(acceptTranslationHit([])).toEqual([]);
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
    const restore = withRows([hit(13, 28, 0.545), hit(3, 37, 0.43)]);
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

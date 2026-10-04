import { describe, expect, it } from "vitest";
import { buildTranslationRows, buildVerseRows, validateQuranRows, type MushafDump, type TranslationDump } from "./quranData";

const mushaf: MushafDump = {
  data: {
    surahs: [
      { id: 1, name: "الفاتحة", ayahs: [{ number: 1, text: "﻿بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ" }, { number: 2, text: "﻿الْحَمْدُ لِلَّهِ" }] },
      { id: 112, name: "الإخلاص", ayahs: [{ number: 1, text: "﻿قُلْ هُوَ اللَّهُ أَحَدٌ" }] },
    ],
  },
};
const dump = (rows: [number | string, number | string, string][]): TranslationDump => ({
  ayahs: rows.map(([s, a, t]) => ({ surah_number: s, ayah_number: a, translated_text: t })),
});
const ur = dump([[1, 1, "شروع*<br />\n____________________<br />\n* حاشیہ"], ["1", "2", "سب تعریف"], [112, 1, "کہہ دیجئے"]]);
const en = dump([[1, 1, " 1. In the Name of Allâh"], [1, 2, " 2. All praise"], [112, 1, " 1. Say"]]);
const opts = { ayahs: 3, surahs: 2 };

describe("quran data", () => {
  const verses = buildVerseRows(mushaf, "m1");
  const trs = [...buildTranslationRows(ur, "ur", "t-ur"), ...buildTranslationRows(en, "en", "t-en")];

  it("drops the invisible mark and adds the search form", () => {
    expect(verses[0].text_uthmani.charCodeAt(0)).not.toBe(0xfeff);
    expect(verses[0].text_clean).toBe("بسم الله الرحمن الرحيم");
    expect(verses.map((v) => `${v.surah}:${v.ayah}`)).toEqual(["1:1", "1:2", "112:1"]);
  });

  it("cleans each translation and reads numbers given as strings", () => {
    expect(trs.find((t) => t.lang === "ur" && t.ayah === 1)?.text).toBe("شروع");
    expect(trs.find((t) => t.lang === "ur" && t.ayah === 2)?.surah).toBe(1);
    expect(trs.find((t) => t.lang === "en" && t.surah === 1 && t.ayah === 1)?.text).toBe("In the Name of Allâh");
  });

  it("accepts data that lines up", () => {
    expect(() => validateQuranRows(verses, trs, opts)).not.toThrow();
  });

  it("rejects a missing translation and names the ayah", () => {
    const short = trs.filter((t) => !(t.lang === "en" && t.surah === 112));
    expect(() => validateQuranRows(verses, short, opts)).toThrow(/en: expected 3 translations, got 2[\s\S]*112:1/);
  });

  it("rejects a translation for an ayah the mushaf does not have", () => {
    const extra = [...trs, { surah: 2, ayah: 1, lang: "ur" as const, text: "x", source_id: "t-ur" }];
    expect(() => validateQuranRows(verses, extra, opts)).toThrow(/not in the mushaf/);
  });

  it("rejects the wrong total", () => {
    expect(() => validateQuranRows(verses, trs)).toThrow(/expected 6236, got 3/);
  });

  it("rejects a translation that is empty once the footnotes are cut", () => {
    const empty = buildTranslationRows(dump([[1, 1, "<br />\n____________________<br />\nonly a note"], [1, 2, "a"], [112, 1, "b"]]), "ur", "t-ur");
    expect(() => validateQuranRows(verses, [...empty, ...buildTranslationRows(en, "en", "t-en")], opts)).toThrow(/ur 1:1: empty after cleaning/);
  });
});

import { describe, expect, it } from "vitest";
import { AYAH_COUNTS, SURAH_NAMES_AR, parseQuranReference, surahOfName, withoutReference } from "./quranReference";

describe("the tables", () => {
  it("hold 114 surahs and 6236 verses", () => {
    expect(SURAH_NAMES_AR).toHaveLength(114);
    expect(AYAH_COUNTS).toHaveLength(114);
    expect(AYAH_COUNTS.reduce((a, b) => a + b, 0)).toBe(6236);
  });
  it("find each surah by its Arabic name, its Urdu spelling and a Latin spelling", () => {
    expect(surahOfName(["الكهف"])).toBe(18);
    expect(surahOfName(["کہف"])).toBe(18);
    expect(surahOfName(["Al-Kahf"])).toBe(18);
    expect(surahOfName(["آل", "عمران"])).toBe(3);
    expect(surahOfName(["یٰس"])).toBe(36);
    expect(surahOfName(["توبہ"])).toBe(9);
    expect(surahOfName(["Ar-Rahman"])).toBe(55);
    expect(surahOfName(["the", "table"])).toBeNull();
  });
});

// The places live users named (shared_claims, 2026-10-19 to 2026-11-06).
describe("parseQuranReference — what people wrote", () => {
  const read = (text: string, kind = "quran") => {
    const r = parseQuranReference(text, { kind });
    return r && [r.surah, r.from, r.to];
  };
  it("a surah name, a colon and an Arabic-Indic number", () => {
    expect(read("البقرة: ٢٥٩")).toEqual([2, 259, 259]);
    expect(read("كهف: ١٩")).toEqual([18, 19, 19]);
    expect(read("مريم: ٧٣")).toEqual([19, 73, 73]);
  });
  it("«سورة», the surah, then «الآية» and the number", () => {
    expect(read("سورة الكهف الآية 18")).toEqual([18, 18, 18]);
  });
  it("a topic with the reference in brackets, the surah and ayah as numbers", () => {
    expect(read("دوسروں کا مذاق اُڑانا (سورہ الحجرات، آیت 49:11")).toEqual([49, 11, 11]);
    expect(read("والدین کے جذبات کو نظر انداز کرنا (سورہ الإسراء، آیت 17:23")).toEqual([17, 23, 23]);
  });
  it("a range of verses", () => {
    expect(read("سورہ توبہ، آیات 65-66")).toEqual([9, 65, 66]);
    expect(read("Quran 2:255-257", "other")).toEqual([2, 255, 257]);
  });
  it("English, with the number first or last", () => {
    expect(read("Surah Al-Kahf verse 18")).toEqual([18, 18, 18]);
    expect(read("verse 18 of Surah Kahf")).toEqual([18, 18, 18]);
  });
  it("digits alone count only with a sign that the text is about the Quran", () => {
    expect(read("2:255", "quran")).toEqual([2, 255, 255]);
    expect(read("2:255", "other")).toBeNull();
    expect(read("see Quran 2:255", "other")).toEqual([2, 255, 255]);
  });
  it("never invents a reference: a verse that does not exist, a time, a hadith number", () => {
    expect(read("البقرة: ٢٨٧")).toBeNull();
    expect(read("سورة الفاتحة آية 8")).toBeNull();
    expect(read("meet at 5:30 tomorrow", "other")).toBeNull();
    expect(read("صحیح مسلم : 250", "hadith")).toBeNull();
    expect(read("ص 153", "other")).toBeNull();
  });
  it("tells what is left of the text once the reference is taken out", () => {
    const text = "البقرة: ٢٥٩";
    const ref = parseQuranReference(text, { kind: "quran" })!;
    expect(withoutReference(text, ref)).toBe("");
  });
});

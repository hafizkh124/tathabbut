import { describe, expect, it, vi } from "vitest";
import { addReferenceClaims, extractClaims } from "./claims";

// Live case, 2026-11-07: a post that is only «سورة الكهف الآية 18» gave the model nothing to call a claim, so the verse was never looked up.
describe("addReferenceClaims", () => {
  it("a post that is only a verse reference becomes a Quran claim", () => {
    const [c] = addReferenceClaims("سورة الكهف الآية 18", []);
    expect(c).toMatchObject({ kind: "quran", textAsWritten: "سورة الكهف الآية 18", arabicSpan: null });
    const [d] = addReferenceClaims("البقرة: ٢٥٩", []);
    expect(d.kind).toBe("quran");
  });
  it("a post that is only a book and a number becomes a hadith claim", () => {
    const [c] = addReferenceClaims("Sahih Bukhari#187", []);
    expect(c).toMatchObject({ kind: "hadith", language: "en" });
    expect(addReferenceClaims("صحیح مسلم : 250", [])[0].kind).toBe("hadith");
  });
  it("a reference line beside the model's claims is added; one a claim already covers is not", () => {
    const hadith = { kind: "hadith" as const, textAsWritten: "إنما الأعمال بالنيات", spanCheck: "exact" as const, arabicSpan: "إنما الأعمال بالنيات", query: "إنما الأعمال بالنيات", queryIsTranslation: false, language: "ar" as const, attributedTo: null, citedSource: null, warnings: [] };
    const post = "إنما الأعمال بالنيات\nالبقرة: 259\nسورة الكهف الآية 18";
    expect(addReferenceClaims(post, [hadith]).map((c) => c.textAsWritten)).toEqual(["إنما الأعمال بالنيات", "البقرة: 259", "سورة الكهف الآية 18"]);
    const covered = { ...hadith, kind: "quran" as const, textAsWritten: "البقرة: 259" };
    expect(addReferenceClaims("البقرة: 259", [covered])).toHaveLength(1);
  });
  it("a line with a text beside its reference is left to the model", () => {
    expect(addReferenceClaims("اللہ تعالیٰ نے فرمایا کہ جو لوگ ایمان لائے اور نیک عمل کیے ان کے لیے باغات ہیں (البقرة: 25)", [])).toEqual([]);
    expect(addReferenceClaims("اپنی رائے سے کہا جاتا ہے کہ نماز میں سکون ضروری ہے، وغیرہ وغیرہ 2:25", [])).toEqual([]);
  });
  it("a number that is no reference adds nothing", () => {
    expect(addReferenceClaims("meet at 5:30", [])).toEqual([]);
    expect(addReferenceClaims("البقرة: ٢٨٧", [])).toEqual([]);
  });
});

describe("extractClaims", () => {
  it("gives the reference claim when the model finds none", async () => {
    const generate = vi.fn(async () => ({ data: { claims: [] }, model: "m", ms: 1 }));
    const r = await extractClaims("سورة الكهف الآية 18", { generate: generate as never });
    expect(r.claims).toHaveLength(1);
    expect(r.claims[0].kind).toBe("quran");
  });
});

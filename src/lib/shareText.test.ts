import { describe, expect, it } from "vitest";
import type { ClaimResult } from "./clientTypes";
import { buildShareText, sourceLine } from "./shareText";

const claim = { kind: "hadith", textAsWritten: "اطلبوا العلم ولو بالصين", query: "q", arabicSpan: "اطلبوا العلم ولو بالصين", language: "ar", queryIsTranslation: false, attributedTo: null, citedSource: null, warnings: [] } as unknown as ClaimResult["claim"];

const hadith = {
  claim,
  state: "ضعيف",
  basis: "dorar",
  notes: [],
  dorar: { narrations: [{ source: "السلسلة الضعيفة", reference: "416" }], summary: {}, externalUrls: {} },
} as unknown as ClaimResult;

const verse = {
  claim: { ...claim, kind: "quran", arabicSpan: "إن الله مع الصابرين" },
  state: "آية صحيحة النقل",
  basis: "quran",
  notes: [],
  verse: { surah: 2, ayah: 153, surahName: "سورة البقرة", text: "x" },
} as unknown as ClaimResult;

describe("share text", () => {
  it("names the book and page for a hadith, and the surah and verse for the Quran", () => {
    expect(sourceLine(hadith, "ar")).toBe("السلسلة الضعيفة — 416");
    expect(sourceLine(verse, "ar")).toBe("سورة البقرة، الآية 153");
    expect(sourceLine(verse, "en")).toBe("Surah البقرة, verse 153");
    expect(sourceLine(verse, "ur")).toBe("سورہ البقرة، آیت 153");
  });

  it("writes the claim, its result in the user's language and the source", () => {
    const text = buildShareText([hadith], "en");
    expect(text).toContain("«اطلبوا العلم ولو بالصين»");
    expect(text).toContain("Weak");
    expect(text).toContain("السلسلة الضعيفة — 416");
  });

  it("separates several claims", () => {
    expect(buildShareText([hadith, verse], "ar").split("\n\n").length).toBe(3);
  });
});

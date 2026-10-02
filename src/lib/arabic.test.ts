import { describe, expect, it } from "vitest";
import { matnOverlap, matnTokens, normalizeArabic } from "./arabic";

describe("normalizeArabic", () => {
  it("strips tashkeel and folds letter variants", () => {
    expect(normalizeArabic("إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ")).toBe("انما الاعمال بالنيات");
    expect(normalizeArabic("مُؤْمِنٌ عَلَى الصَّلاةِ")).toBe("مومن علي الصلاه");
  });

  it("folds Quranic small marks", () => {
    expect(normalizeArabic("وَمَا خَلَقْتُ ٱلْجِنَّ")).toBe("وما خلقت الجن");
  });
});

describe("matnOverlap", () => {
  it("matches an abridged narration to its fuller wording", () => {
    const full = matnTokens("إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى، فمن كانت هجرته إلى دنيا يصيبها");
    const short = matnTokens("إنما الأعمال بالنيات وإنما لكل امرئ ما نوى");
    expect(matnOverlap(full, short)).toBeGreaterThanOrEqual(0.5);
  });

  it("returns null when a side is too short to judge", () => {
    expect(matnOverlap(matnTokens("الدين"), matnTokens("الدين النصيحة لله ولرسوله"))).toBeNull();
  });
});

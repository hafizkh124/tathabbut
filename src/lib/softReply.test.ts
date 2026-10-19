import { describe, expect, it } from "vitest";
import type { ClaimResult } from "./clientTypes";
import { buildSoftReply, softReplyApplies } from "./softReply";
import { STATES } from "./states";

const base = (over: Partial<ClaimResult>): ClaimResult =>
  ({ claim: { kind: "hadith", textAsWritten: "اطلبوا العلم ولو بالصين", arabicSpan: "اطلبوا العلم ولو بالصين", query: "اطلبوا العلم ولو بالصين", language: "ar", warnings: [], spanCheck: "exact", queryIsTranslation: false, attributedTo: null, citedSource: null }, state: "شديد الضعف أو لا أصل له", basis: "dorar", notes: [], ...over }) as ClaimResult;

describe("softReplyApplies", () => {
  it("is for texts that do not hold, never for an accepted text or a question", () => {
    expect(softReplyApplies(base({}))).toBe(true);
    expect(softReplyApplies(base({ state: "ضعيف" }))).toBe(true);
    expect(softReplyApplies(base({ state: STATES.notFound }))).toBe(true);
    expect(softReplyApplies(base({ state: STATES.verseWrong }))).toBe(true);
    expect(softReplyApplies(base({ state: "مقبول" }))).toBe(false);
    expect(softReplyApplies(base({ state: STATES.fatwa, claim: { ...base({}).claim, kind: "question" } }))).toBe(false);
  });
});

describe("buildSoftReply", () => {
  it("names the verdict, the scholar and the source as the result has them, then the reminder", () => {
    const r = base({ dorar: { narrations: [{ matn: "m", rank: 1, source: "سلسلة الأحاديث الضعيفة", reference: "416", muhaddith: "الألباني", verdict: "باطل" }], summary: {} } as never });
    const text = buildSoftReply(r, "ur");
    expect(text).toContain("جزاک اللہ خیرا");
    expect(text).toContain("«اطلبوا العلم ولو بالصين»");
    expect(text).toContain("حکم:");
    expect(text).toContain("محدث: الألباني");
    expect(text).toContain("ماخذ: سلسلة الأحاديث الضعيفة، 416");
    expect(text).toContain("صحیح مسلم، مقدمہ 5");
  });

  it("says «not found» without calling the text fabricated", () => {
    const text = buildSoftReply(base({ state: STATES.notFound, basis: "none" }), "ur");
    expect(text).toContain("نہیں ملی");
    expect(text).not.toContain("موضوع");
    expect(text).not.toContain("محدث:");
  });

  it("adds the established alternative with its source, when it has one", () => {
    const text = buildSoftReply(base({}), "ar", { matn: "وَمَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا", source: "صحيح مسلم", reference: "2699" });
    expect(text).toContain("(اختيار آلي): «وَمَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا» (صحيح مسلم، 2699)");
  });

  it("is written in each of the three languages", () => {
    for (const locale of ["ar", "en", "ur"] as const) expect(buildSoftReply(base({}), locale)).not.toMatch(/\{\w+\}/);
  });
});

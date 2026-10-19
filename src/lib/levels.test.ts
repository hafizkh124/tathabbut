import { describe, expect, it } from "vitest";
import { levelOf } from "./levels";
import { summarize, summaryKind } from "./summary";
import { STATES } from "./states";

describe("levelOf (docs/04 §4.6, with the specialist's mapping for the states the table does not name)", () => {
  it.each([
    ["مقبول", "A"],
    [STATES.verseOk, "A"],
    [STATES.verseWrong, "A"],
    [STATES.verseContext, "A"],
    [STATES.verseTranslated, "A"],
    ["ضعيف", "B"],
    ["شديد الضعف أو لا أصل له", "B"],
    ["قول منسوب خطأً إلى النبي ﷺ", "B"],
    ["لفظ أو ترجمة غير دقيقة", "B"],
    ["غير حاسم", "C"],
    [STATES.notFound, "C"],
    [STATES.fiqh, "C"],
    [STATES.turathFound, "C"],
    [STATES.fatwa, "D"],
  ])("%s → %s", (state, level) => expect(levelOf(state)).toBe(level));

  it("reads an unknown wording as C, never as A", () => {
    expect(levelOf("حالة جديدة")).toBe("C");
    expect(levelOf("")).toBe("C");
  });
});

describe("summarize", () => {
  const four = ["مقبول", STATES.verseWrong, "شديد الضعف أو لا أصل له", STATES.notFound];

  it("counts established, problem and unresolved texts", () => {
    expect(summarize(four)).toEqual({ total: 4, established: 1, problem: 2, unresolved: 1, referral: 0 });
    expect(summarize([STATES.fatwa, "غير حاسم", STATES.verseOk])).toEqual({ total: 3, established: 1, problem: 0, unresolved: 1, referral: 1 });
  });

  it("chooses the sentence: none for one text, then all / none / one / some", () => {
    expect(summaryKind(summarize(["مقبول"]))).toBeNull();
    expect(summaryKind(summarize(["مقبول", STATES.verseOk]))).toBe("all");
    expect(summaryKind(summarize(["ضعيف", STATES.notFound]))).toBe("none");
    expect(summaryKind(summarize(four))).toBe("one");
    expect(summaryKind(summarize(["مقبول", STATES.verseOk, "ضعيف"]))).toBe("some");
  });
});

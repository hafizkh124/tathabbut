import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDorarHtml } from "./dorar";
import { selectRelevant, summarizeGrades, type GradedNarration } from "./hadithMatch";

// A real dorar.net answer for «اطلبوا العلم ولو بالصين» (saved 2026-10-02).
const results = parseDorarHtml(readFileSync(join(__dirname, "__fixtures__", "dorar_talab_al_ilm.html"), "utf-8"));

describe("selectRelevant", () => {
  it("keeps the narrations of this text and grades each with the specialist's rules", () => {
    const rel = selectRelevant("اطلبوا العلم ولو بالصين", results);
    expect(rel.length).toBeGreaterThan(5);
    expect(rel.every((r) => r.matchedBy)).toBe(true);
    expect(rel.find((r) => r.verdict === "باطل لا أصل له")?.grade).toBe("شديد الضعف أو لا أصل له");
  });

  it("keeps nothing for a text Dorar does not have, although Dorar still returns 15 results", () => {
    expect(results).toHaveLength(15);
    expect(selectRelevant("زيتون سماء كلام فرضي لا وجود له", results)).toEqual([]);
  });

  it("does not take a different saying that shares a phrase (live case: «من المهد إلى اللحد» vs «ولو بالصين»)", () => {
    expect(selectRelevant("اطلبوا العلم من المهد إلى اللحد", results)).toEqual([]);
  });

  it("still finds a narration quoted with a few extra words", () => {
    expect(selectRelevant("قال رسول الله اطلبوا العلم ولو بالصين يا قوم", results).length).toBeGreaterThan(0);
  });

  it("ignores harakat and hamza in the comparison", () => {
    expect(selectRelevant("اطْلُبُوا الْعِلْمَ وَلَوْ بِالصِّينِ", results).length).toBe(selectRelevant("اطلبوا العلم ولو بالصين", results).length);
  });
});

const n = (grade: GradedNarration["grade"], source?: string): GradedNarration => ({ rank: 1, matn: "x", grade, confidence: "high", caution: false, matchedBy: "contained", source });

describe("summarizeGrades (the specialist's rule)", () => {
  it("takes the grade most muhaddithun gave, not counting غير حاسم, and flags the dispute", () => {
    const s = summarizeGrades([n("مقبول"), n("مقبول"), n("ضعيف"), n("غير حاسم"), n("غير حاسم"), n("غير حاسم")]);
    expect(s).toMatchObject({ grade: "مقبول", disputed: true, inSahihayn: false });
  });

  it("does not flag a dispute when all explicit verdicts agree", () => {
    expect(summarizeGrades([n("ضعيف"), n("شديد الضعف أو لا أصل له"), n("غير حاسم")]).disputed).toBe(false);
  });

  it("a narration in Sahih al-Bukhari or Sahih Muslim makes it مقبول, with no dispute caution", () => {
    const s = summarizeGrades([n("ضعيف"), n("شديد الضعف أو لا أصل له"), n("ضعيف"), n("مقبول", "صحيح البخاري")]);
    expect(s).toMatchObject({ grade: "مقبول", disputed: false, inSahihayn: true });
    expect(summarizeGrades([n("ضعيف"), n("مقبول", "صحيح مسلم")]).grade).toBe("مقبول");
  });

  it("books that only carry the Sahihs' names do not count (all seen in Dorar)", () => {
    for (const src of ["أحاديث من صحيح البخاري أعلها الدارقطني", "شرح البخاري لابن عثيمين", "المستدرك على الصحيحين", "التاريخ الكبير", "شرح مسلم لابن عثيمين"]) {
      expect(summarizeGrades([n("ضعيف"), n("ضعيف"), n("مقبول", src)]).inSahihayn, src).toBe(false);
    }
  });

  it("breaks a tie towards the grade given in the higher book tier, before severity", () => {
    const s = summarizeGrades([n("مقبول", "سنن الترمذي"), n("مقبول", "سنن أبي داود"), n("ضعيف", "المعجم الكبير"), n("ضعيف", "شعب الإيمان")]);
    expect(s).toMatchObject({ grade: "مقبول", disputed: true });
    expect(summarizeGrades([n("مقبول", "المعجم الكبير"), n("ضعيف", "سنن الترمذي")]).grade).toBe("ضعيف");
  });

  it("breaks a tie towards the more severe grade", () => {
    expect(summarizeGrades([n("ضعيف"), n("شديد الضعف أو لا أصل له")]).grade).toBe("شديد الضعف أو لا أصل له");
    expect(summarizeGrades([n("مقبول"), n("ضعيف")])).toMatchObject({ grade: "ضعيف", disputed: true });
  });

  it("is غير حاسم when no verdict is explicit", () => {
    expect(summarizeGrades([n("غير حاسم")]).grade).toBe("غير حاسم");
    expect(summarizeGrades([]).grade).toBe("غير حاسم");
  });
});

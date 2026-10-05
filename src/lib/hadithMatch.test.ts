import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { TurathPassage } from "./turathApi";
import { describe, expect, it } from "vitest";
import { parseDorarHtml } from "./dorar";
import { adaptTurathPassages, MAX_TURATH_PASSAGE_CHARS, selectRelevant, summarizeGrades, type GradedNarration } from "./hadithMatch";

// A real dorar.net answer for «اطلبوا العلم ولو بالصين» (saved 2026-10-02).
const results = parseDorarHtml(readFileSync(join(__dirname, "__fixtures__", "dorar_talab_al_ilm.html"), "utf-8"));

describe("selectRelevant", () => {
  it("rejects the manufactured Thursday/Asr quotation against a Maghrib narration", () => {
    const query = "من صلى ركعتين يوم الخميس بعد العصر غفر الله له ذنوب أربعين سنة";
    const matn = "أفضل الصلاة عند الله صلاة المغرب وفيه من صلى بعدها ركعتين بنى الله له قصرين في الجنة ومن صلى بعدها أربع ركعات غفر له الله ذنوب عشرين أو قال أربعين سنة";
    expect(selectRelevant(query, [{ rank: 1, matn, verdict: "[لم أجد له إسنادا]" }])).toEqual([]);
    expect(selectRelevant(query, [{ rank: 1, matn: query, verdict: "موضوع" }])).toHaveLength(1);
  });
  it("preserves both shorter and expanded narrations and marks the wording difference", () => {
    const query = "الجنة تحت أقدام الأمهات";
    const r = selectRelevant(query, [
      { rank: 1, matn: query, verdict: "ضعيف" },
      { rank: 2, matn: `${query} من شئن أدخلن ومن شئن أخرجن`, verdict: "موضوع" },
    ]);
    expect(r).toHaveLength(2);
    expect(r[0].textVariant).toBeUndefined();
    expect(r[1]).toMatchObject({ textVariant: "additional", grade: "شديد الضعف أو لا أصل له" });
  });
  it("keeps the declared day and prayer while rejecting a change of either", () => {
    const query = "من صلى ركعتين يوم الخميس بعد العصر غفر الله له ذنوب أربعين سنة";
    for (const matn of [query.replace("الخميس", "السبت"), query.replace("العصر", "المغرب")]) {
      expect(selectRelevant(query, [{ rank: 1, matn, verdict: "ضعيف" }])).toEqual([]);
    }
    expect(selectRelevant(query, [{ rank: 1, matn: `نص اختباري ${query}`, verdict: "موضوع" }])).toHaveLength(1);
  });
  it("does not match a forwarding promise to the ten companions promised Paradise (live case, 2026-10-05)", () => {
    const unrelated = [{ rank: 1, matn: "[عن] عبدالرحمن بن الأخنس، قال: خطب المغيرة بن شعبة، فنال من علي، فقام سعيد بن زيد، فقال: ما تريد إلى هذا؟ أشهد على رسول الله لقال: عشرة في الجنة: رسول الله في الجنة، وأبو بكر في الجنة", verdict: "رجاله ثقات، إلا عبد الرحمن بن الاخنس لم يوثقه غير ابن حبان.", muhaddith: "شعيب الأرناؤوط", source: "تخريج سير أعلام النبلاء", number: "1/104" }];
    expect(selectRelevant("من أرسل هذا إلى عشرة فله الجنة", unrelated)).toEqual([]);
  });

  it("keeps a short quote when all its content words are present in the longer narration", () => {
    expect(selectRelevant("من أرسل هذا إلى عشرة فله الجنة", [{ rank: 1, matn: "نص اختباري مصطنع: من أرسل هذا إلى عشرة فله الجنة", verdict: "موضوع" }])).toHaveLength(1);
  });

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

const turathPassage = (over: Partial<TurathPassage> = {}): TurathPassage => ({
  book: { id: "42", title: "كتاب العلل" },
  author: { id: "9", name: "الإمام" },
  location: { internalPage: 17, printedPage: 84, volume: "2" },
  text: "نص المصدر",
  url: "https://app.turath.io/book/42?page=17",
  citation: "كتاب العلل، 2/84",
  rank: 1,
  totalMatches: 1,
  truncated: false,
  ...over,
});

describe("adaptTurathPassages", () => {
  it("preserves citation, book and author metadata, URL, rank, and distinct page locators", () => {
    const [reference] = adaptTurathPassages([turathPassage()]);
    expect(reference).toMatchObject({
      excerpt: "نص المصدر",
      citation: "كتاب العلل، 2/84",
      book: { id: "42", title: "كتاب العلل" },
      author: { id: "9", name: "الإمام" },
      bookId: "42",
      pageLocator: { internalPage: 17, printedPage: 84, volume: "2" },
      url: "https://app.turath.io/book/42?page=17",
      provenance: { rank: 1, totalMatches: 1, truncated: false },
    });
  });

  it("labels each reference with the category it was searched in", () => {
    const [reference] = adaptTurathPassages([turathPassage()], { id: "6", title: "كتب السنة" });
    expect(reference.category).toEqual({ id: "6", title: "كتب السنة" });
  });

  it("deduplicates by Turath book ID and internal page, not by printed page", () => {
    const references = adaptTurathPassages([
      turathPassage(),
      turathPassage({ text: "duplicate page", citation: "alternate citation" }),
      turathPassage({ location: { internalPage: 18, printedPage: 84, volume: "2" } }),
      turathPassage({ book: { id: "43", title: "كتاب آخر" } }),
    ]);
    expect(references).toHaveLength(3);
    expect(references.map((reference) => [reference.bookId, reference.pageLocator?.internalPage])).toEqual([
      ["42", 17], ["42", 18], ["43", 17],
    ]);
  });

  it("keeps Turath's explicit search rank in best-first order", () => {
    const later = turathPassage({ book: { id: "44", title: "كتاب آخر" }, citation: "المرتبة الثانية", location: { internalPage: 9 }, rank: 1 });
    const first = turathPassage({ book: { id: "43", title: "كتاب أول" }, citation: "المرتبة الأولى", location: { internalPage: 8 }, rank: 0 });

    expect(adaptTurathPassages([later, first]).map((reference) => reference.citation)).toEqual([
      "المرتبة الأولى", "المرتبة الثانية",
    ]);
  });

  it("keeps printed pages separate from internal page IDs", () => {
    const [reference] = adaptTurathPassages([turathPassage({ location: { internalPage: 501, printedPage: 23 } })]);
    expect(reference.pageLocator).toEqual({ internalPage: 501, printedPage: 23 });
  });

  it("caps each mapped excerpt at 1,500 characters", () => {
    const [reference] = adaptTurathPassages([turathPassage({ text: "x".repeat(MAX_TURATH_PASSAGE_CHARS + 40) })]);
    expect(reference.excerpt).toHaveLength(MAX_TURATH_PASSAGE_CHARS);
  });
});

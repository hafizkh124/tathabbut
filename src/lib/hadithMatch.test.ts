import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Passage } from "nusus";
import { describe, expect, it } from "vitest";
import { parseDorarHtml } from "./dorar";
import { adaptTurathPassages, MAX_TURATH_PASSAGE_CHARS, selectRelevant, summarizeGrades, type GradedNarration } from "./hadithMatch";

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

const turathPassage = (over: Partial<Passage> = {}): Passage => ({
  provider: "turath",
  book: { id: "42", title: "كتاب العلل" },
  author: { id: "9", name: "الإمام" },
  location: { internalPage: 17, printedPage: 84, volume: "2" },
  text: "نص المصدر",
  headings: [],
  url: "https://app.turath.io/book/42/17",
  alternateUrls: { shamela: "https://shamela.ws/book/42/17" },
  citation: "كتاب العلل، 2/84",
  locator: { bookId: "42", internalPage: 17, printedPage: 84, volume: "2", url: "https://app.turath.io/book/42/17" },
  provenance: {
    query: "الحديث",
    rank: 1,
    totalMatches: 1,
    truncated: false,
    contextPages: { before: 0, after: 0 },
    retrievedVia: "search-hit",
  },
  ...over,
});

describe("adaptTurathPassages", () => {
  it("preserves citation, book and author metadata, URL, provenance, and distinct page locators", () => {
    const [reference] = adaptTurathPassages([turathPassage()]);
    expect(reference).toMatchObject({
      excerpt: "نص المصدر",
      citation: "كتاب العلل، 2/84",
      book: { id: "42", title: "كتاب العلل" },
      author: { id: "9", name: "الإمام" },
      bookId: "42",
      pageLocator: { internalPage: 17, printedPage: 84, volume: "2" },
      url: "https://app.turath.io/book/42/17",
      provenance: { query: "الحديث", rank: 1, retrievedVia: "search-hit" },
    });
  });

  it("deduplicates by Turath book ID and internal page, not by printed page", () => {
    const references = adaptTurathPassages([
      turathPassage(),
      turathPassage({ text: "duplicate page", citation: "alternate citation" }),
      turathPassage({ location: { internalPage: 18, printedPage: 84, volume: "2" }, locator: { bookId: "42", internalPage: 18, printedPage: 84, volume: "2", url: "https://app.turath.io/book/42/18" } }),
      turathPassage({ book: { id: "43", title: "كتاب آخر" }, locator: { bookId: "43", internalPage: 17, printedPage: 84, volume: "2", url: "https://app.turath.io/book/43/17" } }),
    ]);
    expect(references).toHaveLength(3);
    expect(references.map((reference) => [reference.bookId, reference.pageLocator?.internalPage])).toEqual([
      ["42", 17], ["42", 18], ["43", 17],
    ]);
  });

  it("keeps Turath's explicit search rank in best-first order", () => {
    const later = turathPassage({
      book: { id: "44", title: "كتاب آخر" },
      citation: "المرتبة الثانية",
      locator: { bookId: "44", internalPage: 9, url: "https://app.turath.io/book/44/9" },
      provenance: { ...turathPassage().provenance!, rank: 1 },
    });
    const first = turathPassage({
      book: { id: "43", title: "كتاب أول" },
      citation: "المرتبة الأولى",
      locator: { bookId: "43", internalPage: 8, url: "https://app.turath.io/book/43/8" },
      provenance: { ...turathPassage().provenance!, rank: 0 },
    });

    expect(adaptTurathPassages([later, first]).map((reference) => reference.citation)).toEqual([
      "المرتبة الأولى", "المرتبة الثانية",
    ]);
  });

  it("falls back to the passage location and keeps printed pages separate from internal page IDs", () => {
    const [reference] = adaptTurathPassages([turathPassage({
      location: { internalPage: 501, printedPage: 23 },
      locator: undefined,
    })]);
    expect(reference.pageLocator).toEqual({ internalPage: 501, printedPage: 23 });
  });

  it("caps each mapped excerpt at 1,500 characters", () => {
    const [reference] = adaptTurathPassages([turathPassage({ text: "x".repeat(MAX_TURATH_PASSAGE_CHARS + 40) })]);
    expect(reference.excerpt).toHaveLength(MAX_TURATH_PASSAGE_CHARS);
  });
});

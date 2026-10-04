import { describe, expect, it } from "vitest";
import {
  BookTier,
  calculateTextCloseness,
  getBookTier,
  getScholarPriority,
  isSahihayn,
  rankAndFilterDorarResults,
} from "./hadithRanking";
import type { GradedNarration } from "./hadithMatch";

function makeNarration(overrides: Partial<GradedNarration>): GradedNarration {
  return {
    rank: 1,
    matn: "إنما الأعمال بالنيات",
    grade: "مقبول",
    confidence: "high",
    caution: false,
    matchedBy: "contained",
    ...overrides,
  };
}

describe("hadithRanking", () => {
  describe("getBookTier", () => {
    it("identifies Sahihayn (Tier 1)", () => {
      expect(getBookTier("صحيح البخاري")).toBe(BookTier.Sahihayn);
      expect(getBookTier("صحيح مسلم")).toBe(BookTier.Sahihayn);
      expect(isSahihayn("صحيح البخاري")).toBe(true);
      expect(isSahihayn("صحيح مسلم")).toBe(true);
      // Criticism book should NOT be Tier 1
      expect(isSahihayn("أحاديث من صحيح البخاري أعلها الدارقطني")).toBe(false);
      expect(getBookTier("أحاديث من صحيح البخاري أعلها الدارقطني")).toBe(BookTier.Other);
    });

    it("identifies the four Sunan and Al-Albani's Sahih/Da'if books on them (Tier 2)", () => {
      for (const name of ["سنن أبي داود", "جامع الترمذي", "سنن الترمذي", "سنن النسائي", "سنن ابن ماجه", "سنن ابن ماجة", "صحيح أبي داود", "ضعيف الترمذي"]) {
        expect(getBookTier(name)).toBe(BookTier.SunanArbaa);
      }
    });

    it("does not take commentaries, mursal collections or questions as the Sunan themselves", () => {
      for (const name of ["المراسيل لأبي داود", "سؤالات أبي داود", "حاشية السندي على النسائي", "شرح علل الترمذي", "تخريج سنن الترمذي", "مختصر سنن أبي داود"]) {
        expect(getBookTier(name)).toBe(BookTier.Other);
      }
    });

    it("has no separate tier for Musnad Ahmad, Muwatta or Darimi", () => {
      for (const name of ["موطأ مالك", "مسند أحمد", "سنن الدارمي"]) expect(getBookTier(name)).toBe(BookTier.Other);
    });

    it("identifies other books (Tier 3)", () => {
      expect(getBookTier("المعجم الكبير")).toBe(BookTier.Other);
      expect(getBookTier("شعب الإيمان")).toBe(BookTier.Other);
      expect(getBookTier("المستدرك على الصحيحين")).toBe(BookTier.Other);
    });
  });

  describe("getScholarPriority", () => {
    it("prioritizes Sheikh Al-Albani highest", () => {
      expect(getScholarPriority("الألباني")).toBe(100);
      expect(getScholarPriority("محمد ناصر الدين الألباني")).toBe(100);
    });

    it("assigns weight to prominent imams", () => {
      expect(getScholarPriority("ابن حجر العسقلاني")).toBe(50);
      expect(getScholarPriority("الذهبي")).toBe(50);
      expect(getScholarPriority("شعيب الأرنؤوط")).toBe(50);
      expect(getScholarPriority("شعيب الأرناؤوط")).toBe(50);
      expect(getScholarPriority("أحمد شاكر")).toBe(50);
    });

    it("assigns lower weight to other scholars or none", () => {
      expect(getScholarPriority("محدث آخر")).toBe(10);
      expect(getScholarPriority("-")).toBe(0);
      expect(getScholarPriority("")).toBe(0);
    });
  });

  describe("calculateTextCloseness", () => {
    it("gives high score when the full text matches", () => {
      const q = "إنما الأعمال بالنيات وإنما لكل امرئ ما نوى";
      const m1 = "سمعت رسول الله يقول إنما الأعمال بالنيات وإنما لكل امرئ ما نوى فمن كانت هجرته إلى دنيا يصيبها";
      const m2 = "إنما الأعمال بالنيات";

      const score1 = calculateTextCloseness(q, m1);
      const score2 = calculateTextCloseness(q, m2);

      expect(score1).toBeGreaterThan(score2);
      expect(score1).toBeGreaterThan(0.7);
    });
  });

  describe("rankAndFilterDorarResults", () => {
    it("separates weak narrations when text is authenticated in Sahihayn", () => {
      const query = "طلب العلم فريضة على كل مسلم";
      const narrations: GradedNarration[] = [
        makeNarration({ matn: query, source: "المعجم الصغير", grade: "ضعيف", muhaddith: "الطبراني" }),
        makeNarration({ matn: query, source: "صحيح مسلم", grade: "مقبول", muhaddith: "مسلم" }),
        makeNarration({ matn: query, source: "الفوائد", grade: "شديد الضعف أو لا أصل له", muhaddith: "ابن حبان" }),
      ];

      const res = rankAndFilterDorarResults(query, narrations);

      expect(res.inSahihayn).toBe(true);
      expect(res.primary.source).toBe("صحيح مسلم");
      expect(res.secondary).toHaveLength(0);
      expect(res.weakVariants).toHaveLength(2);
      expect(res.weakVariants.map((w) => w.grade)).toEqual(["ضعيف", "شديد الضعف أو لا أصل له"]);
    });

    it("prioritizes Book Tiers: Sahihayn > Sunan Arbaa > Others", () => {
      const query = "من غشنا فليس منا";
      const narrations: GradedNarration[] = [
        makeNarration({ matn: query, source: "المعجم الكبير", grade: "مقبول" }),
        makeNarration({ matn: query, source: "مسند أحمد", grade: "مقبول" }),
        makeNarration({ matn: query, source: "سنن الترمذي", grade: "مقبول" }),
        makeNarration({ matn: query, source: "صحيح مسلم", grade: "مقبول" }),
      ];

      const res = rankAndFilterDorarResults(query, narrations);

      expect(res.primary.source).toBe("صحيح مسلم");
      expect(res.secondary.map((s) => s.source)).toEqual(["سنن الترمذي", "المعجم الكبير", "مسند أحمد"]);
    });

    it("prioritizes Sheikh Al-Albani when outside Sahihayn", () => {
      const query = "الدعاء مخ العبادة";
      const narrations: GradedNarration[] = [
        makeNarration({ matn: query, source: "سنن الترمذي", grade: "ضعيف", muhaddith: "الترمذي" }),
        makeNarration({ matn: query, source: "سنن الترمذي", grade: "ضعيف", muhaddith: "الألباني" }),
        makeNarration({ matn: query, source: "مسند أحمد", grade: "ضعيف", muhaddith: "شعيب الأرنؤوط" }),
      ];

      const res = rankAndFilterDorarResults(query, narrations);

      expect(res.inSahihayn).toBe(false);
      // Both are in Sunan Arba'ah, but Albani has higher priority
      expect(res.primary.muhaddith).toBe("الألباني");
      expect(res.weakVariants).toHaveLength(0); // Not in Sahihayn, so not separated
    });

    it("never lets a weak verdict of Al-Albani outrank an accepted one in the same book", () => {
      const query = "الدعاء مخ العبادة";
      const narrations: GradedNarration[] = [
        makeNarration({ matn: query, source: "سنن الترمذي", grade: "ضعيف", muhaddith: "الألباني" }),
        makeNarration({ matn: query, source: "سنن الترمذي", grade: "مقبول", muhaddith: "محدث آخر" }),
      ];

      const res = rankAndFilterDorarResults(query, narrations);

      expect(res.primary.grade).toBe("مقبول");
      expect(res.allRanked.map((n) => n.grade)).toEqual(["مقبول", "ضعيف"]);
    });

    it("puts a half-text narration of a high tier below a full-text one of a lower tier", () => {
      const query = "إنما الأعمال بالنيات وإنما لكل امرئ ما نوى فمن كانت هجرته إلى الله ورسوله";
      const narrations: GradedNarration[] = [
        makeNarration({ matn: "إنما الأعمال بالنيات", source: "سنن أبي داود", grade: "مقبول" }),
        makeNarration({ matn: query, source: "المعجم الكبير", grade: "مقبول" }),
      ];

      expect(rankAndFilterDorarResults(query, narrations).primary.source).toBe("المعجم الكبير");
    });

    it("keeps weak narrations in the list when a Sahihayn narration is a different, much shorter text", () => {
      const query = "إنما الأعمال بالنيات وإنما لكل امرئ ما نوى فمن كانت هجرته إلى الله ورسوله";
      const narrations: GradedNarration[] = [
        makeNarration({ matn: "إنما الأعمال", source: "صحيح مسلم", grade: "مقبول" }),
        makeNarration({ matn: query, source: "المعجم الكبير", grade: "ضعيف" }),
      ];

      const res = rankAndFilterDorarResults(query, narrations);

      expect(res.inSahihayn).toBe(false);
      expect(res.weakVariants).toHaveLength(0);
      expect(res.allRanked).toHaveLength(2);
    });

    it("prioritizes fuller text completeness within the same tier", () => {
      const query = "إنما الأعمال بالنيات وإنما لكل امرئ ما نوى فمن كانت هجرته إلى الله ورسوله";
      const narrations: GradedNarration[] = [
        makeNarration({
          matn: "إنما الأعمال بالنيات فقط",
          source: "سنن أبي داود",
          grade: "مقبول",
          muhaddith: "الألباني",
        }),
        makeNarration({
          matn: "إنما الأعمال بالنيات وإنما لكل امرئ ما نوى فمن كانت هجرته إلى الله ورسوله فهجرته إلى الله ورسوله",
          source: "سنن الترمذي",
          grade: "مقبول",
          muhaddith: "الألباني",
        }),
      ];

      const res = rankAndFilterDorarResults(query, narrations);

      // Sunan Tirmidhi has the full text coverage, so it should rank higher than Abu Dawud's partial text
      expect(res.primary.source).toBe("سنن الترمذي");
    });
  });
});

import { describe, expect, it } from "vitest";
import type { DorarResult } from "./dorar";
import { alignedDistance, nearWord, selectRelevant } from "./hadithMatch";

const narration = (matn: string, over: Partial<DorarResult> = {}): DorarResult => ({ rank: 1, matn, source: "صحيح البخاري", muhaddith: "البخاري", verdict: "[صحيح]", ...over });

describe("nearWord", () => {
  it("one letter of difference in a word of five letters or more", () => {
    expect(nearWord("باانيات", "بالنيات")).toBe(true);
    expect(nearWord("اطلبو", "اطلبوا")).toBe(true);
    expect(nearWord("الاعمال", "الاعمال")).toBe(true);
  });
  it("never for a short word, two letters, or another length", () => {
    expect(nearWord("كتب", "كتم")).toBe(false);
    expect(nearWord("الشهور", "الشهرا")).toBe(false);
    expect(nearWord("عشرون", "عشره")).toBe(false); // two letters, and a word of four
    expect(nearWord("رمضان", "شهرا")).toBe(false);
  });
});

describe("alignedDistance", () => {
  it("is 0 for the words as they are, small for a slip, large for another text", () => {
    const m = "إنما الأعمال بالنيات وإنما لكل امرئ ما نوى";
    expect(alignedDistance("انما الاعمال بالنيات", m)).toBe(0);
    expect(alignedDistance("انما الاعمال باانيات", m)!).toBeLessThan(0.2);
    expect(alignedDistance("من كذب علي متعمدا فليتبوأ مقعده", m)!).toBeGreaterThan(0.8);
  });
  it("a text that only shares a few words with a narration is far from it", () => {
    const m = "من أدرك ركعة من صلاة العصر قبل أن تغيب الشمس فقد أدرك العصر";
    expect(alignedDistance("اذا طهرت قبل طلوع الشمس تصلي الفجر فقط", m)!).toBeGreaterThan(0.6);
  });
  it("is null when a text is too short to line up", () => {
    expect(alignedDistance("انما", "إنما الأعمال بالنيات")).toBeNull();
  });
});

describe("selectRelevant", () => {
  it("a short query matches whole words only: «نام ليا» is not found inside «الأنام» and «عليا»", () => {
    expect(selectRelevant("نام ليا", [narration("قال رسول الله لأصحابه يا أيها الأنام اتقوا الله وأوصيكم بعليا خيرا")])).toEqual([]);
  });
  it("a short query still matches its words with a one-letter prefix", () => {
    expect(selectRelevant("الصبر ضياء", [narration("والصبر ضياء")])).toHaveLength(1);
  });
  it("a misspelt text is taken only with the typos option, and only when it lines up", () => {
    const rs = [narration("إنما الأعمال بالنيات وإنما لكل امرئ ما نوى")];
    expect(selectRelevant("انما الاعمال باانيات", rs)).toEqual([]);
    expect(selectRelevant("انما الاعمال باانيات", rs, 0.6, { typos: true })).toHaveLength(1);
    // another hadith sharing words is not taken for a typo
    expect(selectRelevant("عمر طلق ابا بكر بعد العشاء الاخره عندما صلاها", [narration("أن رسول الله أخر صلاة العشاء الآخرة تسع ليال")], 0.6, { typos: true })).toEqual([]);
  });
});

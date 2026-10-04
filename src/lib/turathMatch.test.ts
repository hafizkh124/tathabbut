import { describe, expect, it } from "vitest";
import { isSameText } from "./turathMatch";

describe("isSameText", () => {
  it("accepts a passage that holds the whole phrase, ignoring diacritics and punctuation", () => {
    expect(isSameText("اطلبوا العلم ولو بالصين", "قال: «اطْلُبُوا العِلْمَ وَلَوْ بِالصِّينِ» وهو حديث")).toBe(true);
  });

  it("rejects a short phrase that is only discussed through some of its words", () => {
    // live case (2026-10-04): «حب الوطن من الإيمان» came back inside passages that never contain it
    expect(isSameText("حب الوطن من الإيمان", "الترغيب في حب الإيمان وأهله وبيان فضل الوطن")).toBe(false);
  });

  it("accepts a long text when about 80% of its content words are there", () => {
    const query = "من غشنا فليس منا والمكر والخداع في النار يوم القيامة";
    const nearly = "ورد في الحديث: من غشنا فليس منا والمكر والخداع في النار";
    expect(isSameText(query, nearly)).toBe(true);
  });

  it("rejects a long text when only half of its content words are there", () => {
    const query = "إنما الأعمال بالنيات وإنما لكل امرئ ما نوى فمن كانت هجرته إلى الله ورسوله";
    expect(isSameText(query, "إنما الأعمال بالنيات فقط وهذا كلام آخر لا علاقة له")).toBe(false);
  });

  it("rejects empty input and unrelated text", () => {
    expect(isSameText("", "أي نص")).toBe(false);
    expect(isSameText("قيمة كل امرئ ما يحسنه", "")).toBe(false);
    expect(isSameText("قيمة كل امرئ ما يحسنه", "الزرافة تسبح عند طلوع القمر")).toBe(false);
  });
});

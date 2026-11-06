import { describe, expect, it } from "vitest";
import { arabicRun, checkClaims, foldUrduLetters, urduShare } from "./claims";

// Live cases (shared_claims, 2026-10-19 to 2026-11-06): Urdu typed with an Arabic keyboard was taken for Arabic and
// searched in Dorar; Arabic written with the Indo-Pak ھ was cut at that letter.
const URDU_IN_ARABIC_LETTERS = "ميري اور ( سابقه ) انبياء كي مثال اس آدمي كي طرح هے جس نے ايك عمارت بنائي، اسے بهت اچھا اور خوبصورت بنايا";
const DUA_WITH_HEH = "اَللّٰھُمَّ اغْفِرْ لِي ذَنْبِي وَيَسِّرْ لِيْ اَمْرِي وَبَارِكْ لِيْ فِي رِزْقِي";

describe("Urdu written with Arabic letters", () => {
  it("is mostly Urdu words, whatever the letters", () => {
    expect(urduShare(URDU_IN_ARABIC_LETTERS)).toBeGreaterThan(0.25);
    expect(urduShare("إنما الأعمال بالنيات وإنما لكل امرئ ما نوى")).toBe(0);
  });
  it("is no Arabic span: the claim is Urdu, searched through the model's Arabic", () => {
    const post = `نبی ﷺ نے فرمایا: ${URDU_IN_ARABIC_LETTERS}`;
    const { claims } = checkClaims(post, [
      { kind: "hadith", text_as_written: URDU_IN_ARABIC_LETTERS, arabic_span: URDU_IN_ARABIC_LETTERS, arabic_translation: "مثلي ومثل الأنبياء من قبلي كمثل رجل بنى بيتا" },
    ]);
    expect(claims[0].arabicSpan).toBeNull();
    expect(claims[0].language).toBe("ur");
    expect(claims[0].queryIsTranslation).toBe(true);
    expect(claims[0].query).toBe("مثلي ومثل الأنبياء من قبلي كمثل رجل بنى بيتا");
    expect(claims[0].warnings.join(" ")).toContain("Urdu written with Arabic letters");
  });
  it("the Urdu words typed with Arabic letters are not part of an Arabic run beside them", () => {
    expect(arabicRun("ميري اور إنما الأعمال بالنيات وإنما لكل امرئ ما نوى كي طرح")).toBe("إنما الأعمال بالنيات وإنما لكل امرئ ما نوى");
  });
});

describe("Arabic written with the Indo-Pak ھ", () => {
  it("stays Arabic: a dua with harakat is not cut at the ھ", () => {
    expect(urduShare(DUA_WITH_HEH)).toBe(0);
    expect(arabicRun(DUA_WITH_HEH)).toBe(DUA_WITH_HEH);
    const { claims } = checkClaims(DUA_WITH_HEH, [{ kind: "hadith", text_as_written: DUA_WITH_HEH, arabic_span: DUA_WITH_HEH }]);
    expect(claims[0].arabicSpan).toBe(DUA_WITH_HEH);
  });
  it("is folded to the Arabic ha for the search, so «فكلومنھا» is one word", () => {
    expect(foldUrduLetters("فكلومنھا واطعموا")).toBe("فكلومنها واطعموا");
  });
  it("Urdu aspirated words without harakat are still Urdu", () => {
    expect(urduShare("وہ بھی کھانا کھا کر تھا")).toBeGreaterThan(0.5);
  });
});

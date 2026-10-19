import { describe, expect, it } from "vitest";
import { citedNarration, isKnownBook } from "./citedBook";
import type { GradedNarration } from "./hadithMatch";

const n = (source: string, reference: string, muhaddith = "", grade = "مقبول") =>
  ({ source, reference, muhaddith, grade, matn: "x", confidence: "high", caution: false, matchedBy: "contained" }) as unknown as GradedNarration;

const muslim = n("صحيح مسلم", "780", "مسلم");
const hakim = n("المستدرك على الصحيحين", "2062", "الحاكم", "غير حاسم");
const tirmidhi = n("سنن الترمذي", "2877", "الترمذي", "ضعيف");
const albaniTirmidhi = n("ضعيف الترمذي", "2877", "الألباني", "ضعيف");

describe("the book a post names", () => {
  it("finds the Mustadrak narration from an Urdu or Arabic citation (team lead's case, 2026-10-19)", () => {
    for (const cited of ["مستدرک حاکم", "رواه الحاكم في المستدرك", "المستدرك على الصحيحين"]) expect(citedNarration(cited, [[muslim], [hakim]])).toBe(hakim);
  });
  it("takes the book itself before al-Albani's verdict book on it, and the verdict book when it is the only one", () => {
    expect(citedNarration("ترمذی", [[albaniTirmidhi, tirmidhi]])).toBe(tirmidhi);
    expect(citedNarration("جامع ترمذی", [[albaniTirmidhi]])).toBe(albaniTirmidhi);
  });
  it("picks the narration with the number the post gives", () => {
    const other = n("سنن الترمذي", "100", "الترمذي");
    expect(citedNarration("ترمذی ۲۸۷۷", [[other, tirmidhi]])).toBe(tirmidhi);
    expect(citedNarration("الترمذي 2877", [[other, tirmidhi]])).toBe(tirmidhi);
  });
  it("tells Muslim's Sahih from a word that only contains «مسلم»", () => {
    expect(citedNarration("صحیح مسلم", [[hakim, muslim]])).toBe(muslim);
    expect(citedNarration("رواه مسلم", [[hakim, muslim]])).toBe(muslim);
    expect(isKnownBook("ہر مسلمان کو بھیجیں")).toBe(false);
  });
  it("gives nothing for a book not among the results, or none named", () => {
    expect(citedNarration("سنن ابوداؤد", [[muslim]])).toBeNull();
    expect(isKnownBook("سنن ابوداؤد")).toBe(true);
    expect(citedNarration(null, [[muslim]])).toBeNull();
    expect(citedNarration("کتاب الفلاں", [[muslim]])).toBeNull();
  });
});

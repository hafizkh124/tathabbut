import { describe, expect, it } from "vitest";
import type { TurathLookupOutcome } from "./hadithMatch";
import { STATES } from "./states";
import { turathPatch } from "./turathFallback";

const ref = { excerpt: "نص", citation: "ك", book: { id: "1", title: "كتاب" }, bookId: "1", url: "https://app.turath.io/book/1" };
const found: TurathLookupOutcome = { status: "success", references: [ref] };
const notFound = (kind: string, notes: string[] = []) => ({ claim: { kind }, state: STATES.notFound, basis: "none", notes });

describe("turathPatch", () => {
  it("turns «not found» into «موجود في كتب التراث» when the books hold a hadith's text", () => {
    expect(turathPatch(notFound("hadith", ["لا رواية مطابقة في الدرر"]), found)).toEqual({
      state: STATES.turathFound,
      basis: "turath",
      notes: ["ورد النص في كتب التراث"],
    });
  });

  it("does the same for a scholar's saying, and when Dorar could not be reached", () => {
    expect(turathPatch(notFound("scholar_quote"), found)?.state).toBe(STATES.turathFound);
    expect(turathPatch(notFound("hadith", ["تعذّر البحث في الدرر (HTTP 500)"]), found)?.state).toBe(STATES.turathFound);
  });

  it("is never a grade and never «غير حاسم»: a passage may itself say «موضوع»", () => {
    const patch = turathPatch(notFound("hadith"), found);
    expect(patch?.state).not.toBe(STATES.unsure);
    expect(patch?.state).not.toBe(STATES.maqbul);
    expect(patch?.state).not.toBe(STATES.daif);
    expect(patch?.state).not.toBe(STATES.shadid);
  });

  it("changes nothing when Turath has no reference or is unavailable", () => {
    expect(turathPatch(notFound("hadith"), { status: "success", references: [] })).toBeNull();
    expect(turathPatch(notFound("hadith"), { status: "unavailable", references: [] })).toBeNull();
  });

  it("never touches a claim that Dorar, the Quran or the specialist's list already settled", () => {
    expect(turathPatch({ claim: { kind: "hadith" }, state: "ضعيف", basis: "dorar", notes: [] }, found)).toBeNull();
    expect(turathPatch({ claim: { kind: "hadith" }, state: "مقبول", basis: "specialist-list", notes: [] }, found)).toBeNull();
    expect(turathPatch({ claim: { kind: "quran" }, state: STATES.verseOk, basis: "quran", notes: [] }, found)).toBeNull();
  });

  it("is only for hadith and scholar sayings", () => {
    for (const kind of ["quran", "question", "other"]) expect(turathPatch(notFound(kind), found)).toBeNull();
  });
});

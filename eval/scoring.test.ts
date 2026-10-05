import { describe, expect, it } from "vitest";
import { STATES } from "../src/lib/states";
import { alignClaims, attributionMatches, citationProblems, fabricationOf, scorePrompt, stateMatches, textSimilarity, wilson } from "./scoring";
import type { ActualClaim, ExpectedClaim } from "./types";

const verseExp: ExpectedClaim = {
  kind: "quran",
  quotedText: "إِنَّ ٱللَّهَ مَعَ ٱلصَّٰبِرِينَ",
  expectedState: STATES.verseOk,
  shouldAbstain: false,
  attribution: { surah: 2, ayah: 153, verseText: "إِنَّ ٱللَّهَ مَعَ ٱلصَّٰبِرِينَ" },
};

const verseAct = (over: Partial<ActualClaim> = {}): ActualClaim => ({
  claim: { kind: "quran", textAsWritten: "إن الله مع الصابرين", arabicSpan: "إن الله مع الصابرين" },
  state: STATES.verseOk,
  basis: "quran",
  verse: { surah: 2, ayah: 153, text: "إِنَّ اللَّهَ مَعَ الصَّابِرِينَ" },
  ...over,
});

const hadithExp: ExpectedClaim = {
  kind: "hadith",
  quotedText: "إنما الأعمال بالنيات وإنما لكل امرئ ما نوى",
  expectedState: STATES.maqbul,
  shouldAbstain: false,
  attribution: { collections: ["صحيح البخاري"] },
};
const hadithAct = (over: Partial<ActualClaim> = {}): ActualClaim => ({
  claim: { kind: "hadith", textAsWritten: "إنما الأعمال بالنيات وإنما لكل امرئ ما نوى", arabicSpan: "إنما الأعمال بالنيات وإنما لكل امرئ ما نوى" },
  state: STATES.maqbul,
  basis: "dorar",
  dorar: { narrations: [{ matn: "إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى", source: "صحيح البخاري", grade: "مقبول" }], summary: { grade: "مقبول" } },
  ...over,
});

describe("kinds are the app's own", () => {
  it("a Quran claim extracted as «quran» passes (the old harness wanted «verse» and failed every verse)", () => {
    expect(scorePrompt({ expectedClaims: [verseExp] }, [verseAct()]).success).toBe(true);
  });
  it("a wrong kind fails", () => {
    const r = scorePrompt({ expectedClaims: [verseExp] }, [verseAct({ claim: { kind: "hadith", textAsWritten: "إن الله مع الصابرين" } })]);
    expect(r.scores[0].kindOk).toBe(false);
    expect(r.success).toBe(false);
  });
});

describe("pairing by text, not by position", () => {
  it("pairs expected and extracted claims whatever their order", () => {
    const a = alignClaims([verseExp, hadithExp], [hadithAct(), verseAct()]);
    expect(a.map((x) => x.actualIndex)).toEqual([1, 0]);
  });
  it("an unrelated extracted claim is not counted as found", () => {
    const r = scorePrompt({ expectedClaims: [hadithExp] }, [hadithAct({ claim: { kind: "hadith", textAsWritten: "حب الوطن من الإيمان" } })]);
    expect(r.claimsMatched).toBe(0);
    expect(r.success).toBe(false);
  });
  it("recall never exceeds 100%: two answers for one expected claim match once; the other is an extra", () => {
    const r = scorePrompt({ expectedClaims: [hadithExp] }, [hadithAct(), hadithAct()]);
    expect(r.claimsMatched).toBe(1);
    expect(r.extraClaims).toHaveLength(1);
  });
  it("an extra «other» claim (شارك تؤجر) does not fail an otherwise correct answer", () => {
    const extra: ActualClaim = { claim: { kind: "other", textAsWritten: "شارك تؤجر" }, state: STATES.notFound, basis: "none" };
    expect(scorePrompt({ expectedClaims: [hadithExp] }, [hadithAct(), extra]).success).toBe(true);
  });
  it("Urdu: letter forms are folded", () => {
    expect(textSimilarity("اور ستاروں سے بھی لوگ راہ حاصل کرتے ہیں", "اور ستاروں سے بھی لوگ راه حاصل كرتے ہیں")).toBe(1);
  });
});

describe("states are matched exactly", () => {
  it("«ضعيف» does not match «شديد الضعف»", () => {
    expect(stateMatches(STATES.daif, { ...hadithExp, expectedState: STATES.shadid })).toBe(false);
  });
  it("acceptable alternatives are honoured", () => {
    expect(stateMatches(STATES.shadid, { ...hadithExp, expectedState: STATES.notFound, acceptableStates: [STATES.shadid] })).toBe(true);
  });
});

describe("attribution is part of passing", () => {
  it("right surah, wrong ayah fails", () => {
    const r = scorePrompt({ expectedClaims: [verseExp] }, [verseAct({ verse: { surah: 2, ayah: 249, text: "كم من فئة قليلة غلبت فئة كثيرة بإذن الله والله مع الصابرين" } })]);
    expect(r.scores[0].attributionOk).toBe(false);
    expect(r.success).toBe(false);
  });
  it("a repeated verse shown at another place with the same text is accepted", () => {
    const exp: ExpectedClaim = { ...verseExp, quotedText: "فَبِأَىِّ ءَالَآءِ رَبِّكُمَا تُكَذِّبَانِ", attribution: { surah: 55, ayah: 13, verseText: "فَبِأَىِّ ءَالَآءِ رَبِّكُمَا تُكَذِّبَانِ" } };
    expect(attributionMatches(exp, verseAct({ verse: { surah: 55, ayah: 77, text: "فبأي آلاء ربكما تكذبان" } }))).toBe(true);
  });
  it("a hadith whose shown narrations are all in other books fails", () => {
    const act = hadithAct({ dorar: { narrations: [{ matn: "إنما الأعمال بالنيات", source: "مسند أحمد", grade: "مقبول" }], summary: { grade: "مقبول" } } });
    expect(attributionMatches(hadithExp, act)).toBe(false);
  });
  it("a specialist-list saying must carry the labelled scholar", () => {
    const exp: ExpectedClaim = { kind: "hadith", quotedText: "حب الوطن من الإيمان", expectedState: STATES.shadid, shouldAbstain: false, attribution: { scholar: "الصغاني / السخاوي" } };
    const act: ActualClaim = { claim: { kind: "hadith", textAsWritten: "حب الوطن من الإيمان" }, state: STATES.shadid, basis: "specialist-list", saying: { text_ar: "حب الوطن من الإيمان", status: STATES.shadid, verdict_by: "السخاوي" } };
    expect(attributionMatches(exp, act)).toBe(true);
    expect(attributionMatches(exp, { ...act, saying: { ...act.saying, verdict_by: "ابن تيمية" } })).toBe(false);
  });
});

describe("fabrication means evidence that does not hold the text or the state", () => {
  it("a narration that is a different text", () => {
    expect(fabricationOf(hadithAct({ dorar: { narrations: [{ matn: "من كذب علي متعمدا فليتبوأ مقعده من النار", source: "صحيح البخاري" }], summary: { grade: "مقبول" } } }))).toMatch(/no narration/);
  });
  it("a shown state its own summary does not give", () => {
    expect(fabricationOf(hadithAct({ state: STATES.maqbul, dorar: { narrations: [{ matn: "إنما الأعمال بالنيات وإنما لكل امرئ ما نوى" }], summary: { grade: STATES.daif } } }))).toMatch(/differs/);
  });
  it("«not found» with no evidence is not a fabrication; a grade with no evidence is", () => {
    expect(fabricationOf({ claim: { kind: "hadith", textAsWritten: "x y" }, state: STATES.notFound, basis: "none" })).toBeNull();
    expect(fabricationOf({ claim: { kind: "hadith", textAsWritten: "x y" }, state: STATES.maqbul, basis: "none" })).not.toBeNull();
  });
  it("a fabrication fails the prompt even when the state is right", () => {
    const bad = hadithAct({ dorar: { narrations: [{ matn: "لا يدخل الجنة قتات", source: "صحيح البخاري" }], summary: { grade: "مقبول" } } });
    expect(scorePrompt({ expectedClaims: [hadithExp] }, [bad]).success).toBe(false);
  });
});

describe("abstention", () => {
  it("a personal question referred is correct", () => {
    const exp: ExpectedClaim = { kind: "question", quotedText: "طلقت زوجتي وأنا غضبان فهل يقع؟", expectedState: STATES.fatwa, shouldAbstain: true };
    const act: ActualClaim = { claim: { kind: "question", textAsWritten: "طلقت زوجتي وأنا غضبان فهل يقع" }, state: STATES.fatwa, basis: "kind" };
    const r = scorePrompt({ expectedClaims: [exp] }, [act]);
    expect(r.success).toBe(true);
    expect(r.scores[0].abstentionOk).toBe(true);
    expect(r.scores[0].attributionOk).toBeNull();
  });
});

describe("Turath citations", () => {
  it("flags a reference without a book link", () => {
    expect(citationProblems([{ excerpt: "x", citation: "c", book: { id: "1", title: "t" }, bookId: "1", url: "https://app.turath.io/" } as never])).toHaveLength(1);
    expect(citationProblems([{ citation: "c", book: { id: "12", title: "t" }, bookId: "12", url: "https://app.turath.io/book/12?page=3" }])).toHaveLength(0);
  });
});

describe("wilson", () => {
  it("is a sensible interval", () => {
    const [lo, hi] = wilson(90, 100);
    expect(lo).toBeGreaterThan(82);
    expect(hi).toBeLessThan(95);
  });
});

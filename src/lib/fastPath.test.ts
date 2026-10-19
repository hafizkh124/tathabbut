import { describe, expect, it, vi } from "vitest";
import { fastPath, singleQuotation } from "./fastPath";
import type { VerifyDeps } from "./verify";

describe("singleQuotation", () => {
  it.each([
    ["إنما الأعمال بالنيات", "إنما الأعمال بالنيات"],
    ["قال رسول الله ﷺ: «إنما الأعمال بالنيات»", "إنما الأعمال بالنيات"],
    ["قال تعالى: ﴿وقل ربي زدني علما﴾", "وقل ربي زدني علما"],
    ["اطلبوا العلم ولو بالصين. انشرها ولك الأجر", "اطلبوا العلم ولو بالصين"],
  ])("%s", (text, quote) => expect(singleQuotation(text)).toBe(quote));

  it.each([
    "حب الوطن من الإيمان؟",
    "نبی ﷺ نے فرمایا: إنما الأعمال بالنيات",
    "إنما الأعمال بالنيات\nوقال: اطلبوا العلم ولو بالصين",
    "قال ﷺ: «إنما الأعمال بالنيات» وقال ﷺ: «اطلبوا العلم ولو بالصين»",
    "الدين النصيحة. وقال النبي كذا وكذا",
    "علم",
    "x".repeat(400),
    "",
  ])("is not one quotation: %s", (text) => expect(singleQuotation(text)).toBeNull());
});

const none = { matchVerses: vi.fn().mockResolvedValue([]), matchSayings: vi.fn().mockResolvedValue([]), lookupDorar: vi.fn() };
const dorar = (matn: string, verdict = "أخرجه في صحيحه") => ({
  ok: true,
  results: [{ rank: 1, matn, rawi: "عمر بن الخطاب", muhaddith: "البخاري", source: "صحيح البخاري", reference: "1", verdict }],
});

describe("fastPath", () => {
  it("answers a saying of the specialist's list", async () => {
    const deps = { ...none, matchSayings: vi.fn().mockResolvedValue([{ id: 1, text_ar: "اطلبوا العلم ولو بالصين", status: "قول منسوب خطأً إلى النبي ﷺ", verdict: "باطل", verdict_by: "الألباني", reference: "السلسلة الضعيفة 416", correct_text: null, note: null, claimed_attribution: null, claimed_reference: null, score: 0.95 }]) } as unknown as VerifyDeps;
    const r = await fastPath("اطلبوا العلم ولو بالصين", deps);
    expect(r).toHaveLength(1);
    expect(r![0].basis).toBe("specialist-list");
    expect(r![0].claim.textAsWritten).toBe("اطلبوا العلم ولو بالصين");
  });

  it("answers with Dorar's grading when a narration holds the very text, and not when it only holds a near wording", async () => {
    const text = "إنما الأعمال بالنيات وإنما لكل امرئ ما نوى";
    const hit = await fastPath(text, { ...none, lookupDorar: vi.fn().mockResolvedValue(dorar("إنما الأعمال بالنيات وإنما لكل امرئ ما نوى")) } as unknown as VerifyDeps);
    expect(hit?.[0]).toMatchObject({ basis: "dorar", state: "مقبول" });
    const near = await fastPath("تعلموا لغات الحاسوب فإنها نصف العلم", { ...none, lookupDorar: vi.fn().mockResolvedValue(dorar("تعلموا العلم فإنه نصف الدين وإن العلم حياة")) } as unknown as VerifyDeps);
    expect(near).toBeNull();
  });

  it("gives null, so the model path runs, when nothing is found: it never answers «not found»", async () => {
    const deps = { ...none, lookupDorar: vi.fn().mockResolvedValue({ ok: true, results: [] }) } as unknown as VerifyDeps;
    expect(await fastPath("كلام لا أصل له في الكتب أبدا", deps)).toBeNull();
  });

  it("gives null when Dorar cannot be reached", async () => {
    const deps = { ...none, lookupDorar: vi.fn().mockResolvedValue({ ok: false, error: "timeout" }) } as unknown as VerifyDeps;
    expect(await fastPath("إنما الأعمال بالنيات", deps)).toBeNull();
  });

  it("does not touch a text that is not one quotation", async () => {
    const lookup = vi.fn();
    expect(await fastPath("هل حديث إنما الأعمال بالنيات صحيح؟", { ...none, lookupDorar: lookup } as unknown as VerifyDeps)).toBeNull();
    expect(lookup).not.toHaveBeenCalled();
  });
});

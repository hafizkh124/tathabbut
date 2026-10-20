import { describe, expect, it, vi } from "vitest";
import { cleanPhrases, findAlternative, sahihCandidates } from "./alternative";
import type { DorarLookup } from "./dorar";

const row = (matn: string, over: Record<string, string> = {}) => ({ rank: 1, matn, muhaddith: "مسلم", source: "صحيح مسلم", reference: "2699", verdict: "أخرجه في صحيحه", ...over });

describe("cleanPhrases", () => {
  it("keeps short Arabic phrases and drops anything else", () => {
    expect(cleanPhrases(["فضل طلب العلم", "knowledge", "كلمة", "هذه عبارة طويلة جدا فوق الحد المسموح به", 5, " طلب   العلم "])).toEqual(["فضل طلب العلم", "طلب العلم"]);
    expect(cleanPhrases(undefined)).toEqual([]);
    // a phrase made of the text's own words finds the text, not its matter
    expect(cleanPhrases(["اطلبوا العلم بالصين", "فضل طلب العلم"], "اطلبوا العلم ولو بالصين")).toEqual(["فضل طلب العلم"]);
    expect(cleanPhrases(["فضل العلم", "سلك طريقا", "طلب العلم", "حب الله"])).toHaveLength(3);
  });
});

describe("sahihCandidates", () => {
  it("keeps only what an imam of the Sahihs graded in his own Sahih, without repeats", () => {
    const a: DorarLookup = { ok: true, results: [row("من سلك طريقا يلتمس فيه علما سهل الله له به طريقا إلى الجنة"), row("حديث ضعيف", { verdict: "ضعيف", muhaddith: "الألباني" })] };
    const b: DorarLookup = { ok: true, results: [row("من سلك طريقا يلتمس فيه علما سهل الله له به طريقا إلى الجنة"), { ...row("حديث بلا مصدر"), source: "" }] };
    const out = sahihCandidates([a, b, { ok: false, error: "timeout" }]);
    expect(out).toEqual([{ matn: "من سلك طريقا يلتمس فيه علما سهل الله له به طريقا إلى الجنة", source: "صحيح مسلم", reference: "2699" }]);
  });
});

describe("findAlternative", () => {
  const search = vi.fn().mockResolvedValue({ ok: true, results: [row("من سلك طريقا يلتمس فيه علما سهل الله له به طريقا إلى الجنة"), row("الدين النصيحة", { reference: "55" })] });

  it("returns Dorar's own text for the candidate the model chose", async () => {
    const generate = vi.fn().mockResolvedValueOnce({ data: { phrases: ["فضل طلب العلم", "طلب العلم"] } }).mockResolvedValueOnce({ data: { choice: 1 } });
    const alt = await findAlternative("اطلبوا العلم ولو بالصين", { generate: generate as never, search });
    expect(alt).toEqual({ matn: "من سلك طريقا يلتمس فيه علما سهل الله له به طريقا إلى الجنة", source: "صحيح مسلم", reference: "2699" });
  });

  it("gives nothing when the model says none, or picks a number that is not a candidate", async () => {
    for (const choice of [0, 9, -1]) {
      const generate = vi.fn().mockResolvedValueOnce({ data: { phrases: ["فضل طلب العلم"] } }).mockResolvedValueOnce({ data: { choice } });
      expect(await findAlternative("x", { generate: generate as never, search })).toBeNull();
    }
  });

  it("gives nothing, and asks nothing more, when there are no usable phrases or no candidates", async () => {
    const none = vi.fn().mockResolvedValue({ data: { phrases: ["one"] } });
    expect(await findAlternative("x", { generate: none as never, search })).toBeNull();
    expect(none).toHaveBeenCalledTimes(1);
    const empty = vi.fn().mockResolvedValue({ data: { phrases: ["فضل طلب العلم"] } });
    expect(await findAlternative("x", { generate: empty as never, search: vi.fn().mockResolvedValue({ ok: true, results: [] }) })).toBeNull();
    expect(empty).toHaveBeenCalledTimes(1);
  });
});

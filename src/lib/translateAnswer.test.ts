import { describe, expect, it, vi } from "vitest";
import { answerPrompt, checkAnswer, translateAnswer } from "./translateAnswer";
import type { TranslationCache } from "./turathCache";

const URDU = "نیٹ ورک مارکیٹنگ کا شرعی حکم\n\nیہ کاروبار اگر کمیشن صرف اپنی فروخت پر ہو تو جائز ہے، ورنہ جائز نہیں ہے۔";

describe("answerPrompt", () => {
  it("forbids adding anything, keeps Arabic quotations as written, and carries the approved terms", () => {
    const p = answerPrompt(URDU, "en");
    expect(p).toContain("Add NOTHING");
    expect(p).toContain("stay EXACTLY as written");
    expect(p).toContain("فتویٰ → Fatwa");
    expect(p).toContain(URDU);
    expect(answerPrompt(URDU, "ar")).toContain("into Arabic");
  });
});

describe("checkAnswer", () => {
  it("accepts a translation in the target language and refuses an empty, wrapped, wrong-language or runaway one", () => {
    expect(checkAnswer(URDU, "Network marketing: the ruling\n\nThis business is permissible if the commission is only on one's own sales.", "en")).toContain("permissible");
    expect(() => checkAnswer(URDU, "", "en")).toThrow();
    expect(() => checkAnswer(URDU, "```json\nx\n```", "en")).toThrow();
    expect(() => checkAnswer(URDU, "هذا نص عربي طويل بما يكفي ليمر من فحص الطول لكنه ليس إنجليزيًا أبدًا ولا يصلح", "en")).toThrow(/English/);
    expect(() => checkAnswer(URDU, "this is english but it should have been arabic text for sure yes", "ar")).toThrow(/Arabic/);
    expect(() => checkAnswer(URDU, "x".repeat(900) + " english", "en")).toThrow(/length/);
  });

  it("refuses a translation that changed an Arabic quotation", () => {
    const src = "حدیث ہے: إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى۔ اس کا مطلب واضح ہے";
    expect(() => checkAnswer(src, "A hadith: actions are by intentions and each man has what he intended. Its meaning is clear.", "en")).toThrow(/quotation/);
    expect(checkAnswer(src, "A hadith: إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى. Its meaning is clear.", "en")).toContain("إِنَّمَا");
  });
});

describe("translateAnswer", () => {
  const ok = { data: { translation: "Network marketing: the ruling\n\nThis business is permissible if the commission is only on one's own sales, otherwise not." }, model: "m", ms: 1 };

  it("translates, then remembers the translation under its own key", async () => {
    const generate = vi.fn().mockResolvedValue(ok);
    const store = new Map<string, string>();
    const cache: TranslationCache = { get: async (t, l) => store.get(`${l}|${t}`) ?? null, put: async (t, l, tr) => void store.set(`${l}|${t}`, tr) };
    const first = await translateAnswer(URDU, "en", { generate: generate as never, cache });
    expect(first.cached).toBe(false);
    expect([...store.keys()][0]).toBe(`en|alulama\n${URDU}`);
    const second = await translateAnswer(URDU, "en", { generate: generate as never, cache });
    expect(second.cached).toBe(true);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("does not remember a translation that fails the checks", async () => {
    const put = vi.fn();
    await expect(translateAnswer(URDU, "en", { generate: vi.fn().mockResolvedValue({ data: { translation: "" } }) as never, cache: { get: async () => null, put } })).rejects.toThrow();
    expect(put).not.toHaveBeenCalled();
  });
});

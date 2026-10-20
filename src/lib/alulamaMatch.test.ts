import { describe, expect, it, vi } from "vitest";
import { coverage, matchAlulama, queryTokens } from "./alulamaMatch";
import type { AlulamaHit } from "./alulama";

const hit = (id: number, title: string, snippet = ""): AlulamaHit => ({ id, kind: "fatwa", number: id, title, answer_snippet: snippet, answerers: [], link: `https://alulama.org/${id}/`, published: null, score: 0.8 });

describe("queryTokens", () => {
  it("drops the filler of a question and keeps its matter", () => {
    expect(queryTokens("کیا مسافر پر نماز جمعہ کا حکم ہے؟")).toEqual(["مسافر", "نماز", "جمعه"]);
  });

  it("reads one word spelled three ways as one", () => {
    expect(queryTokens("زکاۃ")).toEqual(queryTokens("زکوٰۃ"));
    expect(queryTokens("زکاۃ")).toEqual(queryTokens("زکوة"));
  });
});

describe("coverage", () => {
  it("counts a word when its stem is in the text", () => {
    expect(coverage(["مسافر", "نماز", "جمعه"], "سفر میں نماز جمعہ کا کیا حکم ہے؟ مسافر کو رخصت ہے")).toBe(1);
    expect(coverage(["بینك", "سود"], "نماز جمعہ مسافر")).toBe(0);
    expect(coverage(queryTokens("پاکستان موسم"), "پاکستان میں قربانی")).toBe(0.5);
  });
});

describe("matchAlulama", () => {
  it("asks the database with the folded key words and the kind", async () => {
    const call = vi.fn().mockResolvedValue([hit(1, "سفر میں نمازِ جمعہ کا کیا حکم ہے؟", "مسافر کو نماز جمعہ کی رخصت ہے")]);
    const out = await matchAlulama("کیا مسافر پر نماز جمعہ کا حکم ہے؟", "fatwa", { cfg: { url: "https://x.supabase.co", key: "k" }, call });
    expect(call).toHaveBeenCalledWith(expect.anything(), "match_alulama", { q: "مسافر نماز جمعه", k: "fatwa", min_score: 0.55, max_results: 8 });
    expect(out.map((h) => h.id)).toEqual([1]);
  });

  it("leaves out a trigram coincidence that is not about the matter, and repeats", async () => {
    const call = vi.fn().mockResolvedValue([hit(1, "غسل جمعہ کا تعلق دن سے ہے", "اور بینک کی بات"), hit(2, "کرپٹو کرنسی اور اس کی دیگر صورتیں", "کرپٹو کرنسی کا حکم"), hit(2, "کرپٹو کرنسی اور اس کی دیگر صورتیں", "کرپٹو کرنسی کا حکم")]);
    const out = await matchAlulama("کرپٹو کرنسی", "fatwa", { cfg: { url: "u", key: "k" }, call });
    expect(out.map((h) => h.id)).toEqual([2]);
  });

  it("puts the title that holds more of the asked words first, whatever the database's score order", async () => {
    const call = vi.fn().mockResolvedValue([
      hit(1, "غسل جمعہ کا تعلق دن سے ہے یا نماز جمعہ سے", "مسافر پر غسل کا حکم"),
      hit(2, "سفر میں نمازِ جمعہ کا کیا حکم ہے؟", "مسافر کو رخصت ہے"),
      hit(3, "نماز جمعہ کی شرائط", "سفر کی بات"),
    ]);
    const out = await matchAlulama("سفر میں نماز جمعہ", "fatwa", { cfg: { url: "u", key: "k" }, call });
    expect(out.map((h) => h.id)).toEqual([2, 1, 3]);
  });

  it("gives nothing for a query with no matter in it, or a hadith query of fewer than three words", async () => {
    const call = vi.fn();
    expect(await matchAlulama("کیا ہے؟", "fatwa", { cfg: { url: "u", key: "k" }, call })).toEqual([]);
    expect(await matchAlulama("حدیث صحیح", "hadith_ruling", { cfg: { url: "u", key: "k" }, call })).toEqual([]);
    expect(call).not.toHaveBeenCalled();
  });
});

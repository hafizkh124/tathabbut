import { describe, expect, it, vi } from "vitest";
import type { ClaimResult } from "./clientTypes";
import { expansionQueries, alulamaQueriesOf } from "./alulamaClient";
import { checkClaims } from "./claims";
import { cleanExpansion, expandPrompt, expandTopic } from "./expand";
import { cleanTerms, cleanTopicUrdu } from "./topic";

describe("expandPrompt", () => {
  it("gives the topic words only, tells the model what colloquial words may mean, and forbids rulings and stories", () => {
    const p = expandPrompt({ ur: "نیوندرا کا حکم", ar: "النيوندرا", en: "Neondra custom" });
    expect(p).toContain("«نیوندرا کا حکم | النيوندرا | Neondra custom»");
    expect(p).toContain("النقوط");
    expect(p).toContain("no ruling");
    expect(p).toContain("no story");
  });
});

describe("cleanExpansion / expandTopic", () => {
  it("keeps only short topics of the right language and drops names with digits, stories and the wrong script", () => {
    const x = cleanExpansion({
      ur: ["نیوتہ", "شادی میں رقم دینا", "میرے چچا احمد نے 5 ہزار دیے", "english"],
      ar: ["النقوط", "هدية الأفراح", "x y z"],
      en: ["wedding money gifts", "نیوتہ"],
    });
    expect(x).toEqual({ ur: ["نیوتہ", "شادی میں رقم دینا"], ar: ["النقوط", "هدية الأفراح"], en: ["wedding money gifts"] });
  });

  it("asks the model once and returns the cleaned names", async () => {
    const generate = vi.fn().mockResolvedValue({ data: { ur: ["نیوتہ"], ar: ["النقوط"], en: [] }, model: "m", ms: 1 });
    const x = await expandTopic({ ur: "نیوندرا" }, { generate: generate as never });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(x).toEqual({ ur: ["نیوتہ"], ar: ["النقوط"], en: [] });
  });

  it("gives empty lists when the model has nothing", () => {
    expect(cleanExpansion(undefined)).toEqual({ ur: [], ar: [], en: [] });
    expect(cleanExpansion({ ur: "not a list" })).toEqual({ ur: [], ar: [], en: [] });
  });
});

describe("cleanTerms", () => {
  it("looks up each of two names given in one string", () => {
    expect(cleanTerms(["نیوتہ اور نیوندرا", "ویل / بھاجی", "a and b"], cleanTopicUrdu, 6)).toEqual(["نیوتہ", "نیوندرا", "ویل", "بھاجی"]);
  });

  it("is at most `max`, without repeats", () => {
    expect(cleanTerms(["نیوتہ", "نیوتہ", "نیندرا", "ویل", "بھاجی"], cleanTopicUrdu, 3)).toEqual(["نیوتہ", "نیندرا", "ویل"]);
  });
});

describe("the names the extraction gives a question's matter", () => {
  const post = "نیوندرا کا کیا حکم ہے؟";
  const raw = { kind: "question", text_as_written: post, question_scope: "general", topic_ar: "النقوط في الأفراح", topic_ur: "شادی میں رقم دینے کی رسم", topic_en: "wedding money gifts", alt_ur: ["نیوتہ", "نیوندرا", "بہت ہی لمبا جملہ جو موضوع نہیں بلکہ پوری کہانی ہے اور بہت لمبی"], alt_ar: ["النقوط"] };

  it("keeps the standard topic, and the other names that pass the topic check", () => {
    const { claims } = checkClaims(post, [raw]);
    expect(claims[0]).toMatchObject({ topic: "النقوط في الأفراح", topicUr: "شادی میں رقم دینے کی رسم", topicEn: "wedding money gifts", altUr: ["نیوتہ", "نیوندرا"], altAr: ["النقوط"] });
  });

  it("searches العلماء with the topic and every other name, once each", () => {
    const { claims } = checkClaims(post, [raw]);
    const r = { claim: claims[0], state: "مسألة فقهية", basis: "kind", notes: [] } as unknown as ClaimResult;
    expect(alulamaQueriesOf(r, "fatwa")).toEqual(["شادی میں رقم دینے کی رسم", "نیوتہ", "نیوندرا"]);
  });

  it("turns the second look's names into queries, Urdu then English, without repeats", () => {
    expect(expansionQueries({ ur: ["نیوتہ", "نیندرا"], en: ["wedding money gifts", "نیوتہ"] })).toEqual(["نیوتہ", "نیندرا", "wedding money gifts"]);
  });
});

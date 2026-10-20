import { describe, expect, it } from "vitest";
import { cleanTopicAny, cleanTopicEn, cleanTopicUrdu, topicLabel } from "./topic";

describe("topics in other languages", () => {
  it("accepts a short English or Urdu topic and refuses a story, a name with digits, or a long text", () => {
    expect(cleanTopicEn("network marketing")).toBe("network marketing");
    expect(cleanTopicEn("Friday prayer while travelling")).toBe("Friday prayer while travelling");
    expect(cleanTopicEn("my father Ahmed 2 years")).toBeNull();
    expect(cleanTopicEn("a b c d e f g")).toBeNull();
    expect(cleanTopicEn("نیٹ ورک")).toBeNull();
    expect(cleanTopicUrdu("نیٹ ورک مارکیٹنگ")).toBe("نیٹ ورک مارکیٹنگ");
    expect(cleanTopicAny("network marketing")).toBe("network marketing");
    expect(cleanTopicAny("نیٹ ورک مارکیٹنگ")).toBe("نیٹ ورک مارکیٹنگ");
    expect(cleanTopicAny("میرے باپ نے 2 سال پہلے کہا")).toBeNull();
  });
});

describe("topicLabel", () => {
  const c = { topic: "التسويق الشبكي", topicUr: "نیٹ ورک مارکیٹنگ", topicEn: "network marketing" };
  it("gives the topic in the interface language, with the Arabic the books were asked in beside it", () => {
    expect(topicLabel(c, "ur")).toEqual({ main: "نیٹ ورک مارکیٹنگ", arabic: "التسويق الشبكي" });
    expect(topicLabel(c, "en")).toEqual({ main: "network marketing", arabic: "التسويق الشبكي" });
    expect(topicLabel(c, "ar")).toEqual({ main: "التسويق الشبكي", arabic: null });
  });

  it("falls back to the Arabic topic when the language's own is missing", () => {
    expect(topicLabel({ topic: "التسويق الشبكي" }, "ur")).toEqual({ main: "التسويق الشبكي", arabic: null });
    expect(topicLabel({}, "en")).toEqual({ main: null, arabic: null });
  });
});

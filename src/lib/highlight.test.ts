import { describe, expect, it } from "vitest";
import { markWords, segmentPost } from "./highlight";

const POST = "السلام عليكم. قال تعالى: إن الله مع الصابرين. وقال النبي: اطلبوا العلم ولو بالصين. انشرها";

describe("segmentPost", () => {
  it("cuts the post around each claim, in reading order", () => {
    const { segments, placed } = segmentPost(POST, [
      { textAsWritten: "اطلبوا العلم ولو بالصين" },
      { textAsWritten: "إن الله مع الصابرين" },
    ]);
    expect(placed).toEqual([true, true]);
    expect(segments.map((s) => s.claim)).toEqual([null, 1, null, 0, null]);
    expect(segments.map((s) => s.text).join("")).toBe(POST);
  });

  it("ignores quotes and full stops around the claim", () => {
    const { segments } = segmentPost(POST, [{ textAsWritten: "«إن الله مع الصابرين»." }]);
    expect(segments.find((s) => s.claim === 0)?.text).toBe("إن الله مع الصابرين");
  });

  it("falls back to the Arabic span, and leaves out a claim it cannot place", () => {
    const { segments, placed } = segmentPost(POST, [
      { textAsWritten: "غير موجود في النص إطلاقا", arabicSpan: "اطلبوا العلم ولو بالصين" },
      { textAsWritten: "نص آخر لا وجود له" },
    ]);
    expect(placed).toEqual([true, false]);
    expect(segments.some((s) => s.claim === 0)).toBe(true);
    expect(segments.map((s) => s.text).join("")).toBe(POST);
  });

  it("gives two equal claims two different places", () => {
    const post = "إن الله مع الصابرين ... إن الله مع الصابرين";
    const { segments } = segmentPost(post, [{ textAsWritten: "إن الله مع الصابرين" }, { textAsWritten: "إن الله مع الصابرين" }]);
    expect(segments.filter((s) => s.claim !== null).map((s) => s.claim)).toEqual([0, 1]);
  });
});

describe("markWords", () => {
  it("flags the uncertain words and keeps every character", () => {
    const pieces = markWords("إن الله مع الصابرون ... الصابرون", ["الصابرون"]);
    expect(pieces.map((p) => p.text).join("")).toBe("إن الله مع الصابرون ... الصابرون");
    expect(pieces.filter((p) => p.flagged).length).toBe(2);
  });

  it("no words, or words not in the text, flag nothing; special characters are safe", () => {
    expect(markWords("نص", [])).toEqual([{ text: "نص", flagged: false }]);
    expect(markWords("نص (1)", ["(1)"]).some((p) => p.flagged)).toBe(true);
    expect(markWords("نص", ["غير"]).some((p) => p.flagged)).toBe(false);
  });
});

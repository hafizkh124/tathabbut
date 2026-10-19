import { describe, expect, it } from "vitest";
import { captionAdds, sharedText } from "./sharedInput";

describe("sharedText", () => {
  it("keeps a WhatsApp message as it is", () => {
    expect(sharedText({ text: "  اطلبوا العلم ولو بالصين  " })).toBe("اطلبوا العلم ولو بالصين");
  });

  it("joins title, text and link in that order", () => {
    expect(sharedText({ title: "منشور", text: "صوموا تصحوا", url: "https://example.com/p" })).toBe("منشور\nصوموا تصحوا\nhttps://example.com/p");
  });

  it("does not repeat a link the text already holds, nor a title the text begins with", () => {
    expect(sharedText({ title: "صوموا", text: "صوموا تصحوا https://example.com/p", url: "https://example.com/p" })).toBe("صوموا تصحوا https://example.com/p");
  });

  it("gives an empty text when nothing was shared", () => {
    expect(sharedText({ title: null, text: undefined, url: "" })).toBe("");
  });
});

describe("caption with a picture", () => {
  const verse = "أَلَمْ تَرَ كَيْفَ ضَرَبَ اللَّهُ مَثَلًا كَلِمَةً طَيِّبَةً كَشَجَرَةٍ طَيِّبَةٍ أَصْلُهَا ثَابِتٌ وَفَرْعُهَا فِي السَّمَاءِ ۝٢٤";
  it("adds nothing when it repeats the picture's words, with or without tashkeel and the verse number (2026-10-19)", () => {
    expect(captionAdds(verse, "ألم تر كيف ضرب الله مثلا كلمة طيبة كشجرة طيبة أصلها ثابت وفرعها في السماء")).toBe(false);
    expect(captionAdds(verse, "كلمة طيبة كشجرة طيبة")).toBe(false);
    expect(captionAdds("كلمة طيبة", verse)).toBe(false);
    expect(captionAdds(verse, "")).toBe(false);
  });
  it("adds a caption that says something else", () => {
    expect(captionAdds(verse, "قال رسول الله ﷺ: الكلمة الطيبة صدقة")).toBe(true);
  });
});

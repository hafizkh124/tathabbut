import { describe, expect, it } from "vitest";
import { mergeCaption, sharedText } from "./sharedInput";

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
  // the team lead's phone test (2026-10-19): the picture's reading (a model writes Arabic letters, spells out «صلی اللہ علیہ
  // وسلم», and adds the picture's own watermark words) against the message's caption (Urdu keyboard, «ﷺ»)
  const reading = "ورثة الأنبياء AL-ULAMA حضرت انس بيان كرتے ہيں: رسول الله صلى الله عليه وسلم كو كپڑوں ميں سب سے زيادہ پسند دھاري دار يمني چادر تھي۔ [2079: صحيح مسلم] alulama.org ulamaweb";
  const caption = "حضرت انس بیان کرتے ہیں: رسول ﷺ کو کپڑوں میں سب سے زیادہ پسند دھاری دار یمنی چادر تھی۔ [صحیح مسلم:2079]";

  it("uses the reading alone when the caption says the same, whatever the letter forms, marks and watermark words", () => {
    expect(mergeCaption(reading, caption)).toBe(reading);
    expect(mergeCaption(verse, "ألم تر كيف ضرب الله مثلا كلمة طيبة كشجرة طيبة أصلها ثابت وفرعها في السماء")).toBe(verse);
    expect(mergeCaption(verse, "كلمة طيبة كشجرة طيبة")).toBe(verse);
    expect(mergeCaption(verse, "")).toBe(verse);
  });
  it("uses the caption when it is the fuller text of which the reading is a part", () => {
    expect(mergeCaption("كلمة طيبة كشجرة طيبة", verse)).toBe(verse);
  });
  it("joins a caption that says something else", () => {
    expect(mergeCaption(verse, "قال رسول الله ﷺ: الكلمة الطيبة صدقة")).toBe(`${verse}\nقال رسول الله ﷺ: الكلمة الطيبة صدقة`);
  });
});

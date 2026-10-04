import { describe, expect, it } from "vitest";
import { dorarBookId, dorarSearchUrl, searchWords } from "./dorarLink";

describe("dorarBookId", () => {
  it("finds the book a narration comes from", () => {
    expect(dorarBookId("البحر الزخار")).toBe(6181);
    expect(dorarBookId("صحيح البخاري")).toBe(6216);
    expect(dorarBookId("صحيح مسلم")).toBe(3088);
    expect(dorarBookId("السلسلة الضعيفة")).toBe(556);
  });

  it("says nothing when the book is unknown or the name too short to trust", () => {
    expect(dorarBookId(undefined)).toBeNull();
    expect(dorarBookId("")).toBeNull();
    expect(dorarBookId("كتاب لا وجود له في الموسوعة أبدا")).toBeNull();
    expect(dorarBookId("مسند")).toBeNull();
  });
});

describe("searchWords", () => {
  it("drops diacritics, punctuation and Dorar's own [additions]", () => {
    expect(searchWords("مَنْ غَشَّنَا فَلَيْسَ مِنَّا [يعني حديث: من حمل علينا السلاح]، .")).toBe("من غشنا فليس منا");
  });

  it("keeps only the opening words of a long text", () => {
    const long = Array.from({ length: 30 }, (_, i) => `كلمه${"ا".repeat(i % 3)}`).join(" ");
    expect(searchWords(long).split(" ").length).toBe(10);
  });
});

describe("dorarSearchUrl", () => {
  it("narrows the search to the book when it is known", () => {
    const url = dorarSearchUrl("اطلبوا العلم ولو بالصين.", "البحر الزخار");
    expect(url).toContain("https://dorar.net/hadith/search?q=");
    expect(url).toContain("s%5B%5D=6181");
    expect(decodeURIComponent(url)).toContain("اطلبوا العلم ولو بالصين");
  });

  it("is the plain search when the book is not known", () => {
    expect(dorarSearchUrl("اطلبوا العلم", "كتاب لا وجود له في الموسوعة أبدا")).not.toContain("s%5B%5D");
  });
});

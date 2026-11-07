import { describe, expect, it } from "vitest";
import { joinSpoken, problemOf, speechLang, transcriptOf } from "./speech";

describe("speechLang", () => {
  it("maps the interface language to the recogniser's", () => {
    expect(speechLang("ur")).toBe("ur-PK");
    expect(speechLang("ar")).toBe("ar-SA");
    expect(speechLang("en")).toBe("en-US");
  });
});

describe("transcriptOf", () => {
  it("joins the best guess of every result", () => {
    const results = [[{ transcript: " اطلبوا العلم " }, { transcript: "other" }], [{ transcript: "ولو بالصين" }]];
    expect(transcriptOf(results)).toBe("اطلبوا العلم ولو بالصين");
  });
  it("skips empty results", () => {
    expect(transcriptOf([[{ transcript: "" }], [{ transcript: "a" }]])).toBe("a");
    expect(transcriptOf([])).toBe("");
  });
});

describe("joinSpoken", () => {
  it("appends to what was typed with one space", () => {
    expect(joinSpoken("صوموا ", "تصحوا")).toBe("صوموا تصحوا");
  });
  it("uses the spoken words alone in an empty box", () => {
    expect(joinSpoken("", "تصحوا")).toBe("تصحوا");
  });
  it("leaves the box alone when nothing was heard", () => {
    expect(joinSpoken("abc ", "  ")).toBe("abc ");
  });
});

describe("problemOf", () => {
  it("names the problems worth telling", () => {
    expect(problemOf("not-allowed")).toBe("denied");
    expect(problemOf("no-speech")).toBe("none");
    expect(problemOf("network")).toBe("network");
    expect(problemOf("audio-capture")).toBe("mic");
    expect(problemOf("language-not-supported")).toBe("other");
  });
  it("says nothing when the recogniser was only stopped", () => {
    expect(problemOf("aborted")).toBeNull();
  });
});

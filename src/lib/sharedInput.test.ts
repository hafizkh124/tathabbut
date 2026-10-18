import { describe, expect, it } from "vitest";
import { sharedText } from "./sharedInput";

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

import { describe, expect, it } from "vitest";
import { guessLocale } from "./guess";

describe("guessLocale", () => {
  it("starts in Urdu on a phone set to Urdu, wherever it is", () => {
    expect(guessLocale(["ur-PK", "en"], "Europe/London", "ar")).toBe("ur");
    expect(guessLocale(["en-US", "ur"], "Asia/Kolkata", "ar")).toBe("ur");
    expect(guessLocale(["UR-IN"], undefined, "ar")).toBe("ur");
  });
  it("starts in Urdu on an English phone in Pakistan's time zone", () => {
    expect(guessLocale(["en-PK"], "Asia/Karachi", "ar")).toBe("ur");
  });
  it("keeps Arabic everywhere else", () => {
    expect(guessLocale(["ar-SA"], "Asia/Riyadh", "ar")).toBe("ar");
    expect(guessLocale(["en-US"], "America/New_York", "ar")).toBe("ar");
    expect(guessLocale(["en-IN"], "Asia/Kolkata", "ar")).toBe("ar");
    expect(guessLocale(undefined, undefined, "ar")).toBe("ar");
  });
  it("does not mistake other languages that start with u", () => {
    expect(guessLocale(["uk-UA", "uz"], "Europe/Kyiv", "ar")).toBe("ar");
  });
});

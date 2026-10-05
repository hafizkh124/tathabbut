import { describe, expect, it } from "vitest";
import { signExcerpt, verifyExcerpt } from "./turathSign";

describe("excerpt signature", () => {
  const text = "باب سجود السهو";

  it("accepts the signature of the same text and refuses another text", () => {
    const sig = signExcerpt(text, "k1")!;
    expect(verifyExcerpt(text, sig, "k1")).toBe(true);
    expect(verifyExcerpt(`${text}.`, sig, "k1")).toBe(false);
  });

  it("refuses a signature made with another key, or one that is not a signature", () => {
    const sig = signExcerpt(text, "k1")!;
    expect(verifyExcerpt(text, sig, "k2")).toBe(false);
    for (const bad of [undefined, null, 42, "", "abc", "z".repeat(64)]) expect(verifyExcerpt(text, bad, "k1")).toBe(false);
  });

  it("signs nothing, and so accepts nothing, when the server has no key", () => {
    expect(signExcerpt(text, null)).toBeUndefined();
    expect(verifyExcerpt(text, "0".repeat(64), null)).toBe(false);
  });
});

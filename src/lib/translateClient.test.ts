import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchTranslation, forgetTranslations } from "./translateClient";

beforeEach(() => forgetTranslations());

const answer = (body: unknown, ok = true) => vi.fn(async () => ({ ok, json: async () => body }) as unknown as Response);

describe("fetchTranslation", () => {
  it("posts the text, its signature and the language, and returns the translation", async () => {
    const f = answer({ translation: "Chapter" });
    expect(await fetchTranslation("باب", "a".repeat(64), "en", f)).toBe("Chapter");
    const [url, init] = f.mock.calls[0] as unknown as [string, { body: string }];
    expect(url).toBe("/api/translate");
    expect(JSON.parse(init.body)).toEqual({ text: "باب", sig: "a".repeat(64), to: "en" });
  });

  it("asks once for the same excerpt and language, and again for another language", async () => {
    const f = answer({ translation: "x" });
    await fetchTranslation("باب", "s1", "en", f);
    await fetchTranslation("باب", "s1", "en", f);
    await fetchTranslation("باب", "s1", "ur", f);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("is null on a failed request, an odd answer or a network error, and asks again next time", async () => {
    expect(await fetchTranslation("باب", "s2", "en", answer({}, false))).toBeNull();
    expect(await fetchTranslation("باب", "s2", "en", answer({ translation: "  " }))).toBeNull();
    const offline = vi.fn(async () => {
      throw new Error("offline");
    });
    expect(await fetchTranslation("باب", "s2", "en", offline as unknown as typeof fetch)).toBeNull();
    const ok = answer({ translation: "Chapter" });
    expect(await fetchTranslation("باب", "s2", "en", ok)).toBe("Chapter");
    expect(ok).toHaveBeenCalledOnce();
  });
});

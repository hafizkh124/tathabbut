import { describe, expect, it, vi } from "vitest";
import { checkReading, readImage, validateImage } from "./ocr";

describe("checkReading", () => {
  it("trims the text and keeps only uncertain words that are really in it", () => {
    const r = checkReading({ text: "  إن الله مع الصابرون\n", uncertain: ["الصابرون", "غير موجودة", "الصابرون", " ", 5] });
    expect(r.text).toBe("إن الله مع الصابرون");
    expect(r.uncertain).toEqual(["الصابرون"]);
  });

  it("an image without text gives an empty reading", () => {
    expect(checkReading({})).toEqual({ text: "", uncertain: [] });
    expect(checkReading({ text: 12, uncertain: "x" })).toEqual({ text: "", uncertain: [] });
  });
});

describe("validateImage", () => {
  const png = Buffer.from("fake image bytes").toString("base64");

  it("accepts a base64 picture, with or without the data: prefix", () => {
    expect(validateImage({ image: png, mimeType: "image/png" }).ok).toBe(true);
    expect(validateImage({ image: `data:image/png;base64,${png}`, mimeType: "image/png" })).toMatchObject({ ok: true, image: { data: png } });
  });

  it("refuses other types, non-base64 and oversize pictures", () => {
    expect(validateImage({ image: png, mimeType: "application/pdf" })).toMatchObject({ ok: false, status: 400 });
    expect(validateImage({ image: "not base64 !!", mimeType: "image/png" })).toMatchObject({ ok: false, status: 400 });
    expect(validateImage({ image: "A".repeat(5_000_000), mimeType: "image/jpeg" })).toMatchObject({ ok: false, status: 413 });
    expect(validateImage({})).toMatchObject({ ok: false, status: 400 });
  });
});

describe("readImage", () => {
  it("asks the model to copy, not correct, and cleans what it returns", async () => {
    const generate = vi.fn(async () => ({ data: { text: "قال: إن الله مع الصابرون", uncertain: ["الصابرون"] }, model: "m", ms: 5 }));
    const r = await readImage({ mimeType: "image/png", data: "AAAA" }, { generate: generate as never });
    expect(r).toMatchObject({ text: "قال: إن الله مع الصابرون", uncertain: ["الصابرون"], model: "m" });
    const prompt = (generate.mock.calls[0] as unknown as [string])[0];
    expect(prompt).toMatch(/Do NOT correct/);
  });
});

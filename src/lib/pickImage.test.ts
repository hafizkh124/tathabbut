import { describe, expect, it } from "vitest";
import { imageFromClipboard, imageFromDrop } from "./pickImage";

const file = (name: string, type: string) => new File(["x"], name, { type });
const clip = (files: File[], text = "") => ({
  files: files as unknown as FileList,
  types: text ? ["text/plain", "Files"] : ["Files"],
  getData: (t: string) => (t === "text/plain" ? text : ""),
});

describe("imageFromDrop", () => {
  it("takes the first picture among the dropped files", () => {
    const pdf = file("a.pdf", "application/pdf");
    const png = file("b.png", "image/png");
    expect(imageFromDrop({ files: [pdf, png] as unknown as FileList })).toBe(png);
  });

  it("gives nothing for other files or an empty drop", () => {
    expect(imageFromDrop({ files: [file("a.pdf", "application/pdf")] as unknown as FileList })).toBeNull();
    expect(imageFromDrop({ files: [] as unknown as FileList })).toBeNull();
    expect(imageFromDrop(null)).toBeNull();
  });
});

describe("imageFromClipboard", () => {
  it("takes a screenshot copied on its own", () => {
    const png = file("image.png", "image/png");
    expect(imageFromClipboard(clip([png]))).toBe(png);
  });

  it("leaves the clipboard alone when text came with the picture", () => {
    expect(imageFromClipboard(clip([file("image.png", "image/png")], "نص منسوخ"))).toBeNull();
  });

  it("gives nothing for a clipboard with no picture", () => {
    expect(imageFromClipboard(clip([]))).toBeNull();
    expect(imageFromClipboard(clip([file("a.pdf", "application/pdf")]))).toBeNull();
    expect(imageFromClipboard(null)).toBeNull();
  });
});

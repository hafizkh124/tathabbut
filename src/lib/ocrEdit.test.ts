import { describe, expect, it } from "vitest";
import { markWords } from "./highlight";
import { cleanWord, pushHistory, replacePiece, stillUnsure } from "./ocrEdit";

describe("fixing one unsure word", () => {
  const text = "إن الله مع الصابرون وإن الله غفور";
  const pieces = markWords(text, ["الصابرون"]);

  it("replaces only the chosen piece and keeps every other character", () => {
    const i = pieces.findIndex((p) => p.flagged);
    expect(replacePiece(pieces, i, "الصابرين")).toBe("إن الله مع الصابرين وإن الله غفور");
  });

  it("removes the word when the new text is empty", () => {
    const i = pieces.findIndex((p) => p.flagged);
    expect(replacePiece(pieces, i, "")).toBe("إن الله مع  وإن الله غفور");
  });

  it("changes one occurrence when the same word is unsure twice", () => {
    const two = markWords("كلمة و كلمة", ["كلمة"]);
    const flagged = two.map((p, i) => (p.flagged ? i : -1)).filter((i) => i >= 0);
    expect(flagged).toHaveLength(2);
    expect(replacePiece(two, flagged[1], "ثانية")).toBe("كلمة و ثانية");
  });
});

describe("accepting an unsure word", () => {
  it("stops listing a word the person accepted", () => {
    expect(stillUnsure(["أ", "ب"], new Set(["أ"]))).toEqual(["ب"]);
  });
  it("lists all when nothing is accepted", () => {
    expect(stillUnsure(["أ", "ب"], new Set())).toEqual(["أ", "ب"]);
  });
});

describe("cleanWord", () => {
  it("trims and joins lines", () => {
    expect(cleanWord("  كلمة \n")).toBe("كلمة");
  });
});

describe("undo history", () => {
  it("adds each text once and in order", () => {
    let h: string[] = [];
    h = pushHistory(h, "a");
    h = pushHistory(h, "a");
    h = pushHistory(h, "b");
    expect(h).toEqual(["a", "b"]);
  });
  it("keeps at most `max` entries, the newest", () => {
    let h: string[] = [];
    for (const s of ["1", "2", "3", "4"]) h = pushHistory(h, s, 3);
    expect(h).toEqual(["2", "3", "4"]);
  });
});

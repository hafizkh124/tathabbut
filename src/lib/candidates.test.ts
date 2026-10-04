import { describe, expect, it } from "vitest";
import { applyPick, pickedIndex } from "./candidates";
import type { ClaimResult } from "./clientTypes";
import { STATES } from "./states";

const view = (surah: number, ayah: number, exact: boolean) => ({ surah, ayah, surahName: `s${surah}`, text: "t", wording: { exact, correctText: "x", diffs: [], distance: exact ? 0 : 0.25 } });

const claim = (): ClaimResult =>
  ({
    claim: { kind: "quran", textAsWritten: "x" },
    state: STATES.verseOk,
    basis: "quran",
    notes: [],
    verse: { ...view(2, 153, true), candidates: [view(2, 153, true), view(8, 46, false)] },
  }) as unknown as ClaimResult;

describe("applyPick", () => {
  it("keeps the best match by default", () => {
    expect(applyPick(claim(), undefined).verse?.ayah).toBe(153);
    expect(applyPick(claim(), 0).verse?.ayah).toBe(153);
  });

  it("shows the chosen verse and the state that goes with how the quote fits it", () => {
    const r = applyPick(claim(), 1);
    expect(r.verse).toMatchObject({ surah: 8, ayah: 46 });
    expect(r.state).toBe(STATES.verseWrong);
    expect(r.verse?.candidates?.length).toBe(2);
  });

  it("ignores a choice that does not exist, and a claim without candidates", () => {
    expect(applyPick(claim(), 5).verse?.ayah).toBe(153);
    const alone = claim();
    delete alone.verse!.candidates;
    expect(applyPick(alone, 1)).toBe(alone);
  });
});

describe("pickedIndex", () => {
  it("tells which candidate is showing", () => {
    expect(pickedIndex(claim())).toBe(0);
    expect(pickedIndex(applyPick(claim(), 1))).toBe(1);
  });
});

import { describe, expect, it } from "vitest";
import { cleanTranslation } from "./quranTranslation";

// Inputs are taken from the quranpedia dumps as downloaded on 2026-10-03.
describe("cleanTranslation", () => {
  it("drops the footnotes and the call-out mark (Urdu 1:1)", () => {
    const raw =
      "شروع کرتا ہوں اللہ تعالیٰ کے نام سے جو بڑا مہربان نہایت رحم واﻻ ہے۔*<br />\n____________________<br />\n* بسم اللہ کے آغاز میں أَقْرَأُ محذوف ہے";
    expect(cleanTranslation(raw, "ur")).toBe("شروع کرتا ہوں اللہ تعالیٰ کے نام سے جو بڑا مہربان نہایت رحم واﻻ ہے۔");
  });

  it("keeps the Urdu glosses in parentheses (1:7)", () => {
    const raw = "جن پر انعام کیا* ان کی نہیں جن پر غضب کیا گیا (یعنی وه لوگ جنہوں نے حق کو پہچانا)۔<br />\n____________________<br />\n*وضاحت";
    expect(cleanTranslation(raw, "ur")).toBe("جن پر انعام کیا ان کی نہیں جن پر غضب کیا گیا (یعنی وه لوگ جنہوں نے حق کو پہچانا)۔");
  });

  it("unwraps an <h3> that surrounds the whole Urdu translation (25:61)", () => {
    const raw = "<h3>بابرکت ہے وه جس نے آسمان میں برج بنائے* اور اس میں آفتاب بنایا.</h3>";
    expect(cleanTranslation(raw, "ur")).toBe("بابرکت ہے وه جس نے آسمان میں برج بنائے اور اس میں آفتاب بنایا.");
  });

  it("removes the leading ayah number and NBSPs from the English (1:6)", () => {
    const raw = " 6. Guide us to the Straight Way.[3]<br />\n____________________<br /><strong>\n[3] (V.1:6) Guidance is of two kinds:</strong>";
    expect(cleanTranslation(raw, "en")).toBe("Guide us to the Straight Way.");
  });

  it("does not leave a gap before punctuation when a mark is removed (1:7)", () => {
    const raw = " 7. The Way of those on whom You have bestowed Your Grace[4] , not (the way) of those who earned Your Anger [5] (i.e. those who knew the Truth).";
    expect(cleanTranslation(raw, "en")).toBe(
      "The Way of those on whom You have bestowed Your Grace, not (the way) of those who earned Your Anger (i.e. those who knew the Truth).",
    );
  });

  it("joins the cells of a poem table (3:94)", () => {
    const raw =
      "<table class='poem'><tr><td> 94. Then after that, whosoever shall invent a lie against Allâh, </td><td> such shall indeed be the Zâlimûn (disbelievers).</td></tr>";
    expect(cleanTranslation(raw, "en")).toBe(
      "Then after that, whosoever shall invent a lie against Allâh, such shall indeed be the Zâlimûn (disbelievers).",
    );
  });

  it("drops the stray '>' the source leaves after some Urdu verses (7:21)", () => {
    expect(cleanTranslation("میں تم دونوں کا خیر خواه ہوں>", "ur")).toBe("میں تم دونوں کا خیر خواه ہوں");
  });

  it("only strips a number at the very start, not one inside the text", () => {
    expect(cleanTranslation(" 2. Fast for 30. days (see 2:185).", "en")).toBe("Fast for 30. days (see 2:185).");
  });

  it("leaves Urdu text that begins with a digit alone", () => {
    expect(cleanTranslation("2. نمبر", "ur")).toBe("2. نمبر");
  });
});

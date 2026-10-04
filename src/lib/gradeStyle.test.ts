import { describe, expect, it } from "vitest";
import { GRADES } from "./gradeMap";
import { toneOf, TONE_STYLE } from "./gradeStyle";
import { STATES } from "./states";

describe("toneOf", () => {
  it("gives every grade and every state its own tone", () => {
    expect(toneOf(GRADES[0])).toBe("accepted");
    expect(toneOf(GRADES[1])).toBe("weak");
    expect(toneOf(GRADES[2])).toBe("veryWeak");
    expect(toneOf(GRADES[3])).toBe("unsure");
    expect(toneOf(STATES.verseOk)).toBe("verse");
    expect(toneOf(STATES.verseWrong)).toBe("misquote");
    expect(toneOf(STATES.verseTranslated)).toBe("translated");
    expect(toneOf(STATES.fatwa)).toBe("fatwa");
    expect(toneOf(STATES.notFound)).toBe("notFound");
    expect(toneOf(STATES.turathFound)).toBe("found"); // not a grade, and not «غير حاسم»
  });

  it("reads the specialist's own statuses as a misquote", () => {
    expect(toneOf("قول منسوب خطأً إلى النبي ﷺ")).toBe("misquote");
    expect(toneOf("لفظ أو ترجمة غير دقيقة")).toBe("misquote");
    expect(toneOf("قول منسوب خطأً إلى عالم")).toBe("misquote");
  });

  it("never turns a weak wording green, and falls back to غير حاسم", () => {
    expect(toneOf("ضعيف جدا")).toBe("weak");
    expect(toneOf("موضوع")).toBe("veryWeak");
    expect(toneOf("شيء غير معروف")).toBe("unsure");
    expect(toneOf("")).toBe("unsure");
  });

  it("a weak narration is never styled like an accepted one", () => {
    expect(TONE_STYLE[toneOf("ضعيف")].bg).not.toBe(TONE_STYLE[toneOf("مقبول")].bg);
  });

  it("every tone carries an icon", () => {
    for (const t of Object.values(TONE_STYLE)) expect(t.icon).toBeTruthy();
  });
});

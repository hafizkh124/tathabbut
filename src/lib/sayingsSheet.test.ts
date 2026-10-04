import { describe, expect, it } from "vitest";
import { mapHeaders, toSayingRow, type SheetRecord } from "./sayingsSheet";

const approved: SheetRecord = {
  text_ar: "لولاك  لما خلقت الأفلاك",
  phrasing_ur: "اگر آپ نہ ہوتے تو میں آسمان و زمین پیدا نہ کرتا",
  status: "شديد الضعف أو لا أصل له",
  verdict: "موضوع",
  verdict_by: "الصغاني",
  reference: "الموضوعات للصغاني، 52",
  review: "معتمد",
};

describe("mapHeaders", () => {
  it("finds fields by the bracketed name, and does not confuse verdict with verdict_by", () => {
    const m = mapHeaders(["#", "النص العربي (text_ar)", "الحكم كما ورد (verdict)", "قائله (verdict_by)", "حالة المراجعة"]);
    expect([...m.entries()]).toEqual([
      [1, "text_ar"],
      [2, "verdict"],
      [3, "verdict_by"],
      [4, "review"],
    ]);
  });

  it("reads the scholars' sheet headers too", () => {
    const m = mapHeaders(["النسبة المتداولة", "الحوالة المتداولة", "نتيجة التحقيق (verdict)"]);
    expect([...m.values()]).toEqual(["claimed_attribution", "claimed_reference", "verdict"]);
  });
});

describe("toSayingRow", () => {
  it("builds a row from an approved record, with the search form of the text", () => {
    const out = toSayingRow(approved);
    expect(out).toMatchObject({
      skip: false,
      row: { text_ar: "لولاك لما خلقت الأفلاك", text_clean: "لولاك لما خلقت الافلاك", verdict_by: "الصغاني", phrasings: [approved.phrasing_ur] },
    });
  });

  it("loads only «معتمد»", () => {
    expect(toSayingRow({ ...approved, review: "مقترح" })).toMatchObject({ skip: true });
    expect(toSayingRow({ ...approved, review: "محذوف" })).toMatchObject({ skip: true });
  });

  it("refuses an approved row without a source or a ruling", () => {
    expect(toSayingRow({ ...approved, reference: "" })).toEqual({ error: expect.stringContaining("reference") });
    expect(toSayingRow({ ...approved, verdict: " ", verdict_by: "" })).toEqual({ error: expect.stringContaining("verdict, verdict_by") });
  });

  it("refuses an unknown status (e.g. an old term)", () => {
    expect(toSayingRow({ ...approved, status: "موضوع أو لا أصل له" })).toEqual({ error: expect.stringContaining("فئة غير معروفة") });
  });

  it("drops the tool's own review flags from the note, keeps the specialist's notes", () => {
    const flagged = toSayingRow({ ...approved, note: "حكم بالقبول عند 3 من المحدثين — متنازع؛ قرّر هل يدخل القائمة" });
    expect(flagged).toMatchObject({ row: { note: null } });
    const real = toSayingRow({ ...approved, note: "المعنى صحيح ثابت بآيات وأحاديث كثيرة." });
    expect(real).toMatchObject({ row: { note: "المعنى صحيح ثابت بآيات وأحاديث كثيرة." } });
  });

  it("keeps a scholar's misattribution with what is being circulated", () => {
    const out = toSayingRow({
      ...approved,
      status: "قول منسوب خطأً إلى عالم",
      claimed_attribution: "ابن تيمية",
      claimed_reference: "مجموع الفتاوى 7/493",
      correct_text: "مصطفى السباعي، هكذا علمتني الحياة، ص 84",
    });
    expect(out).toMatchObject({ row: { claimed_attribution: "ابن تيمية", claimed_reference: "مجموع الفتاوى 7/493", correct_text: expect.stringContaining("السباعي") } });
  });

  it("joins Urdu and English wordings, splitting several written in one cell", () => {
    const out = toSayingRow({ ...approved, phrasing_ur: "صیغہ ایک | صیغہ دو", phrasing_en: "If not for you" });
    expect(out).toMatchObject({ row: { phrasings: ["صیغہ ایک", "صیغہ دو", "If not for you"] } });
  });
});

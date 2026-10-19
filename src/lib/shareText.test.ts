import { describe, expect, it } from "vitest";
import type { ClaimResult } from "./clientTypes";
import { buildShareText, sourceLine } from "./shareText";

const claim = { kind: "hadith", textAsWritten: "اطلبوا العلم ولو بالصين", query: "q", arabicSpan: "اطلبوا العلم ولو بالصين", language: "ar", queryIsTranslation: false, attributedTo: null, citedSource: null, warnings: [] } as unknown as ClaimResult["claim"];

const hadith = {
  claim,
  state: "ضعيف",
  basis: "dorar",
  notes: [],
  dorar: { narrations: [{ source: "السلسلة الضعيفة", reference: "416" }], summary: {}, externalUrls: {} },
} as unknown as ClaimResult;

const verse = {
  claim: { ...claim, kind: "quran", arabicSpan: "إن الله مع الصابرين" },
  state: "آية صحيحة النقل",
  basis: "quran",
  notes: [],
  verse: { surah: 2, ayah: 153, surahName: "سورة البقرة", text: "x" },
} as unknown as ClaimResult;

describe("share text", () => {
  it("keeps the shared text short: no wording-variant details (specialist, 2026-10-05)", () => {
    const matn = "الجنة تحت أقدام الأمهات من شئن أدخلن ومن شئن أخرجن";
    const r = { ...hadith, claim: { ...claim, arabicSpan: "الجنة تحت أقدام الأمهات" }, dorar: { ...hadith.dorar!, narrations: [hadith.dorar!.narrations[0], { ...hadith.dorar!.narrations[0], matn, textVariant: "additional" as const, source: "السلسلة الضعيفة", reference: "593", verdict: "موضوع", muhaddith: "الألباني" }] } };
    const text = buildShareText([r], "ur");
    expect(text).toContain("«الجنة تحت أقدام الأمهات»");
    expect(text).not.toContain(matn);
    expect(text).not.toContain("اس روایت میں اضافی الفاظ ہیں");
  });
  it("uses the approved no-reference message without manufacturing a hadith grade", () => {
    const r = { claim, state: "لم يُعثر عليه — إحالة", basis: "none", notes: [] } as ClaimResult;
    const text = buildShareText([r], "ur");
    expect(text).toContain("اس عبارت کا معتبر حوالہ نہیں ملا — اہلِ علم سے رجوع کریں");
    expect(text).not.toContain("شدید ضعیف");
  });
  it("leaves the narrator-criticism note to the app and keeps the scholar with the source", () => {
    const verdict = "[فيه] حسين بن عبد الله متروك الحديث";
    const r = { ...hadith, dorar: { ...hadith.dorar!, narrations: [{ ...hadith.dorar!.narrations[0], verdict, muhaddith: "ابن حبان", scope: "narrator" as const }] } };
    const text = buildShareText([r], "ur");
    expect(text).toContain("ماخذ: السلسلة الضعيفة، 416");
    expect(text).toContain("محدث: ابن حبان");
    expect(text).not.toContain("یہ اس سند کے راوی کی جرح ہے");
  });
  it("shows the retrieved Arabic for a translated claim without verifying its wording", () => {
    const r = { ...hadith, claim: { ...claim, language: "ur" as const, arabicSpan: null, queryIsTranslation: true, textAsWritten: "تم میں سے بہترین وہ ہے جو قرآن سیکھے اور سکھائے", query: "a reconstructed search" }, dorar: { ...hadith.dorar!, narrations: [{ ...hadith.dorar!.narrations[0], matn: "خيركم من تعلم القرآن وعلمه" }] } };
    const text = buildShareText([r], "ur");
    expect(text).toContain("اس ترجمہ شدہ عبارت سے ملنے والا عربی متن: خيركم من تعلم القرآن وعلمه");
    expect(text).toContain("ہر لفظ کی تصدیق مراد نہیں");
    expect(text).not.toContain("a reconstructed search");
    expect(buildShareText([{ ...r, claim: { ...r.claim, queryIsTranslation: false } }], "ur")).not.toContain("اس ترجمہ شدہ عبارت سے ملنے والا عربی متن");
  });
  it("leaves the halik chain note to the app (specialist, 2026-10-06)", () => {
    const r = { ...hadith, dorar: { ...hadith.dorar!, narrations: [{ ...hadith.dorar!.narrations[0], verdict: "إسناده هالك", scope: "isnad" as const }] } };
    expect(buildShareText([r], "ur")).not.toContain("شدید ضعف کا یہ حکم اسی سند کے بارے میں ہے۔");
  });
  it("gives a Sahihayn hadith one line with the imam, the book and the number, and no grading or source lines", () => {
    for (const [source, muhaddith, name] of [["صحيح البخاري", "البخاري", "بخاری"], ["صحيح مسلم", "مسلم", "مسلم"]]) {
      const r = { ...hadith, dorar: { ...hadith.dorar!, narrations: [{ ...hadith.dorar!.narrations[0], source, muhaddith, reference: "41", verdict: "[صحيح]" }] } };
      const text = buildShareText([r], "ur");
      expect(text).toContain(`امام ${name} نے اپنی صحیح میں روایت کیا ہے، 41۔`);
      expect(text).not.toContain("حکم:");
      expect(text).not.toContain("ماخذ:");
    }
    const ar = { ...hadith, state: "مقبول", dorar: { ...hadith.dorar!, narrations: [{ source: "صحيح مسلم", muhaddith: "مسلم", reference: "41", verdict: "[صحيح]", matn: "x" }] } } as unknown as ClaimResult;
    expect(buildShareText([ar], "ar").split("\n").slice(2, 4)).toEqual(["«اطلبوا العلم ولو بالصين»", "🟢 *أخرجه الإمام مسلم في صحيحه، 41.*"]);
  });

  it("never puts a Dorar link in the shared text", () => {
    const r = { ...hadith, dorar: { ...hadith.dorar!, narrations: [{ ...hadith.dorar!.narrations[0], matn: "x" }], externalUrls: { dorar: "https://dorar.net/hadith/search?q=x" } } } as unknown as ClaimResult;
    expect(buildShareText([r], "ar")).not.toContain("dorar.net");
  });
  it("shares the context warning together with the full verse", () => {
    const r = { ...verse, state: "آية اقتطع سياقها", verse: { ...verse.verse!, text: "لا تقربوا الصلاة وأنتم سكارى", wording: { exact: true, contextOmitted: true as const, correctText: "لا تقربوا الصلاة", distance: 0, diffs: [] } } };
    const text = buildShareText([r], "ur");
    expect(text).toContain("آیت کا سیاق حذف ہوا ہے");
    expect(text).toContain("وأنتم سكارى");
  });
  it("tells the reader of a shared personal case to ask a mufti", () => {
    const r = { ...hadith, claim: { ...claim, kind: "question" as const, scope: "personal" as const } };
    expect(buildShareText([r], "ur")).toContain("اپنے معتمد دار الافتاء یا مفتی سے رجوع کریں۔");
  });
  it("names the book and page for a hadith, and the surah and verse for the Quran", () => {
    expect(sourceLine(hadith, "ar")).toBe("السلسلة الضعيفة، 416");
    expect(sourceLine(verse, "ar")).toBe("سورة البقرة، الآية 153");
    expect(sourceLine(verse, "en")).toBe("Surah البقرة, verse 153");
    expect(sourceLine(verse, "ur")).toBe("سورہ البقرة، آیت 153");
  });

  it("writes the claim, its result in the user's language and the source", () => {
    const text = buildShareText([hadith], "en");
    expect(text).toContain("«اطلبوا العلم ولو بالصين»");
    expect(text).toContain("Weak");
    expect(text).toContain("السلسلة الضعيفة، 416");
  });

  it("ends with the link to the results themselves when each has one, else the app's address", () => {
    const a = { ...verse, shareId: "abcDEF123456" } as ClaimResult;
    const b = { ...verse, shareId: "xyzXYZ987654" } as ClaimResult;
    expect(buildShareText([a, b], "ar").trim().endsWith("https://tathabbut.alulama.org/r/abcDEF123456-xyzXYZ987654")).toBe(true);
    expect(buildShareText([a, verse], "ar").trim().endsWith("https://tathabbut.alulama.org")).toBe(true);
  });

  it("puts no source link in the shared text, only the app's address at the end (specialist, 2026-10-06)", () => {
    const text = buildShareText([verse], "ar");
    expect(text).not.toContain("quranpedia");
    expect(text.trim().endsWith("لمزيد من التحقق:\nhttps://tathabbut.alulama.org")).toBe(true);
  });

  it("keeps a list entry's web address out of the shared text", () => {
    const r = { claim, state: "قول منسوب خطأً إلى عالم", basis: "specialist-list", notes: [], saying: { reference: "موقع العلماء، 2023، https://alulama.org/x/", externalUrls: { dorar: "https://dorar.net/hadith/search?q=x" } } } as unknown as ClaimResult;
    const text = buildShareText([r], "ar");
    expect(text).toContain("المصدر: موقع العلماء، 2023");
    expect(text).not.toContain("alulama.org/x");
    expect(text).not.toContain("dorar.net");
  });

  it("separates several claims", () => {
    // the platform's name, two claims, the link
    expect(buildShareText([hadith, verse], "ar").split("\n\n").length).toBe(4);
  });

  it("opens with the platform's name, numbers several claims and marks each result with its badge's colour (2026-10-19)", () => {
    const text = buildShareText([hadith, verse], "ur");
    expect(text.startsWith("*تثبت پلیٹ فارم*\n\n")).toBe(true);
    expect(text).not.toContain("العلماء");
    expect(text).toContain("*1.* «اطلبوا العلم ولو بالصين»\n🟡 *");
    expect(text).toContain("*2.* «إن الله مع الصابرين»\n🟢 *");
    expect(buildShareText([hadith], "ur").startsWith("*تثبت پلیٹ فارم*\n\n«اطلبوا")).toBe(true);
    expect(text.endsWith("مزید تحقیق کے لیے:\nhttps://tathabbut.alulama.org")).toBe(true);
  });

  it("gives a misquoted verse as written, the mistake, the mushaf's wording, then its place (2026-10-19)", () => {
    const r = { ...verse, claim: { ...verse.claim, arabicSpan: "إن الله مع الصابرون" }, state: "آية منقولة بخطأ", verse: { ...verse.verse!, text: "إِنَّ اللَّهَ مَعَ الصَّابِرِينَ", wording: { exact: false, distance: 1, diffs: [{ op: "replaced" as const, typed: "الصابرون", correct: "الصابرين" }] } } } as unknown as ClaimResult;
    expect(buildShareText([r], "ur").split("\n").slice(2, 7)).toEqual([
      "«إن الله مع الصابرون»",
      "🟠 *آیت غلط نقل ہوئی*",
      "«الصابرون» لکھا ہے، درست «الصابرين» ہے",
      "مصحفِ حفص کا متن: إِنَّ اللَّهَ مَعَ الصَّابِرِينَ",
      "ماخذ: سورہ البقرة، آیت 153",
    ]);
  });

  it("gives a question by its topic, never by the person's own words, as the screen does", () => {
    const q = { claim: { ...claim, kind: "question" as const, scope: "personal" as const, textAsWritten: "میں نے روزے میں دوا لی", topic: "تناول الدواء في الصيام" }, state: "فتوى أو حالة شخصية — إحالة", basis: "none", notes: [] } as unknown as ClaimResult;
    const text = buildShareText([q], "ur");
    expect(text).toContain("«تناول الدواء في الصيام»");
    expect(text).not.toContain("دوا لی");
  });
});

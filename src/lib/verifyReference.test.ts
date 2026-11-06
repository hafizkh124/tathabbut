import { describe, expect, it, vi } from "vitest";
import type { Claim } from "./claims";
import type { DorarResult } from "./dorar";
import type { NumberedHadith } from "./hadithReference";
import type { VerseHit } from "./quranCheck";
import { STATES, verifyClaim, type VerifyDeps } from "./verify";

const claim = (over: Partial<Claim>): Claim => ({
  kind: "hadith",
  textAsWritten: "x",
  spanCheck: "exact",
  arabicSpan: null,
  query: "x",
  queryIsTranslation: false,
  language: "ur",
  attributedTo: null,
  citedSource: null,
  warnings: [],
  ...over,
});

const verse = (surah: number, ayah: number, text: string, clean: string): VerseHit => ({ surah, ayah, surah_name_ar: "سورة", text_uthmani: text, text_clean: clean, score: 1 });
const v259 = verse(2, 259, "أَوْ كَالَّذِي مَرَّ عَلَىٰ قَرْيَةٍ وَهِيَ خَاوِيَةٌ عَلَىٰ عُرُوشِهَا", "او كالذي مر علي قريه وهي خاويه علي عروشها");
const v18 = verse(18, 18, "وَتَحْسَبُهُمْ أَيْقَاظًا وَهُمْ رُقُودٌ", "وتحسبهم ايقاظا وهم رقود");

const NIYYAT: DorarResult = { rank: 1, matn: "إنما الأعمال بالنيات وإنما لكل امرئ ما نوى", source: "صحيح البخاري", reference: "1", muhaddith: "البخاري", rawi: "عمر", verdict: "[صحيح]" };
const NIYYAT_HADITH = "حَدَّثَنَا الْحُمَيْدِيُّ عَبْدُ اللَّهِ بْنُ الزُّبَيْرِ قَالَ حَدَّثَنَا سُفْيَانُ عَنْ يَحْيَى عَنْ مُحَمَّدِ بْنِ إِبْرَاهِيمَ سَمِعْتُ عَلْقَمَةَ بْنَ وَقَّاصٍ يَقُولُ سَمِعْتُ عُمَرَ بْنَ الْخَطَّابِ يَقُولُ سَمِعْتُ رَسُولَ اللَّهِ صلى الله عليه وسلم يَقُولُ إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى";

function deps(over: Partial<VerifyDeps> = {}): VerifyDeps {
  return {
    matchVerses: vi.fn(async () => []),
    matchSayings: vi.fn(async () => []),
    lookupDorar: vi.fn(async () => ({ ok: true as const, results: [], origin: "live" as const })),
    ...over,
  };
}
const numbered = (text: string, over: Partial<NumberedHadith> = {}): NumberedHadith => ({ book: "bukhari", number: 1, numbering: "standard", text, ...over });

describe("a verse named by its number", () => {
  it("a number alone gives the verse, with no search by text", async () => {
    const d = deps({ verseByReference: vi.fn(async () => [v259]) });
    const r = await verifyClaim(claim({ kind: "quran", textAsWritten: "البقرة: ٢٥٩", query: "البقرة: ٢٥٩" }), d);
    expect(d.verseByReference).toHaveBeenCalledWith(2, 259, 259);
    expect(r).toMatchObject({ basis: "quran", state: STATES.verseOk, verse: { surah: 2, ayah: 259 } });
    expect(d.matchVerses).not.toHaveBeenCalled();
  });
  it("a quoted text that is the verse at that number is compared with it", async () => {
    const quoted = "او كالذي مر على قرية وهي خاوية على عروشها";
    const d = deps({ verseByReference: vi.fn(async () => [v259]) });
    const r = await verifyClaim(claim({ kind: "quran", textAsWritten: `${quoted} (البقرة: 259)`, arabicSpan: quoted, query: quoted, language: "ar" }), d);
    expect(r.basis).toBe("quran");
    expect(r.verse?.ayah).toBe(259);
    expect(r.state).not.toBe(STATES.notFound);
  });
  it("a text that is not the verse at that number goes the usual way, and says so", async () => {
    const d = deps({ verseByReference: vi.fn(async () => [v18]) });
    const quoted = "ان الله مع الصابرين";
    const r = await verifyClaim(claim({ kind: "quran", textAsWritten: `${quoted} (الكهف: 18)`, arabicSpan: quoted, query: quoted, language: "ar" }), d);
    expect(d.matchVerses).toHaveBeenCalled(); // the usual way
    expect(r.notes.join(" ")).toContain("لا يطابق الآية 18:18");
  });
  it("a number that gives no verse goes the usual way", async () => {
    const d = deps({ verseByReference: vi.fn(async () => []) });
    const r = await verifyClaim(claim({ kind: "quran", textAsWritten: "البقرة: ٢٥٩", query: "البقرة: ٢٥٩" }), d);
    expect(r.state).toBe(STATES.notFound);
    expect(r.notes.join(" ")).toContain("2:259");
  });
  it("is not used when the dependency is missing", async () => {
    const r = await verifyClaim(claim({ kind: "quran", textAsWritten: "البقرة: ٢٥٩", query: "x" }), deps());
    expect(r.state).toBe(STATES.notFound);
  });
});

describe("a hadith named by its book and number", () => {
  it("a number alone: the text found there is searched in Dorar and shown first", async () => {
    const d = deps({
      hadithByReference: vi.fn(async () => [numbered(NIYYAT_HADITH)]),
      lookupDorar: vi.fn(async () => ({ ok: true as const, results: [NIYYAT], origin: "live" as const })),
    });
    const r = await verifyClaim(claim({ textAsWritten: "Sahih Bukhari#1", query: "Sahih Bukhari#1" }), d);
    expect(d.hadithByReference).toHaveBeenCalledWith(expect.objectContaining({ book: "bukhari", number: 1 }));
    expect(r.basis).toBe("dorar");
    expect(r.state).toBe("مقبول");
    expect(r.reference).toMatchObject({ book: "صحيح البخاري", number: 1 });
    expect(r.dorar?.cited).toMatchObject({ book: "صحيح البخاري 1", known: true });
    expect(r.claim.queryIsTranslation).toBe(true);
  });
  it("the text found where Dorar has no verdict on it: not found, with the text and its reason", async () => {
    const d = deps({ hadithByReference: vi.fn(async () => [numbered(NIYYAT_HADITH)]) });
    const r = await verifyClaim(claim({ textAsWritten: "Sahih Bukhari#1", query: "Sahih Bukhari#1" }), d);
    expect(r.state).toBe(STATES.notFound);
    expect(r.reason).toBe("reference-no-grade");
    expect(r.reference?.text).toContain("إِنَّمَا الْأَعْمَالُ");
  });
  it("a number that gives no text, and no text to search: not found for that reason", async () => {
    const d = deps({ hadithByReference: vi.fn(async () => []) });
    const r = await verifyClaim(claim({ textAsWritten: "مشکوٰۃ المصابیح حدیث نمبر 911 صحیح بخاری 99999", query: "x" }), d);
    expect(r.state).toBe(STATES.notFound);
    expect(r.reason).toBe("reference");
  });
  it("the post's own text that is the hadith at the number: the usual check, with that book first", async () => {
    const d = deps({
      hadithByReference: vi.fn(async () => [numbered(NIYYAT_HADITH)]),
      lookupDorar: vi.fn(async () => ({ ok: true as const, results: [NIYYAT], origin: "live" as const })),
    });
    const text = "إنما الأعمال بالنيات وإنما لكل امرئ ما نوى (صحیح بخاری 1)";
    const own = "إنما الأعمال بالنيات وإنما لكل امرئ ما نوى";
    const r = await verifyClaim(claim({ textAsWritten: text, arabicSpan: own, query: own, language: "ar" }), d);
    expect(r.state).toBe("مقبول");
    expect(r.dorar?.cited?.book).toBe("صحيح البخاري 1");
    expect(r.notes.join(" ")).toContain("موافق للحديث");
  });
  it("the post's own text that is another hadith than the one at the number: the usual way, with a note", async () => {
    const d = deps({
      hadithByReference: vi.fn(async () => [numbered("حدثنا آدم قال حدثنا شعبة سمعت ابا جحيفة يقول خرج علينا رسول الله بالهاجرة فاتي بوضوء فتوضا فجعل الناس ياخذون من فضل وضوئه")]),
      lookupDorar: vi.fn(async () => ({ ok: true as const, results: [NIYYAT], origin: "live" as const })),
    });
    const own = "إنما الأعمال بالنيات وإنما لكل امرئ ما نوى";
    const r = await verifyClaim(claim({ textAsWritten: `${own} (صحیح بخاری 187)`, arabicSpan: own, query: own, language: "ar" }), d);
    expect(r.state).toBe("مقبول"); // found by its own words, as before
    expect(r.notes.join(" ")).toContain("لا يوافق الحديث");
  });
});

describe("why a claim was not found", () => {
  it("a text with no Arabic to search", async () => {
    const r = await verifyClaim(claim({ textAsWritten: "جو شخص یہ پیغام آگے بھیجے گا", query: "جو شخص یہ پیغام آگے بھیجے گا" }), deps());
    expect(r).toMatchObject({ state: STATES.notFound, reason: "no-arabic" });
  });
  it("a question", async () => {
    const r = await verifyClaim(claim({ kind: "other", textAsWritten: "سيدنا معاويه كے بارے احاديث؟", query: "x" }), deps());
    expect(r.reason).toBe("question");
    const r2 = await verifyClaim(claim({ kind: "hadith", textAsWritten: "هل يوجد احاديث تؤيد الحديث المذكور", arabicSpan: "هل يوجد احاديث تؤيد الحديث المذكور", query: "هل يوجد احاديث تؤيد الحديث المذكور", language: "ar" }), deps());
    expect(r2.reason).toBe("question");
  });
  it("a saying with no attribution", async () => {
    const t = "الصبر مفتاح النجاح في الحياة";
    const r = await verifyClaim(claim({ kind: "other", textAsWritten: t, arabicSpan: t, query: t, language: "ar" }), deps());
    expect(r).toMatchObject({ state: STATES.notFound, reason: "unattributed" });
  });
  it("a hadith that Dorar does not have has no special reason", async () => {
    const t = "من قال كذا وكذا دخل الجنة بغير حساب";
    const r = await verifyClaim(claim({ textAsWritten: t, arabicSpan: t, query: t, language: "ar" }), deps());
    expect(r.state).toBe(STATES.notFound);
    expect(r.reason).toBeUndefined();
    expect(r.diag).toMatchObject({ candidates: 0, relevant: 0 });
  });
});

describe("a second look at a text that found nothing", () => {
  it("a word with a typing slip still finds the narration, and says so", async () => {
    const d = deps({ lookupDorar: vi.fn(async () => ({ ok: true as const, results: [NIYYAT], origin: "live" as const })) });
    const t = "انما الاعمال باانيات";
    const r = await verifyClaim(claim({ textAsWritten: t, arabicSpan: t, query: t, language: "ar" }), d);
    expect(r.state).toBe("مقبول");
    expect(r.diag?.retried).toBe("typos");
    expect(r.notes.join(" ")).toContain("أخطاء إملائية");
  });
  it("a different hadith is never taken for a typo", async () => {
    const d = deps({ lookupDorar: vi.fn(async () => ({ ok: true as const, results: [NIYYAT], origin: "live" as const })) });
    const t = "من كذب علي متعمدا فليتبوا مقعده";
    const r = await verifyClaim(claim({ textAsWritten: t, arabicSpan: t, query: t, language: "ar" }), d);
    expect(r.state).toBe(STATES.notFound);
  });
  it("a long text is searched again by its opening, the whole text still having to be in the narration", async () => {
    const full = "اللهم اني اعوذ بك من الهم والحزن والعجز والكسل والبخل والجبن وضلع الدين وغلبة الرجال";
    const narration: DorarResult = { rank: 1, matn: `كان النبي صلى الله عليه وسلم يقول ${full}`, source: "صحيح البخاري", reference: "6369", muhaddith: "البخاري", verdict: "[صحيح]" };
    const lookup = vi.fn(async (q: string) => ({ ok: true as const, results: q.split(" ").length <= 8 ? [narration] : [], origin: "live" as const }));
    const r = await verifyClaim(claim({ textAsWritten: full, arabicSpan: full, query: full, language: "ar" }), deps({ lookupDorar: lookup }));
    expect(lookup).toHaveBeenCalledTimes(2);
    expect(r.state).toBe("مقبول");
    expect(r.diag?.retried).toBe("opening");
  });
});

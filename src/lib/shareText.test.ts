import { describe, expect, it } from "vitest";
import type { ClaimResult } from "./clientTypes";
import { buildShareText, sourceLine } from "./shareText";

/** The shared text without the right-to-left marks, so the tests read the visible lines. */
const build = (...args: Parameters<typeof buildShareText>) => buildShareText(...args).replaceAll("‏", "");

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
    const text = build([r], "ur");
    expect(text).toContain("«الجنة تحت أقدام الأمهات»");
    expect(text).not.toContain(matn);
    expect(text).not.toContain("اس روایت میں اضافی الفاظ ہیں");
  });
  it("uses the approved no-reference message without manufacturing a hadith grade", () => {
    const r = { claim, state: "لم يُعثر عليه — إحالة", basis: "none", notes: [] } as ClaimResult;
    const text = build([r], "ur");
    expect(text).toContain("اس عبارت کا معتبر حوالہ نہیں ملا — اہلِ علم سے رجوع کریں");
    expect(text).not.toContain("شدید ضعیف");
  });
  it("leaves the narrator-criticism note to the app and keeps the scholar with the source", () => {
    const verdict = "[فيه] حسين بن عبد الله متروك الحديث";
    const r = { ...hadith, dorar: { ...hadith.dorar!, narrations: [{ ...hadith.dorar!.narrations[0], verdict, muhaddith: "ابن حبان", scope: "narrator" as const }] } };
    const text = build([r], "ur");
    expect(text).toContain("ماخذ: السلسلة الضعيفة، 416");
    expect(text).toContain("محدث: ابن حبان");
    expect(text).not.toContain("یہ اس سند کے راوی کی جرح ہے");
  });
  it("shows the retrieved Arabic for a translated claim without verifying its wording", () => {
    const r = { ...hadith, claim: { ...claim, language: "ur" as const, arabicSpan: null, queryIsTranslation: true, textAsWritten: "تم میں سے بہترین وہ ہے جو قرآن سیکھے اور سکھائے", query: "a reconstructed search" }, dorar: { ...hadith.dorar!, narrations: [{ ...hadith.dorar!.narrations[0], matn: "خيركم من تعلم القرآن وعلمه" }] } };
    const text = build([r], "ur");
    expect(text).toContain("اس ترجمہ شدہ عبارت سے ملنے والا عربی متن: خيركم من تعلم القرآن وعلمه");
    expect(text).toContain("ہر لفظ کی تصدیق مراد نہیں");
    expect(text).not.toContain("a reconstructed search");
    expect(build([{ ...r, claim: { ...r.claim, queryIsTranslation: false } }], "ur")).not.toContain("اس ترجمہ شدہ عبارت سے ملنے والا عربی متن");
  });
  it("leaves the halik chain note to the app (specialist, 2026-10-06)", () => {
    const r = { ...hadith, dorar: { ...hadith.dorar!, narrations: [{ ...hadith.dorar!.narrations[0], verdict: "إسناده هالك", scope: "isnad" as const }] } };
    expect(build([r], "ur")).not.toContain("شدید ضعف کا یہ حکم اسی سند کے بارے میں ہے۔");
  });
  it("gives a Sahihayn hadith one line with the imam, the book and the number, and no grading or source lines", () => {
    for (const [source, muhaddith, name] of [["صحيح البخاري", "البخاري", "بخاری"], ["صحيح مسلم", "مسلم", "مسلم"]]) {
      const r = { ...hadith, dorar: { ...hadith.dorar!, narrations: [{ ...hadith.dorar!.narrations[0], source, muhaddith, reference: "41", verdict: "[صحيح]" }] } };
      const text = build([r], "ur");
      expect(text).toContain(`امام ${name} نے اپنی صحیح میں روایت کیا ہے، 41۔`);
      expect(text).not.toContain("حکم:");
      expect(text).not.toContain("ماخذ:");
    }
    const ar = { ...hadith, state: "مقبول", dorar: { ...hadith.dorar!, narrations: [{ source: "صحيح مسلم", muhaddith: "مسلم", reference: "41", verdict: "[صحيح]", matn: "x" }] } } as unknown as ClaimResult;
    expect(build([ar], "ar").split("\n").slice(2, 4)).toEqual(["«اطلبوا العلم ولو بالصين»", "🟢 *أخرجه الإمام مسلم في صحيحه، 41.*"]);
  });

  it("never puts a Dorar link in the shared text", () => {
    const r = { ...hadith, dorar: { ...hadith.dorar!, narrations: [{ ...hadith.dorar!.narrations[0], matn: "x" }], externalUrls: { dorar: "https://dorar.net/hadith/search?q=x" } } } as unknown as ClaimResult;
    expect(build([r], "ar")).not.toContain("dorar.net");
  });
  it("shares the context warning together with the full verse", () => {
    const r = { ...verse, state: "آية اقتطع سياقها", verse: { ...verse.verse!, text: "لا تقربوا الصلاة وأنتم سكارى", wording: { exact: true, contextOmitted: true as const, correctText: "لا تقربوا الصلاة", distance: 0, diffs: [] } } };
    const text = build([r], "ur");
    expect(text).toContain("آیت کا سیاق حذف ہوا ہے");
    expect(text).toContain("وأنتم سكارى");
  });
  it("tells the reader of a shared personal case to ask a mufti", () => {
    const r = { ...hadith, claim: { ...claim, kind: "question" as const, scope: "personal" as const } };
    expect(build([r], "ur")).toContain("اپنے معتمد دار الافتاء یا مفتی سے رجوع کریں۔");
  });
  it("names the book and page for a hadith, and the surah and verse for the Quran", () => {
    expect(sourceLine(hadith, "ar")).toBe("السلسلة الضعيفة، 416");
    expect(sourceLine(verse, "ar")).toBe("سورة البقرة، الآية 153");
    expect(sourceLine(verse, "en")).toBe("Surah البقرة, verse 153");
    expect(sourceLine(verse, "ur")).toBe("سورہ البقرة، آیت 153");
  });

  it("writes the claim, its result in the user's language and the source", () => {
    const text = build([hadith], "en");
    expect(text).toContain("«اطلبوا العلم ولو بالصين»");
    expect(text).toContain("Weak");
    expect(text).toContain("السلسلة الضعيفة، 416");
  });

  it("ends with the link to the results themselves when each has one, else the app's address", () => {
    const a = { ...verse, shareId: "abcDEF123456" } as ClaimResult;
    const b = { ...verse, shareId: "xyzXYZ987654" } as ClaimResult;
    expect(build([a, b], "ar").trim().endsWith("https://tathabbut.alulama.org/r/abcDEF123456-xyzXYZ987654")).toBe(true);
    expect(build([a, verse], "ar").trim().endsWith("https://tathabbut.alulama.org")).toBe(true);
  });

  it("puts no source link in the shared text, only the app's address at the end (specialist, 2026-10-06)", () => {
    const text = build([verse], "ar");
    expect(text).not.toContain("quranpedia");
    expect(text.trim().endsWith("لمزيد من التحقق:\nhttps://tathabbut.alulama.org")).toBe(true);
  });

  it("keeps a list entry's web address out of the shared text", () => {
    const r = { claim, state: "قول منسوب خطأً إلى عالم", basis: "specialist-list", notes: [], saying: { reference: "موقع العلماء، 2023، https://alulama.org/x/", externalUrls: { dorar: "https://dorar.net/hadith/search?q=x" } } } as unknown as ClaimResult;
    const text = build([r], "ar");
    expect(text).toContain("المصدر: موقع العلماء، 2023");
    expect(text).not.toContain("alulama.org/x");
    expect(text).not.toContain("dorar.net");
  });

  it("separates several claims", () => {
    // the platform's name, two claims, the link
    expect(build([hadith, verse], "ar").split("\n\n").length).toBe(4);
  });

  it("opens with the platform's name, numbers several claims and marks each result with its badge's colour (2026-10-19)", () => {
    const text = build([hadith, verse], "ur");
    expect(text.startsWith("*تثبت پلیٹ فارم*\n\n")).toBe(true);
    expect(text).not.toContain("العلماء");
    expect(text).toContain("*1.* «اطلبوا العلم ولو بالصين»\n🟡 *");
    expect(text).toContain("*2.* «إن الله مع الصابرين»\n🟢 *");
    expect(build([hadith], "ur").startsWith("*تثبت پلیٹ فارم*\n\n«اطلبوا")).toBe(true);
    expect(text.endsWith("مزید تحقیق کے لیے:\nhttps://tathabbut.alulama.org")).toBe(true);
  });

  it("gives a misquoted verse as written, the mistake, the mushaf's wording, then its place (2026-10-19)", () => {
    const r = { ...verse, claim: { ...verse.claim, arabicSpan: "إن الله مع الصابرون" }, state: "آية منقولة بخطأ", verse: { ...verse.verse!, text: "إِنَّ اللَّهَ مَعَ الصَّابِرِينَ", wording: { exact: false, distance: 1, diffs: [{ op: "replaced" as const, typed: "الصابرون", correct: "الصابرين" }] } } } as unknown as ClaimResult;
    expect(build([r], "ur").split("\n").slice(2, 7)).toEqual([
      "«إن الله مع الصابرون»",
      "🟠 *آیت غلط نقل ہوئی*",
      "«الصابرون» لکھا ہے، درست «الصابرين» ہے",
      "مصحفِ حفص کا متن: إِنَّ اللَّهَ مَعَ الصَّابِرِينَ",
      "ماخذ: سورہ البقرة، آیت 153",
    ]);
  });

  it("gives a question by its topic, never by the person's own words, as the screen does", () => {
    const q = { claim: { ...claim, kind: "question" as const, scope: "personal" as const, textAsWritten: "میں نے روزے میں دوا لی", topic: "تناول الدواء في الصيام" }, state: "فتوى أو حالة شخصية — إحالة", basis: "none", notes: [] } as unknown as ClaimResult;
    const text = build([q], "ur").replace(/[⁦-⁩]/g, ""); // the isolates around a topic are invisible marks
    expect(text).toContain("«تناول الدواء في الصيام»");
    expect(text).not.toContain("دوا لی");
  });

  describe("the book a post names (2026-10-19)", () => {
    const muslim = { source: "صحيح مسلم", reference: "780", muhaddith: "مسلم", verdict: "[صحيح]", matn: "لا تجعلوا بيوتكم مقابر", grade: "مقبول" };
    const hakim = { source: "المستدرك على الصحيحين", reference: "2062", muhaddith: "الحاكم", verdict: "صحيح على شرط مسلم", matn: "اقرؤوا سورة البقرة في بيوتكم", grade: "مقبول", display: { grade: "مقبول", label: "مقبول (صحيح أو حسن)", caution: false } };
    const base = { ...hadith, state: "مقبول", dorar: { narrations: [muslim, hakim], summary: {}, externalUrls: {} } } as unknown as ClaimResult;

    it("puts the cited book's narration under the state, then the Sahih line", () => {
      const r = { ...base, dorar: { ...base.dorar!, cited: { book: "مستدرک حاکم", known: true, narration: hakim } } } as unknown as ClaimResult;
      expect(build([r], "ar").split("\n").slice(2, 6)).toEqual([
        "«اطلبوا العلم ولو بالصين»",
        "🟢 *مقبول (صحيح أو حسن)*",
        "ذُكر في الرسالة: المستدرك على الصحيحين، 2062 — الحاكم: مقبول (صحيح أو حسن)",
        "أخرجه الإمام مسلم في صحيحه، 780.",
      ]);
    });
    it("changes nothing when the cited book's narration is the first one", () => {
      const r = { ...base, dorar: { ...base.dorar!, cited: { book: "صحيح مسلم", known: true, narration: muslim } } } as unknown as ClaimResult;
      expect(build([r], "ar")).toBe(build([base], "ar"));
    });
    it("says when the book named is not among the results", () => {
      const r = { ...base, dorar: { ...base.dorar!, cited: { book: "سنن الترمذي", known: true } } } as unknown as ClaimResult;
      expect(build([r], "ur")).toContain("پیغام میں مذکور: سنن الترمذي — الدرر کے نتائج میں اس کی روایت نہیں ملی");
    });
    it("lists the narrations the person chose, one per line", () => {
      const text = build([base], "ar", { narrations: [hakim, muslim] } as never);
      expect(text).toContain("🟢 *مقبول (صحيح أو حسن)*\n• المستدرك على الصحيحين، 2062 — الحاكم: مقبول (صحيح أو حسن)\n• صحيح مسلم، 780 — أخرجه الإمام مسلم في صحيحه.");
      expect(text).not.toContain("المصدر:");
    });
  });

  it("starts the lines that open with an emoji, a bullet or a number with a right-to-left mark in Arabic and Urdu, not in English (2026-10-19)", () => {
    const ur = buildShareText([hadith, verse], "ur");
    expect(ur).toContain("‏🟡 *");
    expect(ur).toContain("‏*1.* «");
    expect(buildShareText([hadith, verse], "en")).not.toContain("‏");
  });
});

describe("a general fiqh question, in full (2026-10-20)", () => {
  const fiqh = {
    claim: { kind: "question", scope: "general", textAsWritten: "نیٹ ورک مارکیٹنگ کیسا ہے؟", topic: "التسويق الشبكي", topicUr: "نیٹ ورک مارکیٹنگ", topicEn: "network marketing", language: "ur", warnings: [] },
    state: "مسألة فقهية",
    basis: "kind",
    notes: [],
    turath: { status: "success", references: [{ excerpt: "التسويق الشبكي من الغرر والميسر وهو محرم عند أكثر أهل العلم", citation: "c", book: { id: "1", title: "فتاوى د حسام عفانة" }, author: { name: "حسام الدين عفانة" }, bookId: "1", pageLocator: { printedPage: 12, volume: "3" }, url: "u" }] },
    alulama: { status: "found", kind: "fatwa", hits: [{ id: 1, kind: "fatwa", number: 5, title: "نیٹ ورک مارکیٹنگ کا شرعی حکم", answer_snippet: "کمیشن صرف اپنی فروخت پر ہو تو جائز ہے۔", answerers: ["فضیلۃ الشیخ عبد الوکیل ناصر حفظہ اللہ"], link: "https://alulama.org/nm/", published: null, score: 0.9 }] },
  } as unknown as ClaimResult;
  const plain = (s: string) => s.replace(/[⁦-⁩‎‏]/g, "");

  it("shows the topic in the language of the text, with the Arabic the books were asked in beside it", () => {
    expect(plain(build([fiqh], "ur"))).toContain("«نیٹ ورک مارکیٹنگ» (التسويق الشبكي)");
    expect(plain(build([fiqh], "en"))).toContain("«network marketing» (التسويق الشبكي)");
    expect(plain(build([fiqh], "ar"))).toContain("«التسويق الشبكي»");
  });

  it("carries العلماء' answer (title, opening, shaikh, link) and the books (book, author, volume and page, the passage's start)", () => {
    const t = plain(build([fiqh], "ur"));
    expect(t).toContain("• نیٹ ورک مارکیٹنگ کا شرعی حکم");
    expect(t).toContain("کمیشن صرف اپنی فروخت پر ہو تو جائز ہے۔");
    expect(t).toContain("— فضیلۃ الشیخ عبد الوکیل ناصر حفظہ اللہ");
    expect(t).toContain("https://alulama.org/nm/");
    expect(t).toContain("• فتاوى د حسام عفانة (حسام الدين عفانة، ج 3، ص 12)");
    expect(t).toContain("«التسويق الشبكي من الغرر والميسر");
    expect(t).toContain("العلماء کا جواب ہے، تثبت کا حکم نہیں");
  });

  it("marks each line by its own script, so an English text with an Urdu answer lays out right (RLM / LRM)", () => {
    const lines = buildShareText([fiqh], "en").split("\n");
    expect(lines.find((l) => l.includes("Al-Ulama (alulama.org)"))?.startsWith("‎")).toBe(true);
    expect(lines.find((l) => l.includes("کمیشن صرف"))?.startsWith("‏")).toBe(true);
    expect(lines.find((l) => l.includes("https://alulama.org/nm/"))?.startsWith("‎")).toBe(true);
  });

  it("is fully in each language's labels", () => {
    expect(build([fiqh], "en")).toContain("From the books of fiqh and fatwa");
    expect(build([fiqh], "en")).toContain("vol. 3, p. 12");
    expect(build([fiqh], "ar")).toContain("من كتب الفقه والفتاوى");
  });

  it("gives a personal case no ruling, only the referral and the way to ask العلماء", () => {
    const personal = { ...fiqh, claim: { ...fiqh.claim, scope: "personal" }, state: "فتوى أو حالة شخصية — إحالة", turath: undefined, alulama: undefined } as unknown as ClaimResult;
    const t = build([personal], "ur");
    expect(t).toContain("https://alulama.org/ulama-rabeta-urdu/");
    expect(t).not.toContain("alulama.org/nm");
  });

  it("sends only what the person chose of the answers and passages", () => {
    const two = { ...fiqh, alulama: { status: "found", kind: "fatwa", hits: [(fiqh as never as { alulama: { hits: unknown[] } }).alulama.hits[0], { id: 2, kind: "fatwa", number: 6, title: "دوسرا فتویٰ", answer_snippet: "دوسرا جواب", answerers: [], link: "https://alulama.org/two/", published: null, score: 0.8 }] } } as unknown as ClaimResult;
    const onlySecond = plain(buildShareText([two], "ur", { fiqhPick: { alulama: [1], books: [] } }));
    expect(onlySecond).toContain("https://alulama.org/two/");
    expect(onlySecond).not.toContain("https://alulama.org/nm/");
    expect(onlySecond).not.toContain("فتاوى د حسام عفانة");
    const booksOnly = plain(buildShareText([two], "ur", { fiqhPick: { alulama: [], books: [0] } }));
    expect(booksOnly).not.toContain("العلماء (alulama.org)");
    expect(booksOnly).toContain("فتاوى د حسام عفانة");
  });

  it("uses the translation of an answer the reader has already seen, labelled as a machine's", async () => {
    const { fetchAnswerTranslation, forgetTranslations } = await import("./translateClient");
    forgetTranslations();
    const signed = { ...fiqh, alulama: { status: "found", kind: "fatwa", hits: [{ id: 1, kind: "fatwa", number: 5, title: "نیٹ ورک مارکیٹنگ کا شرعی حکم", answer_snippet: "کمیشن صرف اپنی فروخت پر ہو تو جائز ہے۔", answerers: [], link: "https://alulama.org/nm/", published: null, score: 0.9, sig: "s".repeat(64) }] } } as unknown as ClaimResult;
    expect(plain(buildShareText([signed], "en"))).toContain("نیٹ ورک مارکیٹنگ کا شرعی حکم");
    const f = (async () => new Response(JSON.stringify({ translation: "Network marketing: the ruling\n\nPermissible if the commission is only on one's own sales." }))) as typeof fetch;
    await fetchAnswerTranslation("t", "s".repeat(64), "en", f);
    const text = plain(buildShareText([signed], "en"));
    expect(text).toContain("Network marketing: the ruling");
    expect(text).toContain("Permissible if the commission");
    expect(text).toContain("(machine translation from Urdu)");
    expect(text).not.toContain("کمیشن صرف");
    forgetTranslations();
  });
});

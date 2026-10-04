import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Claim } from "./claims";
import { parseDorarHtml } from "./dorar";
import type { VerseHit } from "./quranCheck";
import { STATES, verifyClaim, verifyClaims, type SayingHit, type VerifyDeps } from "./verify";

const dorarTalab = parseDorarHtml(readFileSync(join(__dirname, "__fixtures__", "dorar_talab_al_ilm.html"), "utf-8"));

const claim = (over: Partial<Claim>): Claim => ({
  kind: "hadith",
  textAsWritten: "x",
  spanCheck: "exact",
  arabicSpan: null,
  query: "x",
  queryIsTranslation: false,
  language: "ar",
  attributedTo: null,
  citedSource: null,
  warnings: [],
  ...over,
});
const arabic = (kind: Claim["kind"], text: string): Claim => claim({ kind, textAsWritten: text, arabicSpan: text, query: text });

const v2_153: VerseHit = {
  surah: 2,
  ayah: 153,
  surah_name_ar: "سورة البقرة",
  text_uthmani: "يَا أَيُّهَا الَّذِينَ آمَنُوا اسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ ۚ إِنَّ اللَّهَ مَعَ الصَّابِرِينَ",
  text_clean: "يا ايها الذين امنوا استعينوا بالصبر والصلاه ان الله مع الصابرين",
  score: 0.8,
};
const saying = (over: Partial<SayingHit>): SayingHit => ({
  id: 1, text_ar: "لولاك لما خلقت الأفلاك", status: "شديد الضعف أو لا أصل له", verdict: "موضوع", verdict_by: "الصغاني",
  reference: "الموضوعات للصغاني، 52", correct_text: null, note: null, claimed_attribution: null, claimed_reference: null, score: 0.9, ...over,
});

function deps(over: Partial<VerifyDeps> = {}): VerifyDeps {
  return {
    matchVerses: vi.fn(async () => []),
    matchSayings: vi.fn(async () => []),
    lookupDorar: vi.fn(async () => ({ ok: true as const, results: [], origin: "live" as const })),
    ...over,
  };
}

describe("verifyClaim — routing and authority", () => {
  it("a question goes to the scholars, without any search", async () => {
    const d = deps();
    const r = await verifyClaim(claim({ kind: "question", query: "کیا طلاق ہو گئی" }), d);
    expect(r.state).toBe(STATES.fatwa);
    expect(d.matchSayings).not.toHaveBeenCalled();
    expect(d.lookupDorar).not.toHaveBeenCalled();
  });

  it("the specialist's list comes first and Dorar is not asked", async () => {
    const d = deps({ matchSayings: vi.fn(async () => [saying({})]) });
    const r = await verifyClaim(arabic("hadith", "لولاك لما خلقت الأفلاك"), d);
    expect(r).toMatchObject({ state: "شديد الضعف أو لا أصل له", basis: "specialist-list", saying: { verdict_by: "الصغاني" } });
    expect(d.lookupDorar).not.toHaveBeenCalled();
  });

  it("a weak match in the list is not used", async () => {
    const d = deps({ matchSayings: vi.fn(async () => [saying({ score: 0.4 })]) });
    const r = await verifyClaim(arabic("hadith", "لولاك لما خلقت الأفلاك"), d);
    expect(r.basis).not.toBe("specialist-list");
  });

  it("a scholar's misattributed quote comes from the list, with what is being circulated", async () => {
    const s = saying({ status: "قول منسوب خطأً إلى عالم", claimed_attribution: "ابن تيمية", claimed_reference: "مجموع الفتاوى 7/493", correct_text: "مصطفى السباعي، هكذا علمتني الحياة، ص 84" });
    const r = await verifyClaim(arabic("scholar_quote", "ما رأيت شيئا يغذي العقل والروح"), deps({ matchSayings: vi.fn(async () => [s]) }));
    expect(r).toMatchObject({ state: "قول منسوب خطأً إلى عالم", saying: { correct_text: expect.stringContaining("السباعي") } });
  });

  it("a scholar's quote that is not in the list is looked up in Dorar, which records the sayings of many scholars", async () => {
    const d = deps({ lookupDorar: vi.fn(async () => ({ ok: true as const, results: dorarTalab, origin: "live" as const })) });
    const r = await verifyClaim(arabic("scholar_quote", "اطلبوا العلم ولو بالصين"), d);
    expect(d.lookupDorar).toHaveBeenCalled();
    expect(r.basis).toBe("dorar");
    expect(r.dorar?.narrations.length).toBeGreaterThan(0);
  });

  it("a scholar's quote found nowhere is referred", async () => {
    const r = await verifyClaim(arabic("scholar_quote", "قول لا نعرفه عن عالم"), deps());
    expect(r.state).toBe(STATES.notFound);
  });
});

describe("verifyClaim — Quran", () => {
  it("a misquoted verse is reported with the verse and the changed word (T027)", async () => {
    const r = await verifyClaim(arabic("quran", "إن الله مع الصابرون"), deps({ matchVerses: vi.fn(async () => [v2_153]) }));
    expect(r.state).toBe(STATES.verseWrong);
    expect(r.verse).toMatchObject({ surah: 2, ayah: 153 });
    expect(r.verse?.wording?.diffs).toEqual([{ op: "replaced", typed: "الصابرون", correct: "الصَّابِرِينَ" }]);
  });

  it("a correct quotation is confirmed", async () => {
    const r = await verifyClaim(arabic("quran", "إن الله مع الصابرين"), deps({ matchVerses: vi.fn(async () => [v2_153]) }));
    expect(r.state).toBe(STATES.verseOk);
    expect(r.verse?.externalUrls).toEqual({
      quranCom: "https://quran.com/2/153",
      quranpedia: "https://quranpedia.net/quran/2:153",
    });
  });

  it("an Urdu rendering of a verse is shown, never judged for wording", async () => {
    const c = claim({ kind: "quran", language: "ur", query: "إن الله مع الصابرين", queryIsTranslation: true });
    const r = await verifyClaim(c, deps({ matchVerses: vi.fn(async () => [v2_153]) }));
    expect(r.state).toBe(STATES.verseTranslated);
    expect(r.verse?.wording).toBeUndefined();
  });

  it("an Arabic text sent as a hadith that is a verse is treated as the verse", async () => {
    const r = await verifyClaim(arabic("hadith", "إن الله مع الصابرين"), deps({ matchVerses: vi.fn(async () => [{ ...v2_153, score: 0.95 }]) }));
    expect(r.state).toBe(STATES.verseOk);
    expect(r.notes).toContain("النص آية من القرآن وليس حديثا");
  });

  it("a 'verse' far from any verse falls through to Dorar", async () => {
    const d = deps({ matchVerses: vi.fn(async () => [v2_153]) });
    await verifyClaim(arabic("quran", "يا أيها الناس اتقوا ربكم في كل وقت وحين"), d);
    expect(d.lookupDorar).toHaveBeenCalled();
  });
});

describe("verifyClaim — Dorar", () => {
  it("summarizes the narrations of this text graded by the specialist's rules", async () => {
    const r = await verifyClaim(arabic("hadith", "اطلبوا العلم ولو بالصين"), deps({ lookupDorar: vi.fn(async () => ({ ok: true as const, results: dorarTalab, origin: "cache" as const })) }));
    expect(r.basis).toBe("dorar");
    expect(r.state).toBe("شديد الضعف أو لا أصل له");
    expect(r.dorar?.narrations.length).toBeGreaterThan(5);
    expect(r.dorar?.origin).toBe("cache");
    expect(r.dorar?.externalUrls?.dorar).toContain("dorar.net/hadith/search");
    expect(r.dorar?.externalUrls?.shamela).toContain("shamela.ws/search");
  });

  it("is «لم يُعثر عليه» when none of Dorar's 15 results is this text", async () => {
    const r = await verifyClaim(arabic("hadith", "زيتون سماء كلام فرضي لا وجود له"), deps({ lookupDorar: vi.fn(async () => ({ ok: true as const, results: dorarTalab, origin: "live" as const })) }));
    expect(r.state).toBe(STATES.notFound);
  });

  it("is «لم يُعثر عليه», with the reason, when Dorar cannot be reached", async () => {
    const r = await verifyClaim(arabic("hadith", "نص ما"), deps({ lookupDorar: vi.fn(async () => ({ ok: false as const, error: "http", detail: "403" })) }));
    expect(r.state).toBe(STATES.notFound);
    expect(r.notes[0]).toContain("تعذّر");
  });

  it("does not search Dorar with Urdu text (a chain message with no Arabic)", async () => {
    const d = deps();
    const r = await verifyClaim(claim({ kind: "other", language: "ur", query: "یہ پیغام دس لوگوں کو بھیجو" }), d);
    expect(r.state).toBe(STATES.notFound);
    expect(d.lookupDorar).not.toHaveBeenCalled();
  });
});

describe("verifyClaims", () => {
  it("keeps the order of the claims", async () => {
    const d = deps();
    const r = await verifyClaims([claim({ kind: "question" }), arabic("hadith", "زيتون"), claim({ kind: "question" })], d);
    expect(r.map((x) => x.state)).toEqual([STATES.fatwa, STATES.notFound, STATES.fatwa]);
  });
});

describe("verifyClaim — «هل تقصد؟» candidates", () => {
  const v8_46: VerseHit = {
    surah: 8,
    ayah: 46,
    surah_name_ar: "سورة الأنفال",
    text_uthmani: "وَأَطِيعُوا اللَّهَ وَرَسُولَهُ وَلَا تَنَازَعُوا فَتَفْشَلُوا وَتَذْهَبَ رِيحُكُمْ ۖ وَاصْبِرُوا ۚ إِنَّ اللَّهَ مَعَ الصَّابِرِينَ",
    text_clean: "واطيعوا الله ورسوله ولا تنازعوا فتفشلوا وتذهب ريحكم واصبروا ان الله مع الصابرين",
    score: 0.7,
  };
  const farAway: VerseHit = { surah: 1, ayah: 2, surah_name_ar: "سورة الفاتحة", text_uthmani: "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ", text_clean: "الحمد لله رب العالمين", score: 0.55 };

  it("a phrase found in two verses offers both, the better-scored first", async () => {
    const d = deps({ matchVerses: vi.fn(async () => [v2_153, v8_46]) });
    const r = await verifyClaim(arabic("quran", "إن الله مع الصابرين"), d);
    expect(r.state).toBe(STATES.verseOk);
    expect(r.verse?.ayah).toBe(153);
    expect(r.verse?.candidates?.map((c) => `${c.surah}:${c.ayah}`)).toEqual(["2:153", "8:46"]);
  });

  it("a misquote ranks the verse it is closest to first, and drops verses that are not close", async () => {
    const d = deps({ matchVerses: vi.fn(async () => [farAway, v8_46, v2_153]) });
    const r = await verifyClaim(arabic("quran", "إن الله مع الصابرون"), d);
    expect(r.state).toBe(STATES.verseWrong);
    expect(r.verse?.candidates?.some((c) => c.surah === 1)).toBe(false);
    expect(r.verse?.candidates?.length).toBe(2);
  });

  it("a verse that shares only half the words is not offered next to an exact one", async () => {
    const half: VerseHit = { surah: 2, ayah: 249, surah_name_ar: "سورة البقرة", text_uthmani: "إِنَّ اللَّهَ مُبْتَلِيكُمْ بِنَهَرٍ", text_clean: "ان الله مبتليكم بنهر", score: 0.6 };
    const d = deps({ matchVerses: vi.fn(async () => [v2_153, half]) });
    const r = await verifyClaim(arabic("quran", "إن الله مع الصابرين"), d);
    expect(r.state).toBe(STATES.verseOk);
    expect(r.verse?.candidates).toBeUndefined();
  });

  it("one verse alone has no candidate list", async () => {
    const d = deps({ matchVerses: vi.fn(async () => [v2_153]) });
    const r = await verifyClaim(arabic("quran", "إن الله مع الصابرين"), d);
    expect(r.verse?.candidates).toBeUndefined();
  });
});

describe("verifyClaim — Dorar ranking and prioritization", () => {
  it("isolates weak variants when text is in Sahihayn and ranks Sahihayn first", async () => {
    const d = deps({
      lookupDorar: vi.fn(async () => ({
        ok: true as const,
        origin: "live" as const,
        results: [
          { rank: 1, matn: "من غشنا فليس منا", source: "المعجم الكبير", verdict: "إسناده ضعيف", muhaddith: "الهيثمي" },
          { rank: 2, matn: "من غشنا فليس منا", source: "صحيح مسلم", verdict: "صحيح", muhaddith: "مسلم" },
          { rank: 3, matn: "من غشنا فليس منا", source: "سنن الترمذي", verdict: "حسن صحيح", muhaddith: "الترمذي" },
          { rank: 4, matn: "من غشنا فليس منا", source: "مسند الفردوس", verdict: "موضوع لا أصل له", muhaddith: "ابن الجوزي" },
        ],
      })),
    });

    const r = await verifyClaim(arabic("hadith", "من غشنا فليس منا"), d);
    expect(r.basis).toBe("dorar");
    expect(r.dorar?.narrations[0].source).toBe("صحيح مسلم");
    expect(r.dorar?.narrations.map((n) => n.grade)).toEqual(["مقبول", "مقبول"]);
    expect(r.dorar?.weakVariants).toBeDefined();
    expect(r.dorar?.weakVariants?.map((n) => n.source)).toEqual(["المعجم الكبير", "مسند الفردوس"]);
  });

  it("prioritizes Sheikh Al-Albani when hadith is in Sunan", async () => {
    const d = deps({
      lookupDorar: vi.fn(async () => ({
        ok: true as const,
        origin: "live" as const,
        results: [
          { rank: 1, matn: "الدعاء هو العبادة", source: "سنن أبي داود", verdict: "سكت عنه", muhaddith: "أبو داود" },
          { rank: 2, matn: "الدعاء هو العبادة", source: "سنن أبي داود", verdict: "صحيح", muhaddith: "الألباني" },
        ],
      })),
    });

    const r = await verifyClaim(arabic("hadith", "الدعاء هو العبادة"), d);
    expect(r.dorar?.narrations[0].muhaddith).toBe("الألباني");
  });
});


// A paste of several verses: findVerseRuns (src/lib/quranCheck.ts) and its use in verifyClaims (src/lib/verify.ts).
// Verse texts as stored in quran_verses (quranpedia Hafs, standard spelling).
import { describe, expect, it, vi } from "vitest";
import type { Claim } from "./claims";
import { findVerseRuns, joinVerses, type VerseHit } from "./quranCheck";
import { STATES, verifyClaims, type VerifyDeps } from "./verify";

const V: Record<string, [string, string, string]> = {
  "112:1": ["سورة الإخلاص", "قُلْ هُوَ اللَّهُ أَحَدٌ", "قل هو الله احد"],
  "112:2": ["سورة الإخلاص", "اللَّهُ الصَّمَدُ", "الله الصمد"],
  "112:3": ["سورة الإخلاص", "لَمْ يَلِدْ وَلَمْ يُولَدْ", "لم يلد ولم يولد"],
  "112:4": ["سورة الإخلاص", "وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ", "ولم يكن له كفوا احد"],
  "103:1": ["سورة العصر", "وَالْعَصْرِ", "والعصر"],
  "103:2": ["سورة العصر", "إِنَّ الْإِنْسَانَ لَفِي خُسْرٍ", "ان الانسان لفي خسر"],
  "103:3": ["سورة العصر", "إِلَّا الَّذِينَ آمَنُوا وَعَمِلُوا الصَّالِحَاتِ وَتَوَاصَوْا بِالْحَقِّ وَتَوَاصَوْا بِالصَّبْرِ", "الا الذين امنوا وعملوا الصالحات وتواصوا بالحق وتواصوا بالصبر"],
  "94:5": ["سورة الشرح", "فَإِنَّ مَعَ الْعُسْرِ يُسْرًا", "فان مع العسر يسرا"],
  "94:6": ["سورة الشرح", "إِنَّ مَعَ الْعُسْرِ يُسْرًا", "ان مع العسر يسرا"],
  "55:12": ["سورة الرحمن", "وَالْحَبُّ ذُو الْعَصْفِ وَالرَّيْحَانُ", "والحب ذو العصف والريحان"],
  "55:13": ["سورة الرحمن", "فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ", "فباي الاء ربكما تكذبان"],
  "55:14": ["سورة الرحمن", "خَلَقَ الْإِنْسَانَ مِنْ صَلْصَالٍ كَالْفَخَّارِ", "خلق الانسان من صلصال كالفخار"],
  "55:15": ["سورة الرحمن", "وَخَلَقَ الْجَانَّ مِنْ مَارِجٍ مِنْ نَارٍ", "وخلق الجان من مارج من نار"],
  "55:16": ["سورة الرحمن", "فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ", "فباي الاء ربكما تكذبان"],
  "55:1": ["سورة الرحمن", "الرَّحْمَٰنُ", "الرحمن"],
};
const hit = (key: string): VerseHit => {
  const [surah, ayah] = key.split(":").map(Number);
  const [surah_name_ar, text_uthmani, text_clean] = V[key];
  return { surah, ayah, surah_name_ar, text_uthmani, text_clean, score: 1 };
};
const text = (...keys: string[]) => keys.map((k) => V[k][1]).join(" ");
const runsOf = (quote: string, keys: string[]) =>
  findVerseRuns(quote, keys.map(hit)).map((s) => (s.kind === "run" ? `${s.verses[0].surah}:${s.verses.map((v) => v.ayah).join(",")}` : `gap «${quote.slice(s.start, s.end)}»`));

describe("findVerseRuns", () => {
  it("finds a run of consecutive verses, whatever separates them", () => {
    const keys = ["112:1", "112:2", "112:3", "112:4"];
    expect(runsOf(text(...keys), [...keys, "55:1"])).toEqual(["112:1,2,3,4"]);
    const numbered = keys.map((k, i) => `${V[k][1]} ﴿${"١٢٣٤"[i]}﴾`).join("\n");
    expect(runsOf(numbered, keys)).toEqual(["112:1,2,3,4"]);
  });

  it("keeps verses from different places apart, and short verses found by chance out", () => {
    expect(runsOf(text("103:2", "94:5"), ["103:2", "94:5", "94:6", "55:1"])).toEqual(["103:2", "94:5"]);
  });

  it("places a verse repeated in a surah where it sits in the run", () => {
    const keys = ["55:12", "55:13", "55:14", "55:15", "55:16"];
    expect(runsOf(text(...keys), keys)).toEqual(["55:12,13,14,15,16"]);
  });

  it("places a verse on its own only word for word: a misquoted one is left to the one-verse check", () => {
    const changed = V["103:3"][1].replace(/بِالصَّبْرِ$/, "بِالشُّكْرِ");
    expect(runsOf(`${text("112:1", "112:2")} ${changed}`, ["112:1", "112:2", "103:3"])).toEqual(["112:1,2", `gap «${changed}»`]);
  });

  it("leaves words that belong to no verse as a gap", () => {
    expect(runsOf(`${text("112:1", "112:2")} صدق الله العظيم`, ["112:1", "112:2"])).toEqual(["112:1,2", "gap «صدق الله العظيم»"]);
  });

  it("joins a run's verses with their numbers, which are not words", () => {
    expect(joinVerses(["112:1", "112:2"].map(hit)).text_uthmani).toBe("قُلْ هُوَ اللَّهُ أَحَدٌ ﴿١﴾ اللَّهُ الصَّمَدُ ﴿٢﴾");
  });
});

const quran = (t: string): Claim => ({
  kind: "quran", textAsWritten: t, spanCheck: "exact", arabicSpan: t, query: t, queryIsTranslation: false,
  language: "ar", attributedTo: null, citedSource: null, warnings: [],
});
/** Search stubs: the one-verse search finds what match_verses would (nothing for a paste of several verses), the
 *  in-text search returns the given verses. */
function deps(inText: string[], single: VerseHit[] = []): VerifyDeps {
  return {
    matchVerses: vi.fn(async () => single),
    matchVersesInText: vi.fn(async () => inText.map(hit)),
    matchSayings: vi.fn(async () => []),
    lookupDorar: vi.fn(async () => ({ ok: true as const, results: [], origin: "live" as const })),
  };
}

describe("verifyClaims on a paste of several verses", () => {
  it("shows a run of consecutive verses as one quote of them", async () => {
    const [r, ...rest] = await verifyClaims([quran(text("112:1", "112:2", "112:3", "112:4"))], deps(["112:1", "112:2", "112:3", "112:4", "55:1"]));
    expect(rest).toEqual([]);
    expect(r.state).toBe(STATES.verseOk);
    expect(r.verse).toMatchObject({ surah: 112, ayah: 1, endAyah: 4, wording: { exact: true } });
    expect(r.verse?.externalUrls?.quranCom).toBe("https://quran.com/112/1-4");
  });

  it("reports a changed word inside the run", async () => {
    const quote = text("103:1", "103:2", "103:3").replace(/بِالصَّبْرِ$/, "بِالشُّكْرِ");
    const [r] = await verifyClaims([quran(quote)], deps(["103:1", "103:2", "103:3"]));
    expect(r.state).toBe(STATES.verseWrong);
    expect(r.verse).toMatchObject({ surah: 103, ayah: 1, endAyah: 3 });
    expect(r.verse?.wording?.diffs).toEqual([{ op: "replaced", typed: "بِالشُّكْرِ", correct: "بِالصَّبْرِ" }]);
  });

  it("gives verses from different places one result each, cut from the claim", async () => {
    const quote = text("103:2", "94:5");
    const rs = await verifyClaims([quran(quote)], deps(["103:2", "94:5"]));
    expect(rs.map((r) => [r.verse?.surah, r.verse?.ayah, r.state])).toEqual([[103, 2, STATES.verseOk], [94, 5, STATES.verseOk]]);
    expect(rs.map((r) => r.claim.textAsWritten)).toEqual([V["103:2"][1], V["94:5"][1]]);
  });

  it("keeps words that are no verse visible as added words", async () => {
    const [r] = await verifyClaims([quran(`${text("112:1", "112:2", "112:3")} دائما`)], deps(["112:1", "112:2", "112:3"]));
    expect(r.state).toBe(STATES.verseWrong);
    expect(r.verse?.wording?.diffs).toEqual([{ op: "added", typed: "دائما" }]);
  });

  it("keeps the one-verse result when the quote is one verse misquoted", async () => {
    const one = hit("112:1");
    const [r, ...rest] = await verifyClaims([quran("قُلْ هُوَ اللَّهُ أَحَدٌ صَمَدٌ وَاحِدٌ")], deps(["112:1"], [one]));
    expect(rest).toEqual([]);
    expect(r.verse).toMatchObject({ surah: 112, ayah: 1 });
    expect(r.verse?.endAyah).toBeUndefined();
  });

  it("falls back to the one-verse result when the in-text search fails", async () => {
    const d = { ...deps([]), matchVersesInText: vi.fn(async () => { throw new Error("PGRST202: function not found"); }) };
    const [r] = await verifyClaims([quran(text("112:1", "112:2", "112:3"))], d);
    expect(r.state).toBe(STATES.notFound);
  });

  it("does not search a hadith twice unless it was copied from a mushaf", async () => {
    const d = deps(["112:1", "112:2"]);
    await verifyClaims([{ ...quran(text("112:1", "112:2", "112:3")), kind: "hadith" }], d);
    expect(d.matchVersesInText).not.toHaveBeenCalled();
  });
});

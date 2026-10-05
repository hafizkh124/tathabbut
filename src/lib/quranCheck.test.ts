import { describe, expect, it } from "vitest";
import { compareWithVerse, searchForm, type VerseHit } from "./quranCheck";
import { stateOfVerse, STATES } from "./states";

// 2:153 and 51:56 as stored in quran_verses (quranpedia Hafs, standard spelling).
const v2_153: VerseHit = {
  surah: 2,
  ayah: 153,
  surah_name_ar: "سورة البقرة",
  text_uthmani: "يَا أَيُّهَا الَّذِينَ آمَنُوا اسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ ۚ إِنَّ اللَّهَ مَعَ الصَّابِرِينَ",
  text_clean: "يا ايها الذين امنوا استعينوا بالصبر والصلاه ان الله مع الصابرين",
  score: 0.8,
};
const v51_56: VerseHit = {
  surah: 51,
  ayah: 56,
  surah_name_ar: "سورة الذاريات",
  text_uthmani: "وَمَا خَلَقْتُ الْجِنَّ وَالْإِنسَ إِلَّا لِيَعْبُدُونِ",
  text_clean: "وما خلقت الجن والانس الا ليعبدون",
  score: 0.7,
};

describe("compareWithVerse", () => {
  it("flags only the approved context omission in 4:43 and preserves the complete verse", () => {
    const verse = { ...v2_153, surah: 4, ayah: 43, text_uthmani: "يَا أَيُّهَا الَّذِينَ آمَنُوا لَا تَقْرَبُوا الصَّلَاةَ وَأَنْتُمْ سُكَارَى حَتَّى تَعْلَمُوا مَا تَقُولُونَ" };
    for (const quote of ["ولا تقربوا الصلاة", "لا تقربوا الصلاة"]) {
      const r = compareWithVerse(quote, verse);
      expect(r.contextOmitted).toBe(true);
      expect(stateOfVerse(r)).toBe(STATES.verseContext);
    }
    expect(compareWithVerse("لا تقربوا الصلاة وأنتم سكارى", verse).contextOmitted).toBeUndefined();
    expect(compareWithVerse("إن الله مع الصابرين", v2_153).contextOmitted).toBeUndefined();
  });

  it("reports the approved wording error in 13:11 (test set T028)", () => {
    const verse = { ...v2_153, surah: 13, ayah: 11, text_uthmani: "إِنَّ اللَّهَ لَا يُغَيِّرُ مَا بِقَوْمٍ حَتَّى يُغَيِّرُوا مَا بِأَنْفُسِهِمْ" };
    const r = compareWithVerse("إن الله لا يغير ما بقوم حتى يغيروا أنفسهم", verse);
    expect(stateOfVerse(r)).toBe(STATES.verseWrong);
    expect(r.diffs.length).toBeGreaterThan(0);
    expect(r.correctText).toContain("بِأَنْفُسِهِمْ");
  });
  it("accepts a correct partial quotation, whatever the harakat or hamza", () => {
    expect(compareWithVerse("إن الله مع الصابرين", v2_153)).toMatchObject({ exact: true, diffs: [], correctText: "إِنَّ اللَّهَ مَعَ الصَّابِرِينَ" });
    expect(compareWithVerse("ان اللہ مع الصابرين", v2_153).exact).toBe(true); // Urdu keyboard ہ
  });

  it("reports a changed word with the verse's own wording (test set T027)", () => {
    const r = compareWithVerse("إن الله مع الصابرون", v2_153);
    expect(r.exact).toBe(false);
    expect(r.diffs).toEqual([{ op: "replaced", typed: "الصابرون", correct: "الصَّابِرِينَ" }]);
    expect(r.correctText).toBe("إِنَّ اللَّهَ مَعَ الصَّابِرِينَ");
    expect(r.distance).toBeCloseTo(0.25);
  });

  it("reports the wrong ending of a verse (test set T026)", () => {
    const r = compareWithVerse("وما خلقت الجن والإنس إلا لعبادتي", v51_56);
    expect(r.diffs).toEqual([{ op: "replaced", typed: "لعبادتي", correct: "لِيَعْبُدُونِ" }]);
  });

  it("reports a missing and an added word", () => {
    expect(compareWithVerse("إن الله مع", v2_153).exact).toBe(true); // a shorter quote is still exact
    expect(compareWithVerse("إن الله دائما مع الصابرين", v2_153).diffs).toEqual([{ op: "added", typed: "دائما" }]);
    expect(compareWithVerse("استعينوا بالصبر إن الله مع الصابرين", v2_153).diffs).toEqual([{ op: "missing", correct: "وَالصَّلَاةِ" }]);
  });

  it("ignores waqf marks in the mushaf text", () => {
    expect(compareWithVerse("بالصبر والصلاة إن الله", v2_153).exact).toBe(true);
  });
});

describe("searchForm", () => {
  it("matches quran_verses.text_clean", () => {
    expect(searchForm("إِنَّ اللَّهَ مَعَ الصَّابِرِينَ۔")).toBe("ان الله مع الصابرين");
    expect(searchForm("ان اللہ")).toBe("ان الله");
  });
});

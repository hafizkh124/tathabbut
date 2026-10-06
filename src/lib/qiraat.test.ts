import { describe, expect, it } from "vitest";
import { buildQiraatRows, explainByQiraat, type QiraatDump } from "./qiraat";
import { compareWithVerse, type VerseHit } from "./quranCheck";
import { stateOfVerse, STATES } from "./states";

const rawi = (id: number, name: string, qid: number, imam: string) => ({ rawi: { id, name, qiraa: { id: qid, short_name: imam } } });

// 49:6 as quranpedia's qira'at data has it (shortened to the readings that matter here).
const dump: QiraatDump = {
  data: [
    {
      surah: 49,
      ayah: 6,
      qiraat: [
        {
          ayah_word: "جَآءَكُمْ",
          qiraat: [{ qiraa_text: "إمالة الألف ومدها 6 حركات وإسكان الميم", rewayat: [rawi(11, "خلف", 6, "حمزة")] }],
        },
        {
          ayah_word: "فَتَبَيَّنُواْ أَن",
          qiraat: [
            { qiraa_text: "(فَتَبَيَّنُوا) بباء بعد التاء وبعدها ياء", rewayat: [rawi(9, "شعبة", 5, "عاصم"), rawi(10, "حفص", 5, "عاصم")] },
            { qiraa_text: "(فَتَثَبَّتُوا) بثاء بعد التاء وبعدها باء 6 حركات", rewayat: [rawi(12, "خلاد", 6, "حمزة"), rawi(11, "خلف", 6, "حمزة")] },
            { qiraa_text: "(فَتَثَبَّتُوا) بثاء بعد التاء وبعدها باء 4 حركات", rewayat: [rawi(14, "الدوري", 7, "الكسائي"), rawi(13, "أبو الحارث", 7, "الكسائي"), rawi(19, "إسحاق", 10, "خلف")] },
          ],
        },
      ],
    },
    {
      surah: 1,
      ayah: 6,
      qiraat: [{ ayah_word: "الصِّرَاطَ", qiraat: [{ qiraa_text: "(بالصاد)", rewayat: [rawi(10, "حفص", 5, "عاصم")] }, { qiraa_text: "(بالسين)", rewayat: [rawi(4, "قنبل", 2, "ابن كثير")] }] }],
    },
  ],
};

const v49_6: VerseHit = {
  surah: 49,
  ayah: 6,
  surah_name_ar: "سورة الحجرات",
  text_uthmani: "يَا أَيُّهَا الَّذِينَ آمَنُوا إِنْ جَاءَكُمْ فَاسِقٌ بِنَبَإٍ فَتَبَيَّنُوا أَنْ تُصِيبُوا قَوْمًا بِجَهَالَةٍ فَتُصْبِحُوا عَلَىٰ مَا فَعَلْتُمْ نَادِمِينَ",
  text_clean: "يا ايها الذين امنوا ان جاءكم فاسق بنبا فتبينوا ان تصيبوا قوما بجهاله فتصبحوا علي ما فعلتم نادمين",
  score: 0.9,
};

describe("buildQiraatRows", () => {
  const rows = buildQiraatRows(dump);

  it("keeps the words another reading has in place of Hafs's, with every reader grouped under his imam", () => {
    expect(rows).toEqual([
      {
        surah: 49,
        ayah: 6,
        hafs_word: "فتبينوا",
        variant_word: "فتثبتوا",
        variant_text: "فَتَثَبَّتُوا",
        readers: [
          { id: 6, imam: "حمزة", ruwat: ["خلف", "خلاد"] },
          { id: 7, imam: "الكسائي", ruwat: ["أبو الحارث", "الدوري"] },
          { id: 10, imam: "خلف", ruwat: ["إسحاق"] },
        ],
      },
    ]);
  });

  it("leaves out ways of saying a word and notes that are not words («بالسين»)", () => {
    expect(rows.some((r) => r.variant_word.includes("بالسين") || r.surah === 1)).toBe(false);
  });
});

describe("a quote in another canonical reading", () => {
  const withReadings: VerseHit = { ...v49_6, qiraat: buildQiraatRows(dump) };

  it("is the verse quoted correctly, with the reading named (49:6 «فتثبتوا»)", () => {
    const w = compareWithVerse("إن جاءكم فاسق بنبأ فتثبتوا", withReadings);
    expect(w.exact).toBe(true);
    expect(w.diffs).toEqual([]);
    expect(w.qiraat?.[0].readers.map((r) => r.imam)).toEqual(["حمزة", "الكسائي", "خلف"]);
    expect(stateOfVerse(w)).toBe(STATES.verseOk);
  });

  it("is still a misquote without the readings, and for a word no reading has", () => {
    expect(compareWithVerse("إن جاءكم فاسق بنبأ فتثبتوا", v49_6).exact).toBe(false);
    const w = compareWithVerse("إن جاءكم فاسق بخبر فتثبتوا", withReadings);
    expect(w.exact).toBe(false);
    expect(w.diffs).toEqual([{ op: "replaced", typed: "بخبر", correct: "بِنَبَإٍ" }]);
    expect(w.qiraat?.length).toBe(1);
  });

  it("matches the Hafs word and the typed word, not either alone", () => {
    const rows = buildQiraatRows(dump);
    expect(explainByQiraat([{ typed: "فتثبتوا", correct: "فَتَبَيَّنُوا" }], rows).explained).toHaveLength(1);
    expect(explainByQiraat([{ typed: "فتثبتوا", correct: "فَاسِقٌ" }], rows).rest).toEqual([0]);
  });
});

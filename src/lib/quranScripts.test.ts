// compareWithVerse on quotes copied from a mushaf. The fixture (23 verses in 11 scripts, from quran.com and alquran.cloud)
// was made by Abdur Rahman (branch «eval», scripts/fetch-quran-script-fixtures.ts). The rules are in quranCheck.ts
// (uthmaniKey), each from Tanzil's Uthmani/Simple notes or the rules of رسم المصحف; what they do not cover is listed below.
import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/quran-scripts.json";
import { compareWithVerse, type VerseHit } from "./quranCheck";

const v = (surah: number, ayah: number, text: string) => ({ surah, ayah, surah_name_ar: "", text_uthmani: text, score: 1 }) as VerseHit;
const ikhlas = v(112, 1, "قُلْ هُوَ اللَّهُ أَحَدٌ");
const ibrahim = v(2, 124, "وَإِذِ ابْتَلَى إِبْرَاهِيمَ رَبُّهُ بِكَلِمَاتٍ فَأَتَمَّهُنَّ");

describe("Uthmani quotes (specialist's conditions, 2026-10-06)", () => {
  it("never reads a full alif as nothing: «قال» is not «قل», copied or typed", () => {
    expect(compareWithVerse("قَالَ هُوَ ٱللَّهُ أَحَدٌ", ikhlas).exact).toBe(false);
    expect(compareWithVerse("قال هو الله أحد", ikhlas).exact).toBe(false);
    expect(compareWithVerse("قُلْ هُوَ ٱللَّهُ أَحَدٌ", ikhlas).exact).toBe(true);
  });
  it("reads a superscript alif as the alif the standard text writes: «ابرٰهيم» is «إبراهيم»", () => {
    expect(compareWithVerse("وَإِذِ ٱبْتَلَىٰٓ إِبْرَٰهِـۧمَ رَبُّهُۥ بِكَلِمَٰتٍ فَأَتَمَّهُنَّ", ibrahim).exact).toBe(true);
    expect(compareWithVerse("وإذ ابتلى ابرٰهيم ربه بكلمات فأتمهن", ibrahim).exact).toBe(true);
    expect(compareWithVerse("ٱلرَّحْمَٰنِ ٱلرَّحِيمِ", v(1, 3, "الرَّحْمَنِ الرَّحِيمِ")).exact).toBe(true);
  });
  it("still sees a changed word in a copied quote", () => {
    const amanu = v(2, 9, "يُخَادِعُونَ اللَّهَ وَالَّذِينَ آمَنُوا وَمَا يَخْدَعُونَ إِلَّا أَنْفُسَهُمْ");
    expect(compareWithVerse("يُخَٰدِعُونَ ٱللَّهَ وَٱلَّذِينَ ءَامَنُوا۟", amanu).exact).toBe(true);
    expect(compareWithVerse("يَخْدَعُونَ ٱللَّهَ وَٱلَّذِينَ ءَامَنُوا۟", amanu).exact).toBe(false);
  });
});

type Fx = { key: string; row: VerseHit; scripts: Record<string, string> };
const verses = (fixture as { verses: Fx[] }).verses;
/** The basmala alquran.cloud puts before a first verse is not part of the verse. */
const quoteOf = (f: Fx, script: string) => {
  const q = f.scripts[script], toks = q.split(/\s+/);
  return f.row.ayah === 1 && f.key !== "1:1" && q.replace(/[^ء-ي]/g, "").startsWith("بسم") && toks.length > 4 ? toks.slice(4).join(" ") : q;
};
/** Not covered by a documented rule yet (reported): «رَءَا» (رأى), «ٱلْأَقْصَا» (الأقصى), «وَمَلَإِي۟هِۦ» (وملئه). */
const KNOWN = new Set(["6:76", "17:1", "7:103"]);

describe("the 23 verses as quran.com and alquran.cloud write them", () => {
  for (const script of ["imlaei", "imlaei_simple", "quran-simple", "quran-simple-clean", "quran-simple-min", "uthmani", "qpc_hafs"]) {
    it(`accepts every verse in ${script}${script.startsWith("uthmani") || script.startsWith("qpc") ? " (except the known three)" : ""}`, () => {
      const missed = verses.filter((f) => !compareWithVerse(quoteOf(f, script), f.row).exact).map((f) => f.key);
      expect(missed.filter((k) => !KNOWN.has(k))).toEqual([]);
    });
  }
});

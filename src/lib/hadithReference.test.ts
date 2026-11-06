import { describe, expect, it } from "vitest";
import { fetchNumberedHadith, matnQuery, muslimByAbdAlBaqi, parseHadithReference, sameHadith, type HadithFetch } from "./hadithReference";

// What live users wrote (shared_claims, 2026-10-19 to 2026-11-06).
describe("parseHadithReference", () => {
  const read = (text: string) => {
    const r = parseHadithReference(text);
    return r && [r.book, r.number];
  };
  it("Latin names with a hash", () => {
    expect(read("Sahih Muslim#5959")).toEqual(["muslim", 5959]);
    expect(read("Sahih Bukhari#187")).toEqual(["bukhari", 187]);
  });
  it("Urdu names, with a colon, a comma, or «حدیث نمبر»", () => {
    expect(read("صحیح مسلم : 250")).toEqual(["muslim", 250]);
    expect(read("صحیح مسلم، حدیث 2732")).toEqual(["muslim", 2732]);
    expect(read("سنن ابی داؤد، حدیث نمبر 4160")).toEqual(["abudawud", 4160]);
    expect(read("صحیح بخاری، حدیث نمبر 5615")).toEqual(["bukhari", 5615]);
    expect(read("ترمذی 2645")).toEqual(["tirmidhi", 2645]);
    expect(read("سنن ابن ماجہ حدیث نمبر 3400")).toEqual(["ibnmajah", 3400]);
    expect(read("نسائی 5006")).toEqual(["nasai", 5006]);
  });
  it("Arabic-Indic digits", () => {
    expect(read("رواه البخاري (٦٤٦٩)")).toBeNull(); // no number straight after the name: the brackets hold it
    expect(read("صحيح مسلم ٢٥٠")).toEqual(["muslim", 250]);
  });
  it("is no reference: a book this does not know, a volume and page, a name alone", () => {
    expect(read("مشکوٰۃ المصابیح حدیث نمبر 911")).toBeNull();
    expect(read("مسند احمد 1234")).toBeNull();
    expect(read("صحیح بخاری ج 5 ص 153")).toBeNull();
    expect(read("صحیح مسلم 1/123")).toBeNull();
    expect(read("رواه مسلم")).toBeNull();
    expect(read("ایک مسلم بھائی نے 3 بار کہا")).toBeNull();
  });
});

describe("fetchNumberedHadith", () => {
  const file = (n: number, text: string) => ({ hadiths: [{ hadithnumber: n, text }] });
  it("reads a book at its number, from the dataset's file of that hadith", async () => {
    const seen: string[] = [];
    const fetcher: HadithFetch = async (url) => (seen.push(url), file(187, "نص البخاري"));
    const found = await fetchNumberedHadith({ book: "bukhari", number: 187, matched: "" }, fetcher);
    expect(found).toEqual([{ book: "bukhari", number: 187, numbering: "standard", text: "نص البخاري" }]);
    expect(seen[0]).toMatch(/ara-bukhari\/187\.min\.json$/);
  });
  it("reads Muslim in Abd al-Baqi's numbering first, then in the dataset's own", async () => {
    const fetcher: HadithFetch = async (url) => {
      const n = Number(/\/(\d+)\.min\.json$/.exec(url)![1]);
      return file(n, `نص ${n}`);
    };
    const [first, second] = await fetchNumberedHadith({ book: "muslim", number: 250, matched: "" }, fetcher);
    expect(first.numbering).toBe("abd-al-baqi");
    expect(second).toMatchObject({ numbering: "standard", text: "نص 250" });
    // a number past Abd al-Baqi's last (3033) has only the dataset's own numbering
    const big = await fetchNumberedHadith({ book: "muslim", number: 5959, matched: "" }, fetcher);
    expect(big).toEqual([{ book: "muslim", number: 5959, numbering: "standard", text: "نص 5959" }]);
  });
  it("gives nothing when the number is not there or the dataset cannot be reached", async () => {
    const down: HadithFetch = async () => {
      throw new Error("HTTP 404");
    };
    expect(await fetchNumberedHadith({ book: "abudawud", number: 99999, matched: "" }, down)).toEqual([]);
  });
  it("knows the Abd al-Baqi numbers of Muslim", () => {
    expect(muslimByAbdAlBaqi(250).length).toBeGreaterThan(0);
    expect(muslimByAbdAlBaqi(9999)).toEqual([]);
  });
});

const BUKHARI_187 =
  "حَدَّثَنَا آدَمُ، قَالَ حَدَّثَنَا شُعْبَةُ، قَالَ حَدَّثَنَا الْحَكَمُ، قَالَ سَمِعْتُ أَبَا جُحَيْفَةَ، يَقُولُ خَرَجَ عَلَيْنَا رَسُولُ اللَّهِ صلى الله عليه وسلم بِالْهَاجِرَةِ، فَأُتِيَ بِوَضُوءٍ فَتَوَضَّأَ، فَجَعَلَ النَّاسُ يَأْخُذُونَ مِنْ فَضْلِ وَضُوئِهِ فَيَتَمَسَّحُونَ بِهِ، فَصَلَّى الظُّهْرَ رَكْعَتَيْنِ وَالْعَصْرَ رَكْعَتَيْنِ وَبَيْنَ يَدَيْهِ عَنَزَةٌ";

describe("matnQuery", () => {
  it("leaves the chain behind: the search text is the hadith's own wording", () => {
    const q = matnQuery(BUKHARI_187);
    expect(q).not.toContain("حدثنا");
    expect(q.split(" ").length).toBeLessThanOrEqual(12);
    expect(BUKHARI_187.replace(/[ً-ٰ]/g, "")).toContain(q.split(" ")[0]);
  });
  it("keeps a short text whole", () => {
    expect(matnQuery("إنما الأعمال بالنيات")).toBe("انما الاعمال بالنيات");
  });
  it("starts after the words that open the Prophet's speech", () => {
    expect(matnQuery("حدثنا فلان عن فلان عن ابي هريرة رضي الله عنه ان رسول الله صلى الله عليه وسلم قال من كذب علي متعمدا فليتبوأ مقعده من النار وهذا تمام الكلام الذي لا بد منه", 8)).toMatch(/^قال من كذب|^من كذب/);
  });
});

describe("sameHadith", () => {
  it("is high for the same hadith in two wordings, low for different ones", () => {
    expect(sameHadith(BUKHARI_187, "خرج علينا رسول الله بالهاجرة فاتي بوضوء فتوضا فجعل الناس ياخذون من فضل وضوئه فيتمسحون به")!).toBeGreaterThan(0.6);
    expect(sameHadith(BUKHARI_187, "انما الاعمال بالنيات وانما لكل امرئ ما نوى فمن كانت هجرته الى الله")!).toBeLessThan(0.3);
  });
  it("is null when a text is too short to judge", () => {
    expect(sameHadith("انما الاعمال", BUKHARI_187)).toBeNull();
  });
});

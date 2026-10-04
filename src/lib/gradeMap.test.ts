import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classifyVerdict, displayGrade, type Grade } from "./gradeMap";

const MAQBUL: Grade = "مقبول";
const DAIF: Grade = "ضعيف";
const SHADID: Grade = "شديد الضعف أو لا أصل له";
const UNSURE: Grade = "غير حاسم";
const g = (verdict: string, muhaddith = "") => classifyVerdict(verdict, muhaddith).grade;

// Each block is one of the specialist's decisions (2026-10-03).
describe("classifyVerdict — the specialist's categories", () => {
  it("مقبول: صحيح، حسن، قوي، جيد، ثبت … including verdicts on the chain", () => {
    for (const v of ["صحيح", "[صحيح]", "حسن", "حسن لغيره", "صحيح لغيره", "إسناده صحيح", "إسناده حسن", "إسناده قوي", "إسنادها جيد", "رواية صحيحة", "صحيح الإسناد", "[متواتر]", "متواتر", "حديث متواتر"]) {
      expect(g(v), v).toBe(MAQBUL);
    }
    expect(classifyVerdict("إسناده صحيح").scope).toBe("isnad");
    expect(classifyVerdict("صحيح").scope).toBe("hadith");
  });

  it("«من صحاح الأحاديث» is مقبول, even in a long wording", () => {
    expect(classifyVerdict("من صحاح الأحاديث وعيونها تفرد به الحسن بن سهل عن قطن")).toMatchObject({ grade: MAQBUL, confidence: "high" });
    expect(g("هذا من صحاح الأحاديث")).toBe(MAQBUL);
    // only when it opens the wording: a passing mention elsewhere is not the muhaddith's verdict
    expect(g("ليس هذا من صحاح الأحاديث")).not.toBe(MAQBUL);
  });

  it("ضعيف: ضعيف، لين، مجهول، معلول، مرسل، منقطع، في إسناده انقطاع", () => {
    for (const v of ["ضعيف", "إسناده ضعيف", "سنده ضعيف", "إسناده مجهول", "مرسل", "منقطع", "في إسناده انقطاع", "منقطع وضعيف"]) {
      expect(g(v), v).toBe(DAIF);
    }
  });

  it("a negated «صحيح» is ضعيف, never مقبول", () => {
    for (const v of ["لا يصح", "غير صحيح", "ليس بصحيح", "ليس بثابت", "ليس هو بثابت", "لا يثبت", "لم يصح", "[لم يصح]", "لم يثبت عن النبي صلى الله عليه وسلم"]) {
      expect(g(v), v).toBe(DAIF);
    }
  });

  it("شديد الضعف أو لا أصل له: منكر، واه، متروك، موضوع، باطل، لا أصل له، كذب، معضل، ضعيف جداً", () => {
    for (const v of ["موضوع", "منكر", "منكر جداً", "واه", "إسناده واه", "متروك", "باطل", "باطل لا أصل له", "لا أصل له", "لا أصْلَ له.", "ليس له أصل", "ليس بحديث", "كذب، ليس له أصل", "لا سند له", "معضل", "ضعيف جداً", "إسناده ضعيف جدًّا", "مشهور لا أصل له", "ساقط", "إسناده ساقط", "حديث ساقط", "مختلق", "حديث مختلق", "مختلقة"]) {
      expect(g(v), v).toBe(SHADID);
    }
  });

  it("«لم أجد / لم أقف / لا أعرفه…» counts as no basis", () => {
    for (const v of ["لم أقف عليه", "[لم أجد له إسنادا]", "لا أعرفه", "لم أجده مسطورا"]) expect(g(v), v).toBe(SHADID);
  });

  it("«لا أصل له لكن معناه صحيح» is a ruling on the narration: no basis", () => {
    expect(g("لا أعلم له أصلًا، لكن معناه صحيح")).toBe(SHADID);
    expect(g("بحث عنه الباحثون فلم يجدوا له أصلا وإن كان معناه صحيحا")).toBe(SHADID);
    expect(g("ليس بحديث، لكن معناه صحيح")).toBe(SHADID);
  });

  it("weak and very weak together: the stronger wins", () => {
    expect(g("لا أصل له، ولا يصح")).toBe(SHADID);
    expect(g("لا يصح ، وفي الإسناد كذابان")).toBe(SHADID);
  });

  it("criticism of a narrator is taken by its wording", () => {
    expect(g("[فيه] نهشل بن سعيد متروك")).toBe(SHADID);
    expect(g("[فيه] يحيى الحماني ضعيف")).toBe(DAIF);
    expect(g("في إسناده كذابان")).toBe(SHADID);
    expect(g("[فيه] الحارث بن نبهان قال أبو حاتم وقال النسائي متروك وقال البخاري منكر الحديث")).toBe(SHADID);
  });

  it("«أخرجه في صحيحه» depends on who the muhaddith is", () => {
    expect(g("أخرجه في صحيحه", "البخاري")).toBe(MAQBUL);
    expect(g("أخرجه في صحيحه", "مسلم")).toBe(MAQBUL);
    expect(g("[أورده في صحيحه] وقال : أبو معاوية حدثنا داود عن عامر", "البخاري")).toBe(MAQBUL);
    expect(g("أخرجه في صحيحه", "ابن حبان")).toBe(UNSURE);
    expect(g("أخرجه في صحيحه", "ابن خزيمة")).toBe(UNSURE);
    expect(g("أخرجه البخاري")).toBe(MAQBUL);
    expect(g("رواه مسلم")).toBe(MAQBUL);
  });

  it("غير حاسم: سكت عنه، المختارة، تمريض، اختلاف، غريب", () => {
    for (const v of [
      "سكت عنه [وقد قال في رسالته لأهل مكة كل ما سكت عنه فهو صالح]",
      "أورده في المختارة وقال [هذه أحاديث اخترتها مما ليس في البخاري ومسلم]",
      "قيل لا أصل له أو بأصله موضوع",
      "[فيه] ابن إسحاق مختلف فيه",
      "اختَلَف شُعبةُ والثَّوريُّ في إسنادِ هذا الحديثِ",
      "غريب",
      "غريب جدا",
      "رجاله ثقات",
    ]) {
      expect(g(v), v).toBe(UNSURE);
    }
  });

  it("the muhaddith's own verdict counts when others' view is mentioned after it", () => {
    expect(classifyVerdict("ضعيف، وبعضهم جعله في الموضوعات")).toMatchObject({ grade: DAIF, confidence: "medium" });
    expect(classifyVerdict("ضعيف وبعضهم جعله في الموضوعات").grade).toBe(DAIF);
    expect(classifyVerdict("موضوع وقال بعضهم ضعيف").grade).toBe(SHADID);
  });

  it("long wordings are left to the specialist, whatever words they contain", () => {
    expect(g("أظنه من عمر، موقوفاً وليس مرفوعاً، والرماية جاء فيها أحاديث صحيحة")).toBe(UNSURE);
    expect(g("تفرد به سليمان بن الربيع عن همام وإنما يعرف هذا من رواية الحسن بن سالم")).toBe(UNSURE);
  });
});

describe("classifyVerdict — traps the word rules must not fall into", () => {
  it("«واه» inside «شواهد» is not a word", () => {
    expect(g("إسناده ضعيف لكن له شواهد")).toBe(DAIF);
    expect(g("ضعيف وله شاهد")).toBe(DAIF);
  });

  it("«الحسن» (a narrator's name) is not «حسن»", () => {
    expect(g("فيه الحسن بن عمارة")).not.toBe(MAQBUL);
  });

  it("acceptance mixed with weakness is غير حاسم, not مقبول", () => {
    expect(g("صحيح وضعيف")).toBe(UNSURE);
  });

  it("qualified or partial verdicts keep their grade at lower confidence", () => {
    expect(classifyVerdict("إسناده حسن إن شاء الله")).toMatchObject({ grade: MAQBUL, confidence: "medium" });
    expect(classifyVerdict("حسن صحيح غريب")).toMatchObject({ grade: MAQBUL, confidence: "medium" });
    expect(classifyVerdict("صحيح")).toMatchObject({ confidence: "high" });
  });

  it("flags Dorar's own additions in brackets", () => {
    expect(classifyVerdict("[صحيح]").bracketed).toBe(true);
    expect(classifyVerdict("صحيح").bracketed).toBe(false);
  });

  it("an empty verdict is غير حاسم", () => {
    expect(g("")).toBe(UNSURE);
  });
});

describe("displayGrade — policy A", () => {
  it("shows a high-confidence grade plainly, with what مقبول means", () => {
    expect(displayGrade(classifyVerdict("صحيح"))).toEqual({ grade: MAQBUL, label: "مقبول (صحيح أو حسن)", caution: false });
    expect(displayGrade(classifyVerdict("موضوع"))).toEqual({ grade: SHADID, label: SHADID, caution: false });
  });

  it("keeps a medium-confidence grade but marks it with a caution", () => {
    expect(displayGrade(classifyVerdict("إسناده حسن إن شاء الله"))).toEqual({ grade: MAQBUL, label: "مقبول (صحيح أو حسن)", caution: true });
    expect(displayGrade(classifyVerdict("[فيه] الحارث بن نبهان قال أبو حاتم وقال النسائي متروك وقال البخاري منكر الحديث"))).toMatchObject({
      grade: SHADID,
      caution: true,
    });
  });

  it("never adds a caution to غير حاسم (it already refers to the specialist)", () => {
    expect(displayGrade(classifyVerdict("أخرجه في صحيحه", "ابن حبان"))).toEqual({ grade: UNSURE, label: UNSURE, caution: false });
    expect(displayGrade(classifyVerdict("غريب"))).toMatchObject({ grade: UNSURE, caution: false });
  });
});

// Parity with the specialist's review workbook: every (verdict, muhaddith) pair seen in the cached Dorar answers,
// classified by the same rules in the script that built Tathabbut_GradeMap_Review.xlsx. The file holds Dorar's text,
// so it stays in the git-ignored .cache/ and this check runs only where it exists.
const golden = join(__dirname, "..", "..", ".cache", "grade", "golden.json");
describe.skipIf(!existsSync(golden))("classifyVerdict — same result as the review workbook", () => {
  const rows = existsSync(golden)
    ? (JSON.parse(readFileSync(golden, "utf-8")) as { verdict: string; muhaddith: string; grade: Grade; confidence: string }[])
    : [];

  it(`agrees on all ${rows.length} pairs`, () => {
    const diff = rows
      .map((r) => ({ r, got: classifyVerdict(r.verdict, r.muhaddith) }))
      .filter(({ r, got }) => got.grade !== r.grade || got.confidence !== r.confidence)
      .map(({ r, got }) => `${r.verdict.slice(0, 50)} | ${r.muhaddith}: want ${r.grade}/${r.confidence}, got ${got.grade}/${got.confidence}`);
    expect(diff).toEqual([]);
  });
});

// grade_map: turns a muhaddith's verdict, exactly as Dorar prints it («خلاصة حكم المحدث»), into one of four categories.
// The tool never produces a verdict of its own: it only reads the scholar's words and applies these rules.
// Every rule below is the hadith specialist's decision (see Tathabbut_GradeMap_Review.xlsx, 2026-10-03).
// Patterns run over normalizeArabic() text: no tashkeel; أ إ آ ٱ → ا, ى → ي, ة → ه, ؤ → و, ئ → ي.
import { normalizeArabic } from "./arabic";

export const GRADES = ["مقبول", "ضعيف", "شديد الضعف أو لا أصل له", "غير حاسم"] as const;
export type Grade = (typeof GRADES)[number];
const [MAQBUL, DAIF, SHADID, UNSURE] = GRADES;

/** Not a grade: the state shown when Dorar has nothing at all for the text (same label as the test set). */
export const NOT_FOUND_STATE = "لم يُعثر عليه — إحالة";
/** What «مقبول» means, for display next to it. */
export const MAQBUL_MEANING = "صحيح أو حسن";

export type Confidence = "high" | "medium" | "low";

export interface GradeResult {
  grade: Grade;
  confidence: Confidence;
  /** Why, in Arabic, for the specialist's review queue. */
  reason: string;
  /** The verdict is about the chain only («إسناده صحيح»), which the specialist accepts as a verdict on the hadith. */
  scope: "isnad" | "hadith";
  /** Dorar puts its own additions in [..]; the wording is the encyclopaedia's, not the muhaddith's. */
  bracketed: boolean;
}

/** Whole word, allowing the usual prefixes (و ف ب ل ك, then ال) and suffixes (ه ها ة ات ان ين ون ا):
 *  'واه' matches the word «واه» but not the inside of «شواهد». */
function word(alts: string[], withAl = true): string {
  const pre = "(?:و|ف|ب|ل|ك)?" + (withAl ? "(?:ال)?" : "");
  return `(?<![ء-ي])${pre}(?:${alts.join("|")})(?:ه|ها|ة|ات|ان|ين|ون|ا)?(?![ء-ي])`;
}
const re = (src: string) => new RegExp(src);
const reAll = (src: string) => new RegExp(src, "g");

// «أخرجه في صحيحه»: acceptance when the muhaddith is al-Bukhari or Muslim; anyone else (Ibn Hibban, Ibn Khuzayma…) → غير حاسم.
const OWN_SAHIH = "(اخرجه|اورده|خرجه|رواه) (في )?صحيحه";
const SAHIHAYN = new Set(["البخاري", "مسلم", "الشيخان", "البخاري ومسلم"]);
const SIHAH_START = re("^(هو |هذا )?من صحاح الاحاديث");

/** A dispute or a possibility mentioned in the wording. */
const DISPUTE = re(word(["بعضهم", "اختلف", "خلاف", "يحتمل"]));

/** Stage 1: wordings that decide by themselves; first match wins. */
const SPECIAL: { pattern: RegExp; grade: Grade; confidence: Confidence; reason: string }[] = [
  { pattern: re("(اخرجه|رواه|خرجه|اورده) (البخاري|مسلم|الشيخان)"), grade: MAQBUL, confidence: "high", reason: "إخراج البخاري/مسلم" },
  { pattern: DISPUTE, grade: UNSURE, confidence: "low", reason: "فيه اختلاف أو احتمال" },
  { pattern: re("^(قيل|زعم|يقال|قال بعضهم)"), grade: UNSURE, confidence: "low", reason: "صيغة تمريض/حكاية قول" },
  { pattern: re("سكت عنه"), grade: UNSURE, confidence: "low", reason: "سكوت المحدث ليس حكما صريحا" },
  {
    pattern: re("(اخرجه|اورده|خرجه|رواه) (في )?(صحيحه|المختاره|المستدرك)|اخترتها"),
    grade: UNSURE,
    confidence: "low",
    reason: "إخراج في صحيحه/المختارة/المستدرك والمحدث ليس البخاري ولا مسلما",
  },
];

/** «معناه صحيح»: the ruling is on the narration; the meaning being sound is not read as acceptance. */
const MEANING_OK = "(معناه|معني[هـ]?|معناها) (صحيح|حسن|صحيحا|صحيحه)";
/** «لم أجد / لم أقف…» at the start of the wording counts as no basis. */
const NOT_FOUND_START = re("^(لم اجد|لم اقف|لم اره|لا اعرف|لا اجده|لا يوجد له)");

/** Stage 2: negations of soundness → ضعيف. The matched words are removed, so «ليس بصحيح» is never read as «صحيح». */
const NEG_DAIF = [
  "(ليس|غير|لم|لا|ما) (هو )?(بصحيح|صحيح|يصح|يصحح|تصح|يثبت|ثابت|بثابت|بحجه|حجه|يحتج به)",
  "لا صحه له|لا يصح|لا يثبت|ليس بثابت|لم يثبت|لم يصح|عدم (صحه|ثبوت)|مجمع علي ضعفه",
];

/** Stage 3: tier words, the strongest first (and removed), so «ضعيف جدا» is not also read as plain «ضعيف». */
const SHADID_PAT = word([
  "منكر", "واه", "واهي", "واهيه", "متروك", "شديد", "مضطرب", "موضوع", "موضوعات", "باطل", "لا اصل له", "لا اصل",
  "ليس له اصل", "ليس بحديث", "كذب", "مكذوب", "ليس (?:له|لهذا|لهذا الحديث) اصل", "لا اصل لهذا(?: الحديث)?", "مناكير",
  "كذاب", "كذابان", "كذابين", "لا سند له", "لا اسناد له", "لا اعلم له اصلا", "لم (?:يجدوا|اجد|نجد) له اصلا",
  "ضعيف جدا", "ضعف شديد", "معضل", "ساقط", "مختلق",
]);
const DAIF_PAT = word(["ضعيف", "ضعف", "لين", "مجهول", "لا يعرف", "فيه علة", "معلول", "مرسل", "منقطع", "انقطاع"]);
// «حسن» etc. take no «ال»: «الحسن» is usually a narrator's name (e.g. الحسن البصري).
const SAHIH_PAT =
  word(["صحيح", "صحيحه", "صحته", "صحه", "متواتر"]) + "|" + word(["حسن", "قوي", "جيد", "ثبت", "مشهور بالصحه", "متفق عليه", "مجمع علي صحته"], false);
/** A description of the chain, not a verdict (غريب stays غير حاسم by the specialist's decision). */
const NEUTRAL = re(word(["ارسال", "غريب", "شاذ", "مدلس", "تفرد"]));
const QUALIFIERS = re(
  "يحتاج|نظر|ان شاء|اظن|احتمال|لكن|الا ان|وان كان|غير ان|رجاله ثقات|رجاله رجال|بعضه|موقوف|وليس مرفوع|يعمل|معروف|في المقدمه|بهذا الاسناد",
);
const SCOPE_ISNAD = re("اسناد|سنده|سندها|رجاله|رجالها|طريق|اسانيد");
const NARRATOR_START = re("^(فيه|في اسناده|في السند|في سنده|فيها) ");
/** Longer wordings carry names and side remarks that mislead word rules, so they are left to the specialist. */
const LONG = 40;

export function classifyVerdict(verdict: string, muhaddith = ""): GradeResult {
  const bracketed = verdict.trim().startsWith("[");
  const text = normalizeArabic(verdict.replace(/[[\]]/g, " "));
  const scope = SCOPE_ISNAD.test(text) ? "isnad" : "hadith";
  const out = (grade: Grade, confidence: Confidence, reason: string): GradeResult => ({ grade, confidence, reason, scope, bracketed });

  if (re("^" + OWN_SAHIH).test(text) && SAHIHAYN.has(normalizeArabic(muhaddith))) {
    return out(MAQBUL, "high", `المحدث ${muhaddith.trim()}: «أخرجه في صحيحه»`);
  }
  // «من صحاح الأحاديث (وعيونها)» opening the wording is acceptance, whatever follows (e.g. «تفرد به…»).
  if (SIHAH_START.test(text)) return out(MAQBUL, "high", "«من صحاح الأحاديث»");
  // «ضعيف، وبعضهم جعله في الموضوعات»: the muhaddith's own verdict comes first; the mention of others' view after it
  // does not cancel it (specialist's decision, 2026-10-04). With no verdict before it, the dispute stays غير حاسم.
  const dispute = DISPUTE.exec(text);
  if (dispute && dispute.index > 0) {
    const own = text.slice(0, dispute.index).replace(/[\s،,؛;:]+$/, "");
    if (own) {
      const r = classifyVerdict(own, muhaddith);
      if (r.grade !== UNSURE) return out(r.grade, "medium", `حكم المحدث «${own}» مع ذكر رأي آخر`);
    }
  }
  for (const rule of SPECIAL) {
    if (rule.pattern.test(text) && (rule.grade !== MAQBUL || text.length <= 60)) return out(rule.grade, rule.confidence, rule.reason);
  }
  if (NOT_FOUND_START.test(text)) return out(SHADID, "medium", "«لم أجد/لم أقف…» تُعدّ «لا أصل له»");

  const tiers = new Set<Grade>();
  const notes: string[] = [];
  let work = text;
  const meaningOk = re(MEANING_OK).test(work);
  if (meaningOk) work = work.replace(reAll(MEANING_OK), " ");
  for (const pat of NEG_DAIF) {
    if (re(pat).test(work)) {
      tiers.add(DAIF);
      notes.push("نفي للصحة");
      work = work.replace(reAll(pat), " ");
    }
  }
  if (re(SHADID_PAT).test(work)) {
    tiers.add(SHADID);
    work = work.replace(reAll(SHADID_PAT), " ");
  }
  if (re(DAIF_PAT).test(work)) {
    tiers.add(DAIF);
    work = work.replace(reAll(DAIF_PAT), " ");
  }
  if (re(SAHIH_PAT).test(work)) tiers.add(MAQBUL);
  const signals = tiers.size ? GRADES.filter((g) => tiers.has(g)).join(" + ") : "لا إشارة";

  if (meaningOk) {
    return tiers.has(SHADID)
      ? out(SHADID, "high", "الحكم على الرواية («لا أصل له») مع صحة المعنى")
      : out(UNSURE, "low", "ذُكر «معناه صحيح» دون حكم صريح على الرواية");
  }
  if (NARRATOR_START.test(text) && tiers.size && !tiers.has(MAQBUL)) {
    return out(tiers.has(SHADID) ? SHADID : DAIF, text.length <= LONG ? "high" : "medium", "جرح راوٍ في السند؛ يُعتمد بحسب لفظه");
  }
  if (text.length > LONG) {
    return out(UNSURE, tiers.size <= 1 ? "medium" : "low", `عبارة طويلة تحتاج قراءة المختص. إشارات: ${signals}`);
  }
  if (tiers.has(MAQBUL) && tiers.size > 1) return out(UNSURE, "low", `تعارض بين القبول والضعف: ${signals}`);
  if (tiers.size) {
    const grade = tiers.has(SHADID) ? SHADID : tiers.has(DAIF) ? DAIF : MAQBUL;
    let confidence: Confidence = "high";
    if (tiers.has(DAIF) && tiers.has(SHADID)) {
      notes.push("اجتمع ضعف وشديد الضعف؛ الأشد يغلب");
      confidence = "medium";
    }
    if (NEUTRAL.test(work)) {
      notes.push("فيه وصف للسند أيضا");
      confidence = "medium";
    }
    if (QUALIFIERS.test(work)) {
      notes.push("فيه تحفظ/قيد");
      confidence = "medium";
    }
    return out(grade, confidence, notes.join("؛ "));
  }
  if (NEUTRAL.test(work)) return out(UNSURE, "medium", "وصف للسند وليس حكما نهائيا");
  return out(UNSURE, "medium", "لا مؤشر حكمي واضح");
}

/** How a result is shown (the specialist chose "policy A", 2026-10-03): the grade is always shown as the rules give it;
 *  a medium-confidence grade (a qualified verdict such as «إسناده حسن إن شاء الله», or a narrator's criticism) carries a
 *  caution, and the muhaddith's own words are always shown next to it. Low confidence is already غير حاسم. */
export interface GradeDisplay {
  grade: Grade;
  /** e.g. «مقبول (صحيح أو حسن)» */
  label: string;
  caution: boolean;
}

export function displayGrade(r: GradeResult): GradeDisplay {
  return {
    grade: r.grade,
    label: r.grade === MAQBUL ? `${MAQBUL} (${MAQBUL_MEANING})` : r.grade,
    caution: r.confidence === "medium" && r.grade !== UNSURE,
  };
}

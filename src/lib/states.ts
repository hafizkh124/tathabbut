// The states a claim can end in. Kept apart from verify.ts so the browser can import them without the server-only checks.
import { NOT_FOUND_STATE } from "./gradeMap";

export const STATES = {
  maqbul: "مقبول",
  daif: "ضعيف",
  shadid: "شديد الضعف أو لا أصل له",
  unsure: "غير حاسم",
  verseOk: "آية صحيحة النقل",
  verseWrong: "آية منقولة بخطأ",
  verseContext: "آية اقتطع سياقها",
  verseTranslated: "آية (نص مترجم)",
  notFound: NOT_FOUND_STATE,
  fatwa: "فتوى أو حالة شخصية — إحالة",
  /** A general question of fiqh: the views of the madhhabs are shown as the books give them, with no preference. Not a grade. */
  fiqh: "مسألة فقهية",
  /** The text is in the books of Turath and nowhere Dorar looked. Not a grade: Turath gives no verdict. */
  turathFound: "موجود في كتب التراث",
} as const;
export type State = (typeof STATES)[keyof typeof STATES] | string; // + the specialist's own statuses from circulating_sayings

/** The state of a quoted verse from how the quote compares with it (no comparison = a translated text). */
export const stateOfVerse = (wording: { exact: boolean; contextOmitted?: true } | undefined) => (!wording ? STATES.verseTranslated : wording.contextOmitted ? STATES.verseContext : wording.exact ? STATES.verseOk : STATES.verseWrong);

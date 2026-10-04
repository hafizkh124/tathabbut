// The states a claim can end in. Kept apart from verify.ts so the browser can import them without the server-only checks.
import { NOT_FOUND_STATE } from "./gradeMap";

export const STATES = {
  maqbul: "مقبول",
  daif: "ضعيف",
  shadid: "شديد الضعف أو لا أصل له",
  unsure: "غير حاسم",
  verseOk: "آية صحيحة النقل",
  verseWrong: "آية منقولة بخطأ",
  verseTranslated: "آية (نص مترجم)",
  notFound: NOT_FOUND_STATE,
  fatwa: "فتوى أو حالة شخصية — إحالة",
} as const;
export type State = (typeof STATES)[keyof typeof STATES] | string; // + the specialist's own statuses from circulating_sayings

// How a state looks. The colours are CSS variables (src/app/globals.css) so light/dark and the whole palette live in one place.
// A state's meaning never rests on colour alone: every tone also has an icon and its label.
import { GRADES } from "./gradeMap";
import { STATES } from "./states";

export type Tone = "accepted" | "weak" | "veryWeak" | "unsure" | "verse" | "misquote" | "translated" | "fatwa" | "notFound" | "found";
export type IconName = "check" | "bang" | "cross" | "question" | "book" | "refer" | "dash";

export interface ToneStyle {
  bg: string;
  fg: string;
  bd: string;
  /** the underline drawn under the claim inside the pasted text */
  line: string;
  icon: IconName;
  dashed: boolean;
}

const v = (tone: string, part: "bg" | "fg" | "bd" | "line") => `var(--t-${tone}-${part})`;
const style = (tone: string, icon: IconName, dashed = false): ToneStyle => ({
  bg: v(tone, "bg"),
  fg: v(tone, "fg"),
  bd: v(tone, "bd"),
  line: v(tone, "line"),
  icon,
  dashed,
});

export const TONE_STYLE: Record<Tone, ToneStyle> = {
  accepted: style("accepted", "check"),
  weak: style("weak", "bang"),
  veryWeak: style("veryWeak", "cross"),
  unsure: style("unsure", "question"),
  verse: style("accepted", "book"),
  misquote: style("misquote", "bang"),
  translated: style("translated", "book"),
  fatwa: style("fatwa", "refer"),
  notFound: style("notFound", "dash", true),
  // found in the books of Turath: a neutral tone, not a grade
  found: style("found", "book"),
};

const EXACT: Record<string, Tone> = {
  [GRADES[0]]: "accepted",
  [GRADES[1]]: "weak",
  [GRADES[2]]: "veryWeak",
  [GRADES[3]]: "unsure",
  [STATES.verseOk]: "verse",
  [STATES.verseWrong]: "misquote",
  [STATES.verseTranslated]: "translated",
  [STATES.notFound]: "notFound",
  [STATES.fatwa]: "fatwa",
  [STATES.turathFound]: "found",
  // the specialist's own extra statuses (circulating_sayings)
  "قول منسوب خطأً إلى النبي ﷺ": "misquote",
  "لفظ أو ترجمة غير دقيقة": "misquote",
  "قول منسوب خطأً إلى عالم": "misquote",
};

/** The tone of a state. An unknown wording is read cautiously, and anything unclear is «غير حاسم», never green. */
export function toneOf(state: string): Tone {
  const exact = EXACT[state.trim()];
  if (exact) return exact;
  if (/شديد|لا أصل|موضوع|باطل/.test(state)) return "veryWeak";
  if (/ضعيف/.test(state)) return "weak";
  if (/خطأ|خطا/.test(state)) return "misquote";
  if (/مقبول/.test(state)) return "accepted";
  return "unsure";
}

export const styleOf = (state: string): ToneStyle => TONE_STYLE[toneOf(state)];

export type IconKey = IconName | "ext" | "copy" | "share" | "image" | "camera" | "mic" | "history" | "info" | "close" | "report";

/** Paths for a 16×16 viewBox, drawn with a rounded stroke. */
export const ICON_PATHS: Record<IconKey, string> = {
  check: "M3 8.5 L6.5 12 L13 4.5",
  bang: "M8 3 V9 M8 12.4 V12.5",
  cross: "M4 4 L12 12 M12 4 L4 12",
  question: "M6 6 C6 3.4 10 3.4 10 6 C10 8 8 8 8 10 M8 12.4 V12.5",
  book: "M2.5 3.5 H7.2 V13 H2.5 Z M8.8 3.5 H13.5 V13 H8.8 Z",
  refer: "M4 12 L12 4 M6 4 H12 V10",
  dash: "M4 8 H12",
  ext: "M4 12 L12 4 M6 4 H12 V10",
  copy: "M5.5 5.5 H12.5 V13 H5.5 Z M3.5 10.5 V3 H10",
  share: "M8 10 V2.5 M5 5 L8 2 L11 5 M3 9 V13 H13 V9",
  image: "M2 3.5 H14 V12.5 H2 Z M3 12 L7 8 L10 11 L12 9.5 L14 11.5 M5.8 6.2 V6.3",
  camera: "M2 5.5 H4.5 L5.8 3.5 H10.2 L11.5 5.5 H14 V12.5 H2 Z M8 10.8 A2.2 2.2 0 1 0 8 6.4 A2.2 2.2 0 1 0 8 10.8",
  mic: "M6 2 H10 V8 C10 9.4 9.1 10 8 10 C6.9 10 6 9.4 6 8 Z M3.5 8 C3.5 11 5.5 12.5 8 12.5 C10.5 12.5 12.5 11 12.5 8 M8 12.5 V14.5",
  history: "M8 2 A6 6 0 1 0 14 8 M8 4.5 V8 L10.5 9.5 M2 3 V6 H5",
  info: "M8 7.2 V11.2 M8 4.8 V4.9",
  close: "M4 4 L12 12 M12 4 L4 12",
  report: "M3.5 2.5 V14 M3.5 3.5 H12 L10 6.5 L12 9.5 H3.5",
};

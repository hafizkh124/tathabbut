// Turns rows of the specialist's reviewed workbook (Tathabbut_Circulating_Sayings.xlsx) into circulating_sayings rows.
// Columns are found by their header (each carries the database field name in brackets), so moving a column is harmless.
// Only rows marked «معتمد» are loaded, and a row missing its status, verdict, author or reference is refused:
// nothing is attributed without a source and a ruling.
import { normalizeArabic } from "./arabic";

export const SAYING_STATUSES = [
  "شديد الضعف أو لا أصل له",
  "ضعيف",
  "غير حاسم",
  "قول منسوب خطأً إلى النبي ﷺ",
  "لفظ أو ترجمة غير دقيقة",
  "قول منسوب خطأً إلى عالم",
] as const;
export type SayingStatus = (typeof SAYING_STATUSES)[number];

export interface SayingRow {
  text_ar: string;
  text_clean: string;
  phrasings: string[];
  status: SayingStatus;
  verdict: string;
  verdict_by: string;
  reference: string;
  correct_text: string | null;
  note: string | null;
  claimed_attribution: string | null;
  claimed_reference: string | null;
}

/** Header text → field. A header matches when it contains the key. */
const HEADERS: [string, keyof SheetRecord][] = [
  ["(text_ar)", "text_ar"],
  ["(phrasings)", "phrasing_ur"],
  ["صيغة إنجليزية", "phrasing_en"],
  ["(status)", "status"],
  ["(verdict_by)", "verdict_by"], // before "(verdict)", which it also contains
  ["(verdict)", "verdict"],
  ["(reference)", "reference"],
  ["(correct_text)", "correct_text"],
  ["(note)", "note"],
  ["النسبة المتداولة", "claimed_attribution"],
  ["الحوالة المتداولة", "claimed_reference"],
  ["حالة المراجعة", "review"],
];

export type SheetRecord = Partial<
  Record<
    | "text_ar" | "phrasing_ur" | "phrasing_en" | "status" | "verdict" | "verdict_by" | "reference"
    | "correct_text" | "note" | "claimed_attribution" | "claimed_reference" | "review",
    string
  >
>;

/** Which column holds which field, from the header row. */
export function mapHeaders(headers: (string | null | undefined)[]): Map<number, keyof SheetRecord> {
  const map = new Map<number, keyof SheetRecord>();
  headers.forEach((h, i) => {
    const hit = HEADERS.find(([key]) => (h ?? "").includes(key));
    if (hit && ![...map.values()].includes(hit[1])) map.set(i, hit[1]);
  });
  return map;
}

/** Review flags the tool wrote into the note column for the specialist; they are not notes for users. */
const TOOL_FLAGS = [/^حكم بالقبول عند/, /^لم يُعثر على نتيجة مطابقة/];

const clean = (v: string | undefined): string => (v ?? "").replace(/\s+/g, " ").trim();
const orNull = (v: string | undefined): string | null => clean(v) || null;

export type RowOutcome = { skip: true; why: string } | { skip: false; row: SayingRow } | { error: string };

export function toSayingRow(r: SheetRecord): RowOutcome {
  if (clean(r.review) !== "معتمد") return { skip: true, why: `حالة المراجعة: ${clean(r.review) || "فارغة"}` };
  const text = clean(r.text_ar);
  const missing = (["text_ar", "status", "verdict", "verdict_by", "reference"] as const).filter((k) => !clean(r[k]));
  if (missing.length) return { error: `${text || "(بلا نص)"}: حقول ناقصة: ${missing.join(", ")}` };
  const status = clean(r.status) as SayingStatus;
  if (!SAYING_STATUSES.includes(status)) return { error: `${text}: فئة غير معروفة «${status}»` };
  const note = orNull(r.note);
  return {
    skip: false,
    row: {
      text_ar: text,
      text_clean: normalizeArabic(text),
      phrasings: [r.phrasing_ur, r.phrasing_en].flatMap((p) => clean(p).split(/\s*[|\n]\s*/)).filter(Boolean),
      status,
      verdict: clean(r.verdict),
      verdict_by: clean(r.verdict_by),
      reference: clean(r.reference),
      correct_text: orNull(r.correct_text),
      note: note && TOOL_FLAGS.some((f) => f.test(note)) ? null : note,
      claimed_attribution: orNull(r.claimed_attribution),
      claimed_reference: orNull(r.claimed_reference),
    },
  };
}

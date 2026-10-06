// Turns the quranpedia dumps into rows for quran_verses, quran_translations and (not loaded yet) the Uthmani and
// IndoPak script texts, and refuses to produce anything if the dumps do not line up (wrong count, a missing or
// duplicate ayah).
import { normalizeArabic } from "./arabic";
import { cleanTranslation, type TranslationLang } from "./quranTranslation";

/** Shapes of the dumps, reduced to the fields we read (checked against the files of 2026-10-03). */
export interface MushafDump {
  license?: { version?: string };
  data: { surahs: { id: number; name: string; ayahs: { number: number; text: string }[] }[] };
}
export interface TranslationDump {
  ayahs: { surah_number: number | string; ayah_number: number | string; translated_text: string }[];
}

export interface VerseRow {
  surah: number;
  ayah: number;
  surah_name_ar: string;
  text_uthmani: string;
  text_clean: string;
  source_id: string;
}
export interface TranslationRow {
  surah: number;
  ayah: number;
  lang: TranslationLang;
  text: string;
  source_id: string;
}

export const EXPECTED_AYAHS = 6236;
export const EXPECTED_SURAHS = 114;

/** U+FEFF opens every ayah of the Hafs dump and is invisible; it would only get in the way of matching. */
const stripInvisible = (s: string): string => s.replace(/[﻿​]/g, "").trim();

export function buildVerseRows(mushaf: MushafDump, sourceId: string): VerseRow[] {
  const rows: VerseRow[] = [];
  for (const s of mushaf.data.surahs) {
    for (const a of s.ayahs) {
      const text = stripInvisible(a.text);
      rows.push({
        surah: s.id,
        ayah: a.number,
        surah_name_ar: s.name,
        text_uthmani: text,
        text_clean: normalizeArabic(text),
        source_id: sourceId,
      });
    }
  }
  return rows;
}

/** The same Hafs text written in another script: mushaf 2 (Uthmani, KFGQPC encoding) and mushaf 3 (IndoPak Nastaleeq). */
export type QuranScript = "uthmani" | "indopak";
export interface VerseScriptRow {
  surah: number;
  ayah: number;
  script: QuranScript;
  /** As published, less the invisible marks. */
  text: string;
  /** normalizeArabic(text), the same search form as quran_verses.text_clean. */
  text_clean: string;
  source_id: string;
}

export function buildScriptRows(mushaf: MushafDump, script: QuranScript, sourceId: string): VerseScriptRow[] {
  return mushaf.data.surahs.flatMap((s) =>
    s.ayahs.map((a) => {
      const text = stripInvisible(a.text);
      return { surah: s.id, ayah: a.number, script, text, text_clean: normalizeArabic(text), source_id: sourceId };
    }),
  );
}

/**
 * A script text must have exactly the ayahs of the standard text, and each ayah must be the same ayah: the scripts
 * spell differently, and Uthmani joins the vocative «يا» to the next word while IndoPak sometimes splits one, so the word
 * counts may differ a little, but a gap of more than `maxWordGap` words means the numbering has slipped.
 */
export function validateScriptRows(rows: VerseScriptRow[], verses: VerseRow[], maxWordGap = 3): void {
  const problems: string[] = [];
  const key = (r: { surah: number; ayah: number }) => `${r.surah}:${r.ayah}`;
  const standard = new Map(verses.map((v) => [key(v), v]));
  for (const script of new Set(rows.map((r) => r.script))) {
    const mine = rows.filter((r) => r.script === script);
    const keys = new Set(mine.map(key));
    if (mine.length !== verses.length) problems.push(`${script}: expected ${verses.length} ayahs, got ${mine.length}`);
    if (keys.size !== mine.length) problems.push(`${script}: ${mine.length - keys.size} duplicate (surah, ayah)`);
    const missing = [...standard.keys()].filter((k) => !keys.has(k));
    if (missing.length) problems.push(`${script}: no text for ${missing.length} ayahs, e.g. ${missing.slice(0, 3).join(", ")}`);
    for (const r of mine) {
      const v = standard.get(key(r));
      if (!r.text || !r.text_clean) problems.push(`${script} ${key(r)}: empty text`);
      else if (!v) problems.push(`${script} ${key(r)}: not in the standard text`);
      else {
        const gap = Math.abs(r.text_clean.split(" ").length - v.text_clean.split(" ").length);
        if (gap > maxWordGap) problems.push(`${script} ${key(r)}: ${gap} words more or fewer than the standard text`);
      }
    }
  }
  if (problems.length) throw new Error("Quran script text does not line up:\n- " + problems.slice(0, 20).join("\n- "));
}

export function buildTranslationRows(dump: TranslationDump, lang: TranslationLang, sourceId: string): TranslationRow[] {
  return dump.ayahs.map((a) => ({
    surah: Number(a.surah_number),
    ayah: Number(a.ayah_number),
    lang,
    text: cleanTranslation(a.translated_text, lang),
    source_id: sourceId,
  }));
}

/** Throws a single error listing every problem found, so a bad dump is fixed in one pass. */
export function validateQuranRows(verses: VerseRow[], translations: TranslationRow[], opts = { ayahs: EXPECTED_AYAHS, surahs: EXPECTED_SURAHS }): void {
  const problems: string[] = [];
  const key = (r: { surah: number; ayah: number }) => `${r.surah}:${r.ayah}`;

  const verseKeys = new Set(verses.map(key));
  if (verses.length !== opts.ayahs) problems.push(`verses: expected ${opts.ayahs}, got ${verses.length}`);
  if (verseKeys.size !== verses.length) problems.push(`verses: ${verses.length - verseKeys.size} duplicate (surah, ayah)`);
  const surahCount = new Set(verses.map((v) => v.surah)).size;
  if (surahCount !== opts.surahs) problems.push(`verses: expected ${opts.surahs} surahs, got ${surahCount}`);
  for (const v of verses) if (!v.text_uthmani || !v.text_clean) problems.push(`verse ${key(v)} has empty text`);

  for (const lang of ["ur", "en"] as const) {
    const rows = translations.filter((t) => t.lang === lang);
    const keys = new Set(rows.map(key));
    if (rows.length !== verses.length) problems.push(`${lang}: expected ${verses.length} translations, got ${rows.length}`);
    if (keys.size !== rows.length) problems.push(`${lang}: ${rows.length - keys.size} duplicate (surah, ayah)`);
    const missing = [...verseKeys].filter((k) => !keys.has(k));
    if (missing.length) problems.push(`${lang}: no translation for ${missing.length} ayahs, e.g. ${missing.slice(0, 3).join(", ")}`);
    const extra = [...keys].filter((k) => !verseKeys.has(k));
    if (extra.length) problems.push(`${lang}: ${extra.length} translations for ayahs not in the mushaf, e.g. ${extra.slice(0, 3).join(", ")}`);
    for (const r of rows) if (!r.text) problems.push(`${lang} ${key(r)}: empty after cleaning`);
  }
  if (problems.length) throw new Error("Quran data does not line up:\n- " + problems.slice(0, 20).join("\n- "));
}

// Turns the three quranpedia dumps into rows for quran_verses and quran_translations, and refuses
// to produce anything if the dumps do not line up (wrong count, a missing or duplicate ayah).
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

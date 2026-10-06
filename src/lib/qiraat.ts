// The canonical readings (the ten qira'at, twenty ruwat) of the words where they differ from Hafs in wording, from
// quranpedia's word-by-word qira'at data (dump qiraat.json.gz, the service /v1/ayah/{s}/{a}/qiraat). A quote is always
// compared with the Hafs mushaf first; a word that differs from Hafs is a misquote only when no canonical reading has
// it: «فَتَثَبَّتُوا» (49:6) is the reading of Hamza, al-Kisa'i and Khalaf, not a mistake (specialist, 2026-10-06).
import { normalizeArabic } from "./arabic";

/** One reader of a reading: the imam of the qira'a and the ruwat who carry this wording from him. */
export interface QiraaReader {
  /** quranpedia's id of the qira'a, 1–10 in the usual order (Nafi' … Khalaf) */
  id: number;
  imam: string;
  ruwat: string[];
}

/** A word of a verse as another canonical reading has it (a row of quran_qiraat). */
export interface QiraaVariant {
  surah: number;
  ayah: number;
  /** the Hafs word, in the search form (normalizeArabic, letters only) */
  hafs_word: string;
  /** the word in the other reading, in the search form */
  variant_word: string;
  /** the word in the other reading as quranpedia writes it, with its marks */
  variant_text: string;
  readers: QiraaReader[];
}

/** A word of the quote that differs from Hafs and is the wording of other canonical readings. */
export interface QiraaMatch {
  typed: string;
  hafs: string;
  readers: QiraaReader[];
}

interface DumpReading {
  qiraa_text: string;
  rewayat: { rawi: { id: number; name: string; qiraa: { id: number; short_name: string } } }[];
}
export interface QiraatDump {
  license?: { version?: string };
  data: { surah: number; ayah: number; qiraat: { ayah_word: string; qiraat: DumpReading[] }[] }[];
}

const cleanWords = (s: string) => normalizeArabic(s).replace(/[^ء-ي\s]/g, " ").split(/\s+/).filter(Boolean);

/** Levenshtein distance of two short strings. */
function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** The same word read another way, not a note about how it is said («بالسين», «اشمام الصاد زايا» are notes). */
const isWordVariant = (hafs: string, variant: string) =>
  hafs !== variant && distance(hafs, variant) <= Math.max(2, Math.ceil(Math.max(hafs.length, variant.length) / 2));

/** Groups the ruwat of a reading by their imam, in the order of the ten and of each imam's two ruwat. */
function readersOf(r: DumpReading[]): QiraaReader[] {
  const byImam = new Map<number, QiraaReader & { order: Map<string, number> }>();
  for (const { rewayat } of r)
    for (const { rawi } of rewayat) {
      const q = byImam.get(rawi.qiraa.id) ?? { id: rawi.qiraa.id, imam: rawi.qiraa.short_name, ruwat: [] as string[], order: new Map<string, number>() };
      if (!q.ruwat.includes(rawi.name)) q.ruwat.push(rawi.name);
      q.order.set(rawi.name, rawi.id);
      byImam.set(rawi.qiraa.id, q);
    }
  return [...byImam.values()]
    .sort((a, b) => a.id - b.id)
    .map(({ order, ...q }) => ({ ...q, ruwat: q.ruwat.sort((x, y) => (order.get(x) ?? 0) - (order.get(y) ?? 0)) }));
}

/**
 * One row per (verse, Hafs word, other wording) where the other wording is a different word, not only another way of
 * saying it (imala, madd, ishmam are left out: the letters are the same). Groups of several words are paired word by
 * word when both sides have the same number of words; others (a word joined or split) are left out.
 */
export function buildQiraatRows(dump: QiraatDump): QiraaVariant[] {
  const rows = new Map<string, QiraaVariant>();
  for (const a of dump.data)
    for (const g of a.qiraat) {
      const forms = new Map<string, { text: string; readings: DumpReading[] }>();
      for (const q of g.qiraat) {
        const m = q.qiraa_text.match(/\(([^)]+)\)/);
        if (!m) continue;
        const key = cleanWords(m[1]).join(" ");
        if (!key) continue;
        const f = forms.get(key) ?? { text: m[1].trim(), readings: [] };
        f.readings.push(q);
        forms.set(key, f);
      }
      // Hafs's wording: his reading's word when it is one, else the mushaf's own word (his entry can be a note, «بالصاد»)
      const mushafKey = cleanWords(g.ayah_word).join(" ");
      const hafsEntry = [...forms.entries()].find(([, f]) => f.readings.some((q) => q.rewayat.some((r) => r.rawi.name === "حفص")))?.[0];
      const hafsKey = hafsEntry && (hafsEntry === mushafKey || isWordVariant(mushafKey, hafsEntry)) ? hafsEntry : mushafKey;
      const hafs = hafsKey.split(" ");
      for (const [key, f] of forms) {
        if (key === hafsKey) continue;
        const other = key.split(" ");
        const shown = f.text.split(/\s+/);
        if (other.length !== hafs.length || shown.length !== other.length) continue;
        const readers = readersOf(f.readings);
        const mushaf = mushafKey.split(" ");
        other.forEach((w, i) => {
          // like Hafs's word and like the mushaf's: a note («بالسين») is like neither
          if (!isWordVariant(hafs[i], w) || (mushaf.length === hafs.length && w !== mushaf[i] && !isWordVariant(mushaf[i], w))) return;
          const id = `${a.surah}:${a.ayah}:${hafs[i]}:${w}`;
          const row = rows.get(id);
          if (row) {
            for (const r of readers) {
              const q = row.readers.find((x) => x.id === r.id);
              if (!q) row.readers.push(r);
              else for (const n of r.ruwat) if (!q.ruwat.includes(n)) q.ruwat.push(n);
            }
            row.readers.sort((x, y) => x.id - y.id);
          } else rows.set(id, { surah: a.surah, ayah: a.ayah, hafs_word: hafs[i], variant_word: w, variant_text: shown[i], readers });
        });
      }
    }
  return [...rows.values()];
}

/**
 * The words of a quote that differ from Hafs only as other canonical readings have them. `diffs` are the replaced words
 * of the comparison with the Hafs text (typed word, Hafs word as shown); a diff is explained when a reading of these
 * verses has the typed word in place of that Hafs word.
 */
export function explainByQiraat(
  diffs: { typed: string; correct: string }[],
  variants: QiraaVariant[],
): { explained: QiraaMatch[]; rest: number[] } {
  const explained: QiraaMatch[] = [];
  const rest: number[] = [];
  diffs.forEach((d, i) => {
    const typed = cleanWords(d.typed).join("");
    const hafs = cleanWords(d.correct).join("");
    const v = variants.find((x) => x.hafs_word === hafs && x.variant_word === typed);
    if (v) explained.push({ typed: d.typed, hafs: d.correct, readers: v.readers });
    else rest.push(i);
  });
  return { explained, rest };
}

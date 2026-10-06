// Builds and validates the Quran rows from .cache/quran/ (run fetch-quran-data.ts first) and loads them into Supabase.
//
//   npx tsx scripts/ingest-quran.ts --dry-run                       build + validate, write .cache/quran/rows.json
//                                                                   (with the Uthmani and IndoPak script texts)
//   npx tsx --env-file=.env.local scripts/ingest-quran.ts           the same, then upsert into Supabase
//   npx tsx --env-file=.env.local scripts/ingest-quran.ts --scripts the same checks, then load only the script texts:
//                                                                   two data_sources rows (mushafs 2 and 3) and
//                                                                   quran_verse_scripts; quran_verses and
//                                                                   quran_translations are not sent at all
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for the real load (migrations 001 and 002 applied;
// 007 as well for --scripts).
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { restHeaders } from "../src/lib/supabaseRest";
import {
  buildScriptRows,
  buildTranslationRows,
  buildVerseRows,
  validateQuranRows,
  validateScriptRows,
  type MushafDump,
  type TranslationDump,
} from "../src/lib/quranData";

const DIR = ".cache/quran";
const dryRun = process.argv.includes("--dry-run");
const scriptsOnly = process.argv.includes("--scripts");

const read = <T>(name: string): T => JSON.parse(readFileSync(`${DIR}/${name}`, "utf-8"));
const readMushaf = (n: number): MushafDump => JSON.parse(gunzipSync(readFileSync(`${DIR}/mushafs-${n}.json.gz`)).toString("utf-8"));
const mushaf = readMushaf(1);
const sums = read<{ mushaf_version: string | null; sha256: Record<string, string> }>("SHA256SUMS.json");

const QURANPEDIA = "https://quranpedia.net";
const ver = sums.mushaf_version ?? "unknown";
const attribution = `Source: Quranpedia.net (${QURANPEDIA}), dump version ${ver}.`;
const sources = [
  {
    id: "quranpedia-mushaf-1",
    title: "مصحف حفص (Quran text, Hafs from 'Asim)",
    publisher: "Quranpedia.net",
    url: `${QURANPEDIA}/dumps/mushafs-1.json.gz`,
    version: ver,
    sha256: sums.sha256["mushafs-1.json.gz"],
    license: "Quranpedia data license: free inside apps; republishing as a dataset needs credit, link and version",
    attribution,
  },
  {
    id: "quranpedia-translation-1966",
    title: "Urdu translation by Muhammad Junagarhi (King Fahd Complex)",
    publisher: "King Fahd Complex for the Printing of the Holy Quran, via Quranpedia.net",
    url: `${QURANPEDIA}/translation-books/1966.json`,
    version: ver,
    sha256: sums.sha256["1966.json"],
    license: "Translation remains the property of its author and publisher; used inside the app under the Quranpedia data license",
    attribution,
  },
  {
    id: "quranpedia-translation-1948",
    title: "English translation by Hilali and Khan (King Fahd Complex)",
    publisher: "King Fahd Complex for the Printing of the Holy Quran, via Quranpedia.net",
    url: `${QURANPEDIA}/translation-books/1948.json`,
    version: ver,
    sha256: sums.sha256["1948.json"],
    license: "Translation remains the property of its author and publisher; used inside the app under the Quranpedia data license",
    attribution,
  },
];

const verses = buildVerseRows(mushaf, "quranpedia-mushaf-1");
const translations = [
  ...buildTranslationRows(read<TranslationDump>("1966.json"), "ur", "quranpedia-translation-1966"),
  ...buildTranslationRows(read<TranslationDump>("1948.json"), "en", "quranpedia-translation-1948"),
];
validateQuranRows(verses, translations);
console.log(`OK: ${verses.length} ayahs in ${new Set(verses.map((v) => v.surah)).size} surahs, ${translations.length} translations (ur + en).`);

// The same text in the Uthmani and IndoPak scripts, for matching copied quotes. Dry run only: there is no table for
// these rows yet, so they are written to rows.json and never sent to Supabase.
const scriptSources = [
  { n: 2, script: "uthmani" as const, title: "مصحف حفص نسخة نصية (Hafs, Uthmani script, King Fahd Complex)" },
  { n: 3, script: "indopak" as const, title: "مصحف حفص نستعليق (Hafs, IndoPak Nastaleeq, King Fahd Complex)" },
].map(({ n, script, title }) => ({
  script,
  source: {
    id: `quranpedia-mushaf-${n}`,
    title,
    publisher: "Quranpedia.net",
    url: `${QURANPEDIA}/dumps/mushafs-${n}.json.gz`,
    version: readMushaf(n).license?.version ?? ver,
    sha256: sums.sha256[`mushafs-${n}.json.gz`],
    license: sources[0].license,
    attribution,
  },
  n,
}));
const scripts = scriptSources.flatMap(({ n, script, source }) => buildScriptRows(readMushaf(n), script, source.id));
validateScriptRows(scripts, verses);
for (const { script } of scriptSources) console.log(`OK: ${scripts.filter((r) => r.script === script).length} ayahs in the ${script} script, aligned with the standard text.`);
writeFileSync(`${DIR}/rows.json`, JSON.stringify({ sources, verses, translations, scriptSources: scriptSources.map((s) => s.source), scripts }));

async function upsert(table: string, rows: object[], conflict: string, base: string, key: string) {
  for (let i = 0; i < rows.length; i += 500) {
    const res = await fetch(`${base}/rest/v1/${table}?on_conflict=${conflict}`, {
      method: "POST",
      headers: { ...restHeaders(key), Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows.slice(i, i + 500)),
    });
    if (!res.ok) throw new Error(`${table}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
  console.log(`  ${table}: ${rows.length} rows upserted`);
}

async function main() {
  if (dryRun) {
    console.log("Dry run: rows written to .cache/quran/rows.json, nothing sent to Supabase.");
    return;
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or use --dry-run).");
  if (scriptsOnly) {
    // Only the script texts: their two sources, then their rows. The rows already loaded (quran_verses,
    // quran_translations and the other data_sources rows) are left exactly as they are.
    const ids = scriptSources.map((s) => s.source.id);
    if (ids.join() !== "quranpedia-mushaf-2,quranpedia-mushaf-3") throw new Error(`--scripts would write data_sources rows ${ids.join(", ")}`);
    await upsert("data_sources", scriptSources.map((s) => s.source), "id", base, key);
    try {
      await upsert("quran_verse_scripts", scripts, "surah,ayah,script", base, key);
    } catch (e) {
      throw new Error(`${(e as Error).message}
Is migration 007_quran_verse_scripts.sql applied?`);
    }
    console.log("Loaded the script texts; quran_verses and quran_translations were not touched.");
    return;
  }
  // Parents before children: sources, then verses, then translations.
  await upsert("data_sources", sources, "id", base, key);
  await upsert("quran_verses", verses, "surah,ayah", base, key);
  await upsert("quran_translations", translations, "surah,ayah,lang", base, key);
  console.log("Loaded.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

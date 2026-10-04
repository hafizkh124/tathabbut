// Builds and validates the Quran rows from .cache/quran/ (run fetch-quran-data.ts first) and loads them into Supabase.
//
//   npx tsx scripts/ingest-quran.ts --dry-run                       build + validate, write .cache/quran/rows.json
//   npx tsx --env-file=.env.local scripts/ingest-quran.ts           the same, then upsert into Supabase
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for the real load (migrations 001 and 002 applied).
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { restHeaders } from "../src/lib/supabaseRest";
import { buildTranslationRows, buildVerseRows, validateQuranRows, type MushafDump, type TranslationDump } from "../src/lib/quranData";

const DIR = ".cache/quran";
const dryRun = process.argv.includes("--dry-run");

const read = <T>(name: string): T => JSON.parse(readFileSync(`${DIR}/${name}`, "utf-8"));
const mushaf: MushafDump = JSON.parse(gunzipSync(readFileSync(`${DIR}/mushafs-1.json.gz`)).toString("utf-8"));
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
writeFileSync(`${DIR}/rows.json`, JSON.stringify({ sources, verses, translations }));

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

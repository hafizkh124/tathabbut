// Loads the words of the other canonical readings into quran_qiraat (migration 010).
//   npx tsx scripts/load-qiraat.ts --dry-run                     download (or reuse .cache/quran/qiraat.json.gz) and build
//   npx tsx --env-file=.env.local scripts/load-qiraat.ts         the same, then one data_sources row and the rows
// The dump stays in .cache/ (ignored by git): it is quranpedia's data and is not republished here.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { createHash } from "crypto";
import { gunzipSync } from "zlib";
import { buildQiraatRows, type QiraatDump } from "../src/lib/qiraat";
import { restHeaders } from "../src/lib/supabaseRest";

const DIR = ".cache/quran";
const FILE = `${DIR}/qiraat.json.gz`;
const URL = "https://quranpedia.net/dumps/qiraat.json.gz";
const UA = "Tathabbut/0.1 (+https://github.com/hafizkh124/tathabbut)";
const SOURCE_ID = "quranpedia-qiraat";

async function main() {
  if (!existsSync(FILE)) {
    mkdirSync(DIR, { recursive: true });
    const res = await fetch(URL, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`${URL} -> HTTP ${res.status}`);
    writeFileSync(FILE, Buffer.from(await res.arrayBuffer()));
  }
  const buf = readFileSync(FILE);
  const dump = JSON.parse(gunzipSync(buf).toString("utf-8")) as QiraatDump;
  const rows = buildQiraatRows(dump);
  const verses = new Set(rows.map((r) => `${r.surah}:${r.ayah}`)).size;
  console.log(`OK: ${rows.length} words of other readings in ${verses} verses (dump version ${dump.license?.version}).`);
  if (!rows.some((r) => r.surah === 49 && r.ayah === 6 && r.variant_word === "فتثبتوا")) throw new Error("49:6 «فتثبتوا» is missing");
  if (process.argv.includes("--dry-run")) return;

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or use --dry-run).");
  const upsert = async (table: string, body: object[], conflict: string) => {
    for (let i = 0; i < body.length; i += 500) {
      const res = await fetch(`${base}/rest/v1/${table}?on_conflict=${conflict}`, {
        method: "POST",
        headers: { ...restHeaders(key), Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(body.slice(i, i + 500)),
      });
      if (!res.ok) throw new Error(`${table}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
    }
    console.log(`  ${table}: ${body.length} rows upserted`);
  };
  await upsert(
    "data_sources",
    [
      {
        id: SOURCE_ID,
        title: "القراءات في كل آية (the ten qira'at, word by word)",
        publisher: "Quranpedia.net",
        url: URL,
        version: dump.license?.version ?? null,
        sha256: createHash("sha256").update(buf).digest("hex"),
        license: "Quranpedia data license: free inside apps; republishing as a dataset needs credit, link and version",
        attribution: `Source: Quranpedia.net (https://quranpedia.net), dump version ${dump.license?.version}.`,
      },
    ],
    "id",
  );
  await upsert("quran_qiraat", rows.map((r) => ({ ...r, source_id: SOURCE_ID })), "surah,ayah,hafs_word,variant_word");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  console.error("Is migration 010_quran_qiraat.sql applied?");
  process.exit(1);
});

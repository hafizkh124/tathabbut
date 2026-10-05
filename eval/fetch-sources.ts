// Optional: refreshes the hadith source rows from Hugging Face (quranlab/hadith) with their FULL texts, so the builder is
// not limited by the 280-character cut of sources/v1-snapshot.json (which left only 28 hadith with every grader agreeing
// on «weak»). Needs network access to datasets-server.huggingface.co.
//
//   npx tsx eval/fetch-sources.ts            # writes eval/sources/hf-rows.json
//   npx tsx eval/build-dataset.ts            # then uses it instead of the snapshot's hadith items
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(__dirname, "sources", "hf-rows.json");
const CONFIGS: Array<{ config: string; collection: string; max: number }> = [
  { config: "bukhari-ar", collection: "bukhari", max: 1500 },
  { config: "muslim-ar", collection: "muslim", max: 1500 },
  { config: "tirmidhi-ar", collection: "tirmidhi", max: 4000 },
  { config: "abudawud-ar", collection: "abudawud", max: 5300 },
  { config: "ibnmajah-ar", collection: "ibnmajah", max: 4400 },
];

interface Row {
  hadith_number?: string;
  collection?: string;
  text?: string;
  grade?: string;
  grade_summary?: string;
}

export interface SourceRow {
  collection: string;
  hadithNumber?: string;
  text: string;
  grade?: string;
  graders?: string;
}

async function fetchConfig(config: string, max: number): Promise<Row[]> {
  const out: Row[] = [];
  for (let offset = 0; offset < max; offset += 100) {
    const url = `https://datasets-server.huggingface.co/rows?dataset=quranlab/hadith&config=${config}&split=train&offset=${offset}&limit=100`;
    let res: Response | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch(url).catch(() => undefined);
      if (res?.ok) break;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
    if (!res?.ok) throw new Error(`${config} offset ${offset}: HTTP ${res?.status ?? "network error"}`);
    const data = (await res.json()) as { rows?: Array<{ row: Row }> };
    if (!data.rows?.length) break;
    out.push(...data.rows.map((r) => r.row));
    process.stdout.write(`\r${config}: ${out.length}`);
  }
  process.stdout.write("\n");
  return out;
}

async function main() {
  const rows: SourceRow[] = [];
  for (const c of CONFIGS) {
    for (const r of await fetchConfig(c.config, c.max)) {
      if (!r.text) continue;
      rows.push({ collection: c.collection, hadithNumber: r.hadith_number, text: r.text, grade: r.grade, graders: r.grade_summary });
    }
  }
  writeFileSync(OUT, JSON.stringify(rows));
  console.log(`wrote ${rows.length} rows to ${OUT}`);
}

if (require.main === module) main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// Downloads the three quranpedia dumps into .cache/quran/ (ignored by git: the dumps are not republished here)
// and records the SHA-256 of what we got. The page lists a SHA-256 for the mushaf only, so that one is checked;
// for the translations the hash is our own record of the file we loaded.
//
//   npx tsx scripts/fetch-quran-data.ts
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const UA = "Tathabbut/0.1 (Islamic AI Challenge 2026; hafizkh124@gmail.com)";
const OUT = ".cache/quran";

/** quranpedia's own dump page links the translations as http://localhost/..., so these are the working URLs. */
const FILES = [
  { name: "mushafs-1.json.gz", url: "https://quranpedia.net/dumps/mushafs-1.json.gz", publishedSha256: "4bd77b139076b487136e7deffda10edb1f4478b553511ddb14e0c9311c5802d3" },
  { name: "1966.json", url: "https://quranpedia.net/translation-books/1966.json" },
  { name: "1948.json", url: "https://quranpedia.net/translation-books/1948.json" },
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const sums: Record<string, string> = {};
  for (const f of FILES) {
    const res = await fetch(f.url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`${f.url} -> HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const sha = createHash("sha256").update(buf).digest("hex");
    if (f.publishedSha256 && sha !== f.publishedSha256) {
      throw new Error(
        `${f.name}: SHA-256 is ${sha}, but quranpedia's page listed ${f.publishedSha256}.\n` +
          "The dump may have been corrected since; check https://quranpedia.net/dumps, then update publishedSha256 here.",
      );
    }
    writeFileSync(`${OUT}/${f.name}`, buf);
    sums[f.name] = sha;
    console.log(`${f.name}  ${(buf.length / 1024).toFixed(0)} KB  sha256 ${sha.slice(0, 16)}…${f.publishedSha256 ? "  (matches the published hash)" : ""}`);
    await new Promise((r) => setTimeout(r, 1_000));
  }
  const mushaf = JSON.parse(gunzipSync(readFileSync(`${OUT}/mushafs-1.json.gz`)).toString("utf-8"));
  const meta = { fetched_at: new Date().toISOString(), mushaf_version: mushaf.license?.version ?? null, sha256: sums };
  writeFileSync(`${OUT}/SHA256SUMS.json`, JSON.stringify(meta, null, 2));
  console.log(`Saved ${OUT}/SHA256SUMS.json (dump version ${meta.mushaf_version}).`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

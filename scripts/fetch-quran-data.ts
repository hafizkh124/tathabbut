// Downloads the quranpedia dumps (three mushafs, two translations) into .cache/quran/ (ignored by git: the dumps are not republished here)
// and records the SHA-256 of what we got. The page lists a SHA-256 for the mushafs only, so those are checked;
// for the translations the hash is our own record of the file we loaded.
//
//   npx tsx scripts/fetch-quran-data.ts
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const UA = "Tathabbut/0.1 (+https://github.com/hafizkh124/tathabbut)";
const OUT = ".cache/quran";

/** quranpedia's own dump page links the translations as http://localhost/..., so these are the working URLs. */
const FILES = [
  // Dump version 2026-10-06 (rebuilt by quranpedia; the ayah text is unchanged from the version loaded before).
  { name: "mushafs-1.json.gz", url: "https://quranpedia.net/dumps/mushafs-1.json.gz", publishedSha256: "18ecddb19fbab73f38b9f869cf4ca1f33796edcfdf055fa53985992c12c02c4d" },
  // The same Hafs text in the Uthmani script (KFGQPC encoding) and in IndoPak Nastaleeq, for matching copied quotes.
  { name: "mushafs-2.json.gz", url: "https://quranpedia.net/dumps/mushafs-2.json.gz", publishedSha256: "dbe17e974462784f74cb7df9ea82d215b500cc146295fde6dbc9a76509fa5b4f" },
  { name: "mushafs-3.json.gz", url: "https://quranpedia.net/dumps/mushafs-3.json.gz", publishedSha256: "71441f2e39cda48e487a1049cc037083afcd525b228e962d937b7aac51081ce0" },
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

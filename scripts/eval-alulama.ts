// Runs eval/alulama-set.json against our copy of العلماء (needs migration 014 and the first full copy) and prints what each query
// finds, for the specialist to read. A query marked "none" must find nothing; one marked "found" should find the right matter.
//
//   npx tsx --env-file=.env.local scripts/eval-alulama.ts [--min 0.55]
import { readFileSync } from "node:fs";
import { matchAlulama } from "../src/lib/alulamaMatch";
import type { AlulamaKind } from "../src/lib/alulama";

const i = process.argv.indexOf("--min");
const minScore = i >= 0 ? Number(process.argv[i + 1]) : undefined;
const set = JSON.parse(readFileSync(new URL("../eval/alulama-set.json", import.meta.url), "utf8")) as { kind: AlulamaKind; query: string; expect: "found" | "none" }[];

async function main() {
  let noiseShown = 0;
  let noise = 0;
  let found = 0;
  let inScope = 0;
  for (const c of set) {
    const hits = await matchAlulama(c.query, c.kind, { minScore });
    const mark = c.expect === "none" ? (hits.length ? "NOISE" : "ok   ") : hits.length ? "found" : "MISS ";
    if (c.expect === "none") {
      noise++;
      if (hits.length) noiseShown++;
    } else {
      inScope++;
      if (hits.length) found++;
    }
    console.log(`${mark} [${c.kind}] ${c.query}`);
    for (const h of hits) console.log(`        ${h.score.toFixed(2)}  ${h.title}`);
  }
  console.log(`\nin scope: ${found}/${inScope} found · unrelated: ${noiseShown}/${noise} showed a card (must be 0)`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// Fills a local cache of Dorar answers for a list of queries (one per line), run from a machine whose
// IP dorar.net accepts (Vercel's data-centre IPs get a 403). Only the questions we actually ask are
// cached, as the plan says. The output stays out of git (.cache/ is ignored).
//
//   npx tsx scripts/warm-dorar-cache.ts <queries.txt> [out.jsonl]
//
// One line per query in out.jsonl: {"query_clean","query","results","fetched_at"}. Re-running skips
// queries already cached, so it can be stopped and resumed.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { normalizeArabic } from "../src/lib/arabic";
import { searchDorar } from "../src/lib/dorar";

const DELAY_MS = 3_000; // be gentle with dorar.net
const MAX_CONSECUTIVE_FAILURES = 3; // stop instead of hammering a server that keeps refusing

const [queriesPath, outPath = ".cache/dorar/cache.jsonl"] = process.argv.slice(2);
if (!queriesPath) {
  console.error("usage: npx tsx scripts/warm-dorar-cache.ts <queries.txt> [out.jsonl]");
  process.exit(1);
}

const queries = [...new Set(readFileSync(queriesPath, "utf-8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean))];
mkdirSync(dirname(outPath), { recursive: true });
const done = new Set<string>();
if (existsSync(outPath)) {
  for (const line of readFileSync(outPath, "utf-8").split("\n")) {
    if (line.trim()) done.add(JSON.parse(line).query_clean);
  }
}

async function main() {
let failures = 0;
let fetched = 0;
for (const [i, query] of queries.entries()) {
  const key = normalizeArabic(query);
  if (done.has(key)) continue;
  const r = await searchDorar(query);
  if (r.ok) {
    failures = 0;
    fetched++;
    appendFileSync(
      outPath,
      JSON.stringify({ query_clean: key, query, results: r.results, fetched_at: new Date().toISOString() }) + "\n",
    );
    console.log(`[${i + 1}/${queries.length}] ${r.results.length} results  ${query.slice(0, 40)}`);
  } else {
    // "empty" is an answer (nothing found); anything else is a failure of the call itself.
    if (r.error === "empty") {
      failures = 0;
      console.log(`[${i + 1}/${queries.length}] no results  ${query.slice(0, 40)}`);
    } else {
      failures++;
      console.warn(`[${i + 1}/${queries.length}] FAILED ${r.error} ${r.detail ?? ""}  ${query.slice(0, 40)}`);
      if (failures >= MAX_CONSECUTIVE_FAILURES) {
        console.error(`Stopping after ${failures} failures in a row; re-run later to resume.`);
        process.exit(2);
      }
    }
  }
  await new Promise((res) => setTimeout(res, DELAY_MS));
}
console.log(`Done. ${fetched} new answers cached in ${outPath}.`);
}

main();

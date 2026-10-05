// Is any test text already in the specialist's list (circulating_sayings)? docs/07 §7.1: the test set's answers must not
// live in that list, or the tool «would simply return its own answers». Needs the Supabase settings of .env.local.
//
//   npx tsx --env-file=.env.local eval/check-leakage.ts      # → eval/sources/leakage.json and a summary
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { matchSayings } from "../src/lib/sayingsMatch";
import type { EvalPrompt } from "./types";

const SAYING_MIN = 0.6; // the threshold verify.ts uses

async function main() {
  const data = JSON.parse(readFileSync(join(__dirname, "dataset.json"), "utf8")) as EvalPrompt[];
  const texts = new Map<string, string[]>();
  for (const p of data) for (const c of p.expectedClaims) if (c.kind !== "quran" && c.kind !== "question") texts.set(c.quotedText, [...(texts.get(c.quotedText) ?? []), p.category]);
  const hits: Array<{ text: string; categories: string[]; listText: string; status: string; score: number }> = [];
  let i = 0;
  for (const [text, cats] of texts) {
    const [h] = (await matchSayings(text)).filter((x) => x.score >= SAYING_MIN);
    if (h) hits.push({ text, categories: [...new Set(cats)], listText: h.text_ar, status: h.status, score: h.score });
    if (++i % 50 === 0) console.log(`${i}/${texts.size}`);
  }
  writeFileSync(join(__dirname, "sources", "leakage.json"), JSON.stringify(hits, null, 1));
  const by = new Map<string, number>();
  for (const h of hits) for (const c of h.categories) by.set(c, (by.get(c) ?? 0) + 1);
  console.log(`${hits.length} of ${texts.size} texts are in the specialist's list:`, Object.fromEntries(by));
  console.log("Their results are reported as «answered from the specialist's own list»; for a verification figure, remove them or move them to the dev split.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

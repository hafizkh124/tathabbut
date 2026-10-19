// Measures the AI-free fast path (src/lib/fastPath.ts) on the evaluation prompts WITHOUT calling the model: for each prompt the
// fast path answers, the answer is scored against the specialist's labels exactly as the normal evaluation does. Prompts it does
// not answer would go to the model and are only counted. Keep the fast path only if what it answers is at least as accurate as
// the normal path (docs/results.md) and fabricated attributions stay 0.
//
//   npx tsx --env-file=.env.local eval/fastpath-offline.ts --dataset ../tathabbut/eval/dataset.json --baseline <a run folder's results.json> [--sample 15]
import { readFileSync } from "node:fs";
import { supabaseDorarCache } from "../src/lib/dorarCache";
import { EVAL_RUN_ENV } from "../src/lib/evalRun";
import { fastPath } from "../src/lib/fastPath";
import { lookupDorar } from "../src/lib/lookup";
import { fetchVerseQiraat, fetchVerseScripts, matchVerses, matchVersesInText } from "../src/lib/quranCheck";
import { matchSayings } from "../src/lib/sayingsMatch";
import { selectPrompts } from "./run-eval";
import { scorePrompt } from "./scoring";
import type { ActualClaim, EvalPrompt } from "./types";

process.env[EVAL_RUN_ENV] = "1";
const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

async function main() {
  const path = arg("dataset") ?? new URL("./dataset.json", import.meta.url).pathname;
  const dataset = JSON.parse(readFileSync(path, "utf8")) as EvalPrompt[];
  const prompts = selectPrompts(dataset, { split: "test", sample: arg("sample") ? Number(arg("sample")) : 15, all: process.argv.includes("--all"), seed: 20261005, includeConflicts: false, categories: undefined });
  const cache = supabaseDorarCache();
  const deps = {
    matchVerses: (q: string) => matchVerses(q),
    matchVersesInText: (q: string) => matchVersesInText(q),
    verseScripts: (k: { surah: number; ayah: number }[]) => fetchVerseScripts(k),
    verseQiraat: (k: { surah: number; ayah: number }[]) => fetchVerseQiraat(k),
    matchSayings: (q: string) => matchSayings(q),
    lookupDorar: (q: string) => lookupDorar(q, { cache }),
  };

  // the normal path's result on the same prompts, from a saved run: what the fast path must not be worse than
  const base = new Map<string, boolean>();
  const baseFile = arg("baseline");
  if (baseFile) for (const r of (JSON.parse(readFileSync(baseFile, "utf8")) as { results: { promptId: string; success: boolean }[] }).results) base.set(r.promptId, r.success);
  let baseOk = 0;
  let baseSeen = 0;
  let answered = 0;
  let ok = 0;
  let fabricated = 0;
  const byCategory: Record<string, { n: number; answered: number; ok: number }> = {};
  const wrong: string[] = [];
  for (const p of prompts) {
    const c = (byCategory[p.category] ??= { n: 0, answered: 0, ok: 0 });
    c.n++;
    if (p.image) continue;
    const t0 = Date.now();
    const results = await fastPath(p.prompt, deps);
    if (!results) continue;
    answered++;
    c.answered++;
    const b = base.get(p.id);
    if (b !== undefined) {
      baseSeen++;
      if (b) baseOk++;
    }
    const s = scorePrompt(p, results as unknown as ActualClaim[]);
    if (s.success) {
      ok++;
      c.ok++;
    } else wrong.push(`${p.id} [${p.category}]${b ? " (the normal path got it right)" : ""} ${p.prompt.slice(0, 70)} → ${results[0].state} (${Date.now() - t0} ms)`);
    fabricated += s.fabrications.length;
  }
  console.log(`prompts ${prompts.length} · answered without AI ${answered} (${((answered / prompts.length) * 100).toFixed(1)}%) · of those correct ${ok}/${answered} · fabricated ${fabricated}`);
  if (baseSeen) console.log(`the normal path, on the same ${baseSeen} prompts: ${baseOk}/${baseSeen} correct`);
  console.table(byCategory);
  if (wrong.length) console.log("answered but not matching the label:\n  " + wrong.join("\n  "));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

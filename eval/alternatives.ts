// The go / no-go gate of the sahih alternative (src/lib/alternative.ts): runs it over texts that do not hold (the specialist's list of
// circulating sayings, and the weak hadith of the evaluation set) and writes a CSV with the alternative found for each, for the
// specialist to mark. Go only if at least 80% of the alternatives SHOWN are marked «same meaning» and none is clearly wrong; the empty
// ones (the system chose to show nothing) are not wrong.
//
//   npx tsx --env-file=.env.local eval/alternatives.ts --out alternatives.csv [--dataset ../tathabbut/eval/dataset.json] [--limit 60]
import { readFileSync, writeFileSync } from "node:fs";
import { findAlternative } from "../src/lib/alternative";
import { serviceConfig, restHeaders } from "../src/lib/supabaseRest";
import type { EvalPrompt } from "./types";

const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const csv = (v: string | undefined) => `"${(v ?? "").replace(/"/g, '""').replace(/\s+/g, " ")}"`;

async function sayings(): Promise<{ text: string; from: string }[]> {
  const cfg = serviceConfig();
  if (!cfg) return [];
  const res = await fetch(`${cfg.url}/rest/v1/circulating_sayings?select=text_ar,status&order=id.asc`, { headers: restHeaders(cfg.key) });
  if (!res.ok) throw new Error(`circulating_sayings: HTTP ${res.status}`);
  return ((await res.json()) as { text_ar: string; status: string }[]).filter((r) => /ضعيف|موضوع|خطأ|لا أصل|باطل/.test(r.status)).map((r) => ({ text: r.text_ar, from: `list: ${r.status}` }));
}

function weakFromDataset(path: string | undefined): { text: string; from: string }[] {
  if (!path) return [];
  const data = JSON.parse(readFileSync(path, "utf8")) as EvalPrompt[];
  return data
    .filter((p) => p.category === "hadith_weak" && p.language === "ar" && p.split === "test")
    .map((p) => ({ text: p.expectedClaims[0]?.quotedText ?? p.prompt, from: "eval: hadith_weak" }));
}

async function main() {
  const limit = Number(arg("limit") ?? 60);
  const items = [...(await sayings()), ...weakFromDataset(arg("dataset"))].filter((i) => /[ء-ي]/.test(i.text) && i.text.split(/\s+/).length >= 3).slice(0, limit);
  const lines = ["text,from,alternative,source,reference,marked (same meaning / wrong / none shown)"];
  let shown = 0;
  for (const [i, it] of items.entries()) {
    let alt = null;
    try {
      alt = await findAlternative(it.text);
    } catch (e) {
      console.error(`#${i + 1} failed: ${(e as Error).message.slice(0, 120)}`);
    }
    if (alt) shown++;
    console.log(`${String(i + 1).padStart(2)} ${alt ? "SHOWN" : "none "} ${it.text.slice(0, 60)}${alt ? `\n        → ${alt.matn.slice(0, 90)} (${alt.source} ${alt.reference ?? ""})` : ""}`);
    lines.push([csv(it.text), csv(it.from), csv(alt?.matn), csv(alt?.source), csv(alt?.reference), ""].join(","));
  }
  writeFileSync(arg("out") ?? "alternatives.csv", "﻿" + lines.join("\n"), "utf8");
  console.log(`\n${items.length} texts · an alternative shown for ${shown} · written to ${arg("out") ?? "alternatives.csv"}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

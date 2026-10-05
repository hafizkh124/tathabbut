// Relevance and citation labels for the Turath step (docs/10 decision 7: precision@10 and citation correctness on a
// labelled set). A run records every passage the screen would show; a person marks each one.
//
//   npx tsx eval/turath-labels.ts export eval/runs/<run>     # → <run>/turath-labels.xlsx
//   npx tsx eval/turath-labels.ts score  eval/runs/<run>/turath-labels.xlsx
//
// relevant: 1 = the passage is about the asked text/topic, 0 = not. citation_ok: 1 = the book, author, page and link
// lead to this passage, 0 = they do not. precision@10 = relevant passages among the first ten shown, per lookup, averaged.
import ExcelJS from "exceljs";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PromptEvalResult } from "./types";

async function exportLabels(runDir: string) {
  const { results } = JSON.parse(readFileSync(join(runDir, "results.json"), "utf8")) as { results: PromptEvalResult[] };
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("passages", { views: [{ state: "frozen", ySplit: 1, rightToLeft: true }] });
  ws.columns = [
    { header: "prompt", key: "prompt", width: 26 },
    { header: "lookup kind", key: "kind", width: 12 },
    { header: "asked (text or topic)", key: "query", width: 40 },
    { header: "rank", key: "rank", width: 6 },
    { header: "book", key: "book", width: 30 },
    { header: "citation", key: "citation", width: 40 },
    { header: "link", key: "url", width: 36 },
    { header: "excerpt", key: "excerpt", width: 90 },
    { header: "relevant (1/0)", key: "relevant", width: 12 },
    { header: "citation_ok (1/0)", key: "citation_ok", width: 14 },
    { header: "note", key: "note", width: 30 },
  ];
  let n = 0;
  for (const r of results) {
    for (const t of r.turath) {
      t.references.slice(0, 10).forEach((ref, i) => {
        ws.addRow({ prompt: r.promptId, kind: t.kind, query: t.query, rank: i + 1, book: ref.book?.title ?? "", citation: ref.citation ?? "", url: ref.url ?? "", excerpt: ref.excerpt.slice(0, 1500) });
        n++;
      });
    }
  }
  ws.getRow(1).font = { bold: true };
  for (let r = 2; r <= ws.rowCount; r++) for (const c of ["I", "J"]) ws.getCell(`${c}${r}`).dataValidation = { type: "list", allowBlank: true, formulae: ['"1,0"'] };
  const out = join(runDir, "turath-labels.xlsx");
  await wb.xlsx.writeFile(out);
  console.log(`wrote ${n} passages to ${out}`);
}

async function score(path: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const ws = wb.getWorksheet("passages");
  if (!ws) throw new Error("no «passages» sheet");
  const lookups = new Map<string, { kind: string; rel: number[]; cit: number[] }>();
  for (let r = 2; r <= ws.rowCount; r++) {
    const t = (c: string) => String(ws.getCell(`${c}${r}`).text ?? "").trim();
    const key = `${t("A")}|${t("C")}`;
    const l = lookups.get(key) ?? { kind: t("B"), rel: [], cit: [] };
    if (t("I") === "1" || t("I") === "0") l.rel.push(Number(t("I")));
    if (t("J") === "1" || t("J") === "0") l.cit.push(Number(t("J")));
    lookups.set(key, l);
  }
  const lines = ["# Turath relevance and citations", "", "| Lookup kind | Lookups labelled | precision@10 (mean) | Citation correct |", "|---|---|---|---|"];
  for (const kind of [...new Set([...lookups.values()].map((l) => l.kind))]) {
    const ls = [...lookups.values()].filter((l) => l.kind === kind && l.rel.length);
    const p10 = ls.length ? ls.reduce((a, l) => a + l.rel.slice(0, 10).reduce((x, y) => x + y, 0) / Math.min(10, l.rel.length), 0) / ls.length : 0;
    const cits = ls.flatMap((l) => l.cit);
    lines.push(`| ${kind} | ${ls.length} | ${(p10 * 100).toFixed(1)}% | ${cits.length ? ((cits.filter((c) => c === 1).length / cits.length) * 100).toFixed(1) + `% (n=${cits.length})` : "—"} |`);
  }
  const out = path.replace(/\.xlsx$/, ".md");
  writeFileSync(out, lines.join("\n") + "\n");
  console.log(lines.join("\n"));
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === "export" && arg) exportLabels(arg);
else if (cmd === "score" && arg) score(arg);
else console.log("usage: npx tsx eval/turath-labels.ts export <run dir> | score <labels.xlsx>");

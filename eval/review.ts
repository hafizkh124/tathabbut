// The specialist's review of the labels (docs/07-evaluation-plan.md §7.1, §7.4: labels are fixed by the specialist,
// and not changed after the tool has run on them).
//
//   npx tsx eval/review.ts export                       # writes eval/review/labels-review.xlsx (one row per source text)
//   npx tsx eval/review.ts import eval/review/labels-review.xlsx --reviewer "Name"
//
// In the sheet the specialist fills «decision» (approve / correct / reject) and, for «correct», the right state and
// note. Import writes the decisions into dataset.json (label.status, reviewer, date); build-dataset.ts keeps them.
// Labels that are true by construction (mushaf text, a rule-made change, invented texts) are not in the sheet.
import ExcelJS from "exceljs";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { STATES } from "../src/lib/states";
import { propagateReviews } from "./build-dataset";
import { isByConstruction } from "./summary";
import type { EvalPrompt } from "./types";

const DIR = __dirname;
const DATASET = join(DIR, "dataset.json");
const SHEET = join(DIR, "review", "labels-review.xlsx");
const DECISIONS = ["approve", "correct", "reject"];

async function exportSheet() {
  const data = JSON.parse(readFileSync(DATASET, "utf8")) as EvalPrompt[];
  const groups = new Map<string, EvalPrompt[]>();
  for (const p of data) {
    if (isByConstruction(p) || p.category === "multi_claim" || p.category === "ocr_screenshot") continue; // multi-claim and screenshots inherit
    groups.set(p.group, [...(groups.get(p.group) ?? []), p]);
  }
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("labels", { views: [{ state: "frozen", ySplit: 1, rightToLeft: true }] });
  ws.columns = [
    { header: "group", key: "group", width: 22 },
    { header: "category", key: "category", width: 16 },
    { header: "text (as quoted)", key: "text", width: 70 },
    { header: "expected state", key: "state", width: 22 },
    { header: "also accepted", key: "accepted", width: 24 },
    { header: "label source", key: "source", width: 50 },
    { header: "drafted book / scholar / note", key: "draft", width: 40 },
    { header: "CONFLICT", key: "conflict", width: 40 },
    { header: "status", key: "status", width: 12 },
    { header: "decision", key: "decision", width: 12 },
    { header: "corrected state", key: "corrected", width: 22 },
    { header: "reviewer note", key: "note", width: 40 },
    { header: "prompt ids", key: "ids", width: 30 },
  ];
  for (const [group, ps] of groups) {
    const p = ps[0];
    const c = p.expectedClaims[0];
    const m = p.metadata ?? {};
    ws.addRow({
      group,
      category: p.category,
      text: c.quotedText,
      state: c.expectedState,
      accepted: (c.acceptableStates ?? []).join(" | "),
      source: p.label.source,
      draft: [m.draftSource, m.draftScholar, m.draftNote, m.graders].filter(Boolean).join(" · "),
      conflict: (m.conflict as string) ?? "",
      status: p.label.status,
      decision: p.label.status === "unreviewed" ? "" : p.label.status === "approved" ? "approve" : p.label.status === "corrected" ? "correct" : "reject",
      corrected: p.label.status === "corrected" ? c.expectedState : "",
      note: p.label.note ?? "",
      ids: ps.map((x) => x.id).join(" "),
    });
  }
  ws.getRow(1).font = { bold: true };
  const states = [STATES.maqbul, STATES.daif, STATES.shadid, STATES.unsure, STATES.notFound, STATES.fatwa, STATES.fiqh, STATES.verseOk, STATES.verseWrong, STATES.verseContext, STATES.verseTranslated];
  for (let r = 2; r <= ws.rowCount; r++) {
    ws.getCell(`J${r}`).dataValidation = { type: "list", allowBlank: true, formulae: [`"${DECISIONS.join(",")}"`] };
    ws.getCell(`K${r}`).dataValidation = { type: "list", allowBlank: true, formulae: [`"${states.join(",")}"`], showErrorMessage: false };
    if (ws.getCell(`H${r}`).value) ws.getCell(`H${r}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE0E0" } };
  }
  const help = wb.addWorksheet("how to review");
  help.addRows([
    ["One row per source text. Several prompts (wordings) share it; the decision applies to all of them, and to multi-claim posts that quote it."],
    ["decision = approve: the expected state is right · correct: write the right state in «corrected state» (a specialist status from the list is allowed) · reject: the item is unusable and is left out."],
    ["For hadith, the state is what the TOOL should show from Dorar's muhaddithun under the project's grade scheme (docs/04 §4.4), not one scholar's personal view."],
    ["Do not change a label after the tool has been run on the test split (docs/07 §7.4); use the dev split to look at errors."],
  ]);
  mkdirSync(join(DIR, "review"), { recursive: true });
  await wb.xlsx.writeFile(SHEET);
  console.log(`wrote ${groups.size} rows to ${SHEET}`);
}

async function importSheet(path: string, reviewer: string) {
  const data = JSON.parse(readFileSync(DATASET, "utf8")) as EvalPrompt[];
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const ws = wb.getWorksheet("labels");
  if (!ws) throw new Error("no «labels» sheet");
  const today = new Date().toISOString().slice(0, 10);
  const cell = (r: number, c: string) => String(ws.getCell(`${c}${r}`).text ?? "").trim();
  let applied = 0;
  const decided = new Map<string, { decision: string; corrected: string; note: string; text: string }>();
  for (let r = 2; r <= ws.rowCount; r++) {
    const decision = cell(r, "J").toLowerCase();
    if (!decision) continue;
    if (!DECISIONS.includes(decision)) throw new Error(`row ${r}: decision must be ${DECISIONS.join("/")}`);
    const corrected = cell(r, "K");
    if (decision === "correct" && !corrected) throw new Error(`row ${r}: «correct» needs a corrected state`);
    decided.set(cell(r, "A"), { decision, corrected, note: cell(r, "L"), text: cell(r, "C") });
  }
  for (const p of data) {
    const d = decided.get(p.group);
    if (d) {
      p.label = { ...p.label, status: d.decision === "approve" ? "approved" : d.decision === "correct" ? "corrected" : "rejected", reviewer, reviewedAt: today, ...(d.note ? { note: d.note } : {}) };
      if (d.decision === "correct") for (const c of p.expectedClaims) if (c.quotedText === d.text) c.expectedState = d.corrected;
      applied++;
    }
  }
  // multi-claim posts follow the items they quote; screenshots copy their source prompt
  propagateReviews(data);
  const byId = new Map(data.map((p) => [p.id, p]));
  for (const p of data.filter((x) => x.category === "ocr_screenshot")) {
    const src = byId.get(p.id.replace(/^ocr_/, ""));
    if (src) {
      p.label = src.label;
      p.expectedClaims = src.expectedClaims;
    }
  }
  writeFileSync(DATASET, JSON.stringify(data, null, 1) + "\n");
  console.log(`applied ${decided.size} decisions to ${applied} prompts (reviewer: ${reviewer})`);
}

const [cmd, file] = process.argv.slice(2);
const reviewerArg = process.argv.indexOf("--reviewer");
if (cmd === "export") exportSheet();
else if (cmd === "import" && file) importSheet(file, reviewerArg > 0 ? process.argv[reviewerArg + 1] : "specialist").catch((e) => {
  console.error(e.message);
  process.exit(1);
});
else console.log("usage: npx tsx eval/review.ts export | import <xlsx> --reviewer <name>");

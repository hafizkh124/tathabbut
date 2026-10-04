// Loads the approved («معتمد») rows of the specialist's workbook into circulating_sayings (needs migration 004).
//
//   npx tsx scripts/load-sayings.ts "<path to Tathabbut_Circulating_Sayings.xlsx>" --dry-run
//   npx tsx --env-file=.env.local scripts/load-sayings.ts "<path to the workbook>"
//
// Every sheet whose header has a "(text_ar)" column is read. Rows are upserted by text_clean, so re-running after
// further review updates them. A single refused row stops the load before anything is written.
import ExcelJS from "exceljs";
import { mapHeaders, toSayingRow, type SayingRow, type SheetRecord } from "../src/lib/sayingsSheet";
import { restHeaders } from "../src/lib/supabaseRest";

const [path] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const dryRun = process.argv.includes("--dry-run");

const cellText = (v: ExcelJS.CellValue): string => {
  if (v == null) return "";
  if (typeof v === "object" && "richText" in v) return v.richText.map((t) => t.text).join("");
  if (typeof v === "object" && "text" in v) return String(v.text);
  return String(v);
};

async function main() {
  if (!path) throw new Error('usage: npx tsx scripts/load-sayings.ts "<workbook.xlsx>" [--dry-run]');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);

  const rows: SayingRow[] = [];
  const errors: string[] = [];
  for (const ws of wb.worksheets) {
    const headers: string[] = [];
    ws.getRow(1).eachCell({ includeEmpty: true }, (c, col) => (headers[col - 1] = cellText(c.value)));
    const map = mapHeaders(headers);
    if (![...map.values()].includes("text_ar")) continue;
    let approved = 0, skipped = 0;
    for (let r = 2; r <= ws.rowCount; r++) {
      const rec: SheetRecord = {};
      for (const [i, field] of map) rec[field] = cellText(ws.getRow(r).getCell(i + 1).value);
      if (!rec.text_ar?.trim()) continue;
      const out = toSayingRow(rec);
      if ("error" in out) errors.push(`${ws.name} / row ${r}: ${out.error}`);
      else if (out.skip) skipped++;
      else {
        rows.push(out.row);
        approved++;
      }
    }
    console.log(`${ws.name}: ${approved} approved, ${skipped} not approved`);
  }
  const dupes = rows.filter((r, i) => rows.findIndex((x) => x.text_clean === r.text_clean) !== i);
  for (const d of dupes) errors.push(`duplicate text: ${d.text_ar}`);
  if (errors.length) throw new Error("Nothing loaded:\n- " + errors.join("\n- "));

  const byStatus = rows.reduce<Record<string, number>>((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {});
  console.log(`OK: ${rows.length} rows`, byStatus);
  if (dryRun) return console.log("Dry run: nothing sent to Supabase.");

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or use --dry-run).");
  const res = await fetch(`${base}/rest/v1/circulating_sayings?on_conflict=text_clean`, {
    method: "POST",
    headers: { ...restHeaders(key), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 400)}`);
  console.log(`Loaded ${rows.length} sayings.`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

// Copies the questions and answers of العلماء (alulama.org) into alulama_posts (needs migration 014).
//
//   npx tsx scripts/sync-alulama.ts --dry-run                      # reads the site and parses; writes nothing, prints what it found
//   npx tsx scripts/sync-alulama.ts --dry-run --dump rows.json    # the same, and the parsed rows saved to a file
//   npx tsx scripts/sync-alulama.ts --dry-run --pages 3            # only the first 3 pages (100 posts each)
//   npx tsx --env-file=.env.local scripts/sync-alulama.ts          # the first full copy
//   npx tsx --env-file=.env.local scripts/sync-alulama.ts --since 2026-10-15T00:00:00   # only what changed since then
//
// On a machine where Node cannot connect over IPv6, run with NODE_OPTIONS=--dns-result-order=ipv4first.
// One request every 2 seconds, with our own User-Agent. Rows are upserted by the site's post id, so running it again only
// updates. A post the parser finds no answer in is counted and listed, never stored.
import { fetchPosts, getState, setState, toRow, upsertRows, type AlulamaRow } from "../src/lib/alulama";
import { serviceConfig } from "../src/lib/supabaseRest";

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const dryRun = process.argv.includes("--dry-run");
const maxPages = arg("--pages") ? Number(arg("--pages")) : Infinity;
const since = arg("--since");
const dumpTo = arg("--dump"); // also writes every parsed row to this JSON file (for looking at the data offline)
const all: AlulamaRow[] = [];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const cfg = serviceConfig();
  if (!dryRun && !cfg) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or use --dry-run).");

  let page = 1;
  let totalPages = 1;
  let total = 0;
  let seen = 0;
  let newest = since ?? "";
  const skipped: string[] = [];
  const kinds: Record<string, number> = {};
  let bytes = 0;
  let withAnswerer = 0;
  const sample: AlulamaRow[] = [];

  do {
    const { posts, totalPages: tp, total: t } = await fetchPosts({ page, modifiedAfter: since });
    if (page === 1) {
      totalPages = tp;
      total = t;
      console.log(`${total} posts in ${totalPages} pages${since ? ` changed since ${since}` : ""}`);
    }
    const rows: AlulamaRow[] = [];
    for (const wp of posts) {
      seen++;
      const row = toRow(wp);
      if (!row) {
        skipped.push(`${wp.id} ${wp.link}`);
        continue;
      }
      rows.push(row);
      if (dumpTo) all.push(row);
      kinds[row.kind] = (kinds[row.kind] ?? 0) + 1;
      if (row.answerers.length) withAnswerer++;
      bytes += Buffer.byteLength(JSON.stringify(row), "utf8");
      if (row.modified && row.modified > newest) newest = row.modified;
      if (sample.length < 3 && row.kind === "hadith_ruling") sample.push(row);
    }
    if (!dryRun && cfg) await upsertRows(cfg, rows);
    process.stdout.write(`page ${page}/${totalPages}: ${rows.length} rows\r`);
    page++;
    if (page <= totalPages && page <= maxPages) await wait(2_000);
  } while (page <= totalPages && page <= maxPages);

  console.log(`\nread ${seen}, stored ${seen - skipped.length}${dryRun ? " (dry run: nothing written)" : ""}, skipped ${skipped.length}`);
  console.log("kinds", kinds, `· with a shaikh's name: ${withAnswerer}`);
  console.log(`about ${(bytes / 1e6).toFixed(1)} MB as JSON (the table is larger with its two indexes)`);
  if (dumpTo) (await import("node:fs")).writeFileSync(dumpTo, JSON.stringify(all));
  if (skipped.length) console.log("no answer found in:\n  " + skipped.slice(0, 15).join("\n  "));
  for (const s of sample) console.log("\nhadith ruling:", s.title, "\n  A:", s.answer_snippet.slice(0, 160), "\n  by:", s.answerers.join(" | "));

  if (!dryRun && cfg && !since && seen) await setState(cfg, "alulama_sync", { lastModified: newest, at: new Date().toISOString() });
  if (!dryRun && cfg && since && newest) {
    const prev = await getState<{ lastModified?: string }>(cfg, "alulama_sync");
    await setState(cfg, "alulama_sync", { ...(prev ?? {}), lastModified: newest, at: new Date().toISOString() });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

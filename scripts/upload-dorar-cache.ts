// Uploads the answers collected by warm-dorar-cache.ts (.cache/dorar/cache.jsonl) to the dorar_cache table.
//
//   npx tsx --env-file=.env.local scripts/upload-dorar-cache.ts [cache.jsonl]
import { readFileSync } from "node:fs";
import { restHeaders } from "../src/lib/supabaseRest";

const path = process.argv[2] ?? ".cache/dorar/cache.jsonl";

async function main() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  const rows = readFileSync(path, "utf-8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => {
      const { query_clean, results, fetched_at } = JSON.parse(l);
      return { query_clean, results, fetched_at };
    });
  for (let i = 0; i < rows.length; i += 50) {
    const res = await fetch(`${base}/rest/v1/dorar_cache?on_conflict=query_clean`, {
      method: "POST",
      headers: { ...restHeaders(key), Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows.slice(i, i + 50)),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
  console.log(`Uploaded ${rows.length} cached Dorar answers.`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

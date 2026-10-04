// Runs claim extraction against the live Gemini API and prints what the checks kept, dropped and noticed.
//
//   npx tsx --env-file=.env.local scripts/try-extract.ts "<post text>"
//   npx tsx --env-file=.env.local scripts/try-extract.ts --file post.txt
import { readFileSync } from "node:fs";
import { extractClaims } from "../src/lib/claims";

async function main() {
  const args = process.argv.slice(2);
  const post = args[0] === "--file" ? readFileSync(args[1], "utf-8") : args.join(" ");
  if (!post.trim()) throw new Error('usage: scripts/try-extract.ts "<post>" | --file post.txt');
  const r = await extractClaims(post);
  console.log(`model ${r.model}, ${r.ms} ms, ${r.claims.length} claims, ${r.dropped.length} dropped`);
  for (const c of r.claims) {
    console.log(`\n[${c.kind}] (${c.language}, span ${c.spanCheck})  ${c.textAsWritten}`);
    console.log(`   query: ${c.query}${c.queryIsTranslation ? "   (translation — not for wording checks)" : ""}`);
    if (c.attributedTo || c.citedSource) console.log(`   attributed to: ${c.attributedTo ?? "-"} | cited: ${c.citedSource ?? "-"}`);
    for (const w of c.warnings) console.log(`   ⚠ ${w}`);
  }
  for (const d of r.dropped) console.log(`\n✗ dropped (${d.reason}): ${d.text}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

import { readFileSync, writeFileSync } from "node:fs";
import { extractClaims } from "../src/lib/claims";
import { supabaseDorarCache } from "../src/lib/dorarCache";
import { lookupDorar } from "../src/lib/lookup";
import { matchVerses } from "../src/lib/quranCheck";
import { matchSayings } from "../src/lib/sayingsMatch";
import { verifyClaims, type VerifiedClaim } from "../src/lib/verify";

interface InputItem {
  id: string;
  category: string;
  language: string;
  text: string;
  expectedState?: string;
}

interface OutputItem {
  id: string;
  category: string;
  language: string;
  text: string;
  toolState: string;
  toolSource: string;
  latencySeconds: number;
  basis: string;
  notes: string[];
  claimsCount: number;
  extractedQuery?: string;
  extractedKind?: string;
  error?: string;
}

function formatSource(r: VerifiedClaim): string {
  if (r.verse) {
    const surah = r.verse.surahName.replace(/^سورة\s+/, "");
    return `سورة ${surah}، الآية ${r.verse.ayah}`;
  }
  const n = r.dorar?.narrations?.[0];
  if (n) {
    const parts: string[] = [];
    if (n.source) parts.push(n.source);
    if (n.reference) parts.push(n.reference);
    const line = parts.join(" — ");
    if (n.muhaddith) return line ? `${line} (${n.muhaddith})` : n.muhaddith;
    return line || "الدرر السنية";
  }
  if (r.saying) {
    const parts = [r.saying.reference].filter(Boolean);
    if (r.saying.verdict_by) parts.push(`(${r.saying.verdict_by})`);
    return parts.join(" — ") || "قائمة الأقوال المتداولة";
  }
  if (r.state === "فتوى أو حالة شخصية — إحالة") {
    return "إحالة إلى أهل العلم (مستوى د)";
  }
  if (r.state.includes("لم يُعثر عليه") || r.state.includes("إحالة")) {
    return "لم يُعثر عليه في المصادر المعتمدة — إحالة";
  }
  return "-";
}

async function verifyText(text: string, cache: any) {
  const t0 = Date.now();
  const extraction = await extractClaims(text);
  const results = await verifyClaims(extraction.claims, {
    matchVerses: (q) => matchVerses(q),
    matchSayings: (q) => matchSayings(q),
    lookupDorar: (q) => lookupDorar(q, { cache }),
  });
  const latencySeconds = Number(((Date.now() - t0) / 1000).toFixed(2));
  return { extraction, results, latencySeconds };
}

async function main() {
  const args = process.argv.slice(2);
  const inputIdx = args.indexOf("--input");
  const outputIdx = args.indexOf("--output");

  const inputFile = inputIdx !== -1 ? args[inputIdx + 1] : "eval_inputs.json";
  const outputFile = outputIdx !== -1 ? args[outputIdx + 1] : "eval_results.json";

  const rawData = readFileSync(inputFile, "utf-8");
  const items: InputItem[] = JSON.parse(rawData);

  console.log(`Loaded ${items.length} items from ${inputFile}`);

  const cache = supabaseDorarCache();
  const results: OutputItem[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    console.log(`\n[${i + 1}/${items.length}] Evaluating ${item.id}: "${item.text.slice(0, 45)}..."`);

    try {
      const { extraction, results: verified, latencySeconds } = await verifyText(item.text, cache);
      const primary = verified[0];
      const toolState = primary ? primary.state : "لم يُعثر عليه — إحالة";
      const toolSource = primary ? formatSource(primary) : "-";
      const basis = primary ? primary.basis : "none";
      const notes = primary ? primary.notes : [];

      const record: OutputItem = {
        id: item.id,
        category: item.category,
        language: item.language,
        text: item.text,
        toolState,
        toolSource,
        latencySeconds,
        basis,
        notes,
        claimsCount: extraction.claims.length,
        extractedQuery: extraction.claims[0]?.query,
        extractedKind: extraction.claims[0]?.kind,
      };

      console.log(`  ✓ State: ${toolState} | Latency: ${latencySeconds}s | Source: ${toolSource}`);
      results.push(record);
    } catch (err: any) {
      console.error(`  ✗ Error on ${item.id}:`, err?.message || err);
      results.push({
        id: item.id,
        category: item.category,
        language: item.language,
        text: item.text,
        toolState: "خطأ في المعالجة",
        toolSource: "-",
        latencySeconds: 0,
        basis: "none",
        notes: [],
        claimsCount: 0,
        error: String(err?.message || err),
      });
    }

    // Save progressively after each item
    writeFileSync(outputFile, JSON.stringify(results, null, 2), "utf-8");

    // Small polite pause to prevent throttling
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  console.log(`\nCompleted evaluation for all ${results.length} items. Saved to ${outputFile}`);
}

main().catch((err) => {
  console.error("Evaluation script failed:", err);
  process.exit(1);
});

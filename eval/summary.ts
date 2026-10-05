// Turns per-prompt results into the summary and the Markdown report. Shared by run-eval.ts and run-baseline.ts.
import { coverage, percentile, rate } from "./scoring";
import { CATEGORIES, type CategoryMetrics, type EvalCategory, type EvalPrompt, type EvalSummary, type PromptEvalResult, type Rate, type Usage } from "./types";

/** Targets of docs/07-evaluation-plan.md §7.2. */
export const TARGETS = { accuracy: 90, attribution: 90, abstention: 95, fabrications: 0, latencyMs: 30_000 };

/** Labels that need no specialist judgement: the mushaf, a rule-made change, an invented text, membership in the Sahihayn. */
export const isByConstruction = (p: Pick<EvalPrompt, "label">) => p.label.source.startsWith("by construction");
export const isReviewed = (p: Pick<EvalPrompt, "label">) => p.label.status === "approved" || p.label.status === "corrected";

/**
 * A rate whose interval counts source texts, not prompts: three wordings of one saying are not three independent
 * observations. The point estimate is the prompt-level one; the interval uses the number of groups.
 */
function clusteredRate(k: number, n: number, groups: number): Rate {
  const r = rate(k, n);
  if (!n || groups >= n) return r;
  const g = Math.max(1, groups);
  return { ...r, ci: rate(Math.round((k / n) * g), g).ci };
}

export function metricsOf(results: PromptEvalResult[]): CategoryMetrics {
  const measured = results.filter((r) => r.error?.kind !== "infra");
  const groups = new Set(measured.map((r) => r.group)).size;
  const scores = measured.flatMap((r) => r.scores);
  const found = scores.filter((s) => s.found);
  const extras = measured.reduce((a, r) => a + r.extraClaims.length, 0);
  const attributed = scores.filter((s) => s.attributionOk !== null);
  const shouldAbstain = scores.filter((s) => isReferralExpected(s.expectedState));
  const durations = measured.map((r) => r.durationMs);
  return {
    prompts: results.length,
    measured: measured.length,
    infraErrors: results.length - measured.length,
    accuracy: clusteredRate(measured.filter((r) => r.success).length, measured.length, groups),
    claimRecall: rate(found.length, scores.length),
    claimPrecision: rate(found.length, found.length + extras),
    kindAccuracy: rate(found.filter((s) => s.kindOk).length, found.length),
    stateAccuracy: rate(scores.filter((s) => s.stateOk).length, scores.length),
    attributionAccuracy: rate(attributed.filter((s) => s.attributionOk).length, attributed.length),
    abstention: rate(shouldAbstain.filter((s) => s.abstentionOk).length, shouldAbstain.length),
    fabricationCount: measured.reduce((a, r) => a + r.fabrications.length, 0),
    avgDurationMs: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
    p95DurationMs: percentile(durations, 95),
  };
}

const REFERRALS = ["فتوى أو حالة شخصية — إحالة", "لم يُعثر عليه — إحالة"];
const isReferralExpected = (state: string) => REFERRALS.includes(state);

export function addUsage(a: Usage | undefined, b: Usage | undefined): Usage | undefined {
  if (!b) return a;
  if (!a) return { ...b };
  return { promptTokens: a.promptTokens + b.promptTokens, outputTokens: a.outputTokens + b.outputTokens, totalTokens: a.totalTokens + b.totalTokens, calls: a.calls + b.calls };
}

/** Cost from the prices the user supplies (USD per million tokens). No price → no cost figure, never a guessed one. */
export function costOf(u: Usage | undefined): number | undefined {
  const pin = Number(process.env.EVAL_PRICE_INPUT_PER_MTOK);
  const pout = Number(process.env.EVAL_PRICE_OUTPUT_PER_MTOK);
  if (!u || !Number.isFinite(pin) || !Number.isFinite(pout) || !process.env.EVAL_PRICE_INPUT_PER_MTOK || !process.env.EVAL_PRICE_OUTPUT_PER_MTOK) return undefined;
  // thinking tokens are billed as output: totalTokens − promptTokens covers output + thoughts
  return (u.promptTokens * pin + (u.totalTokens - u.promptTokens) * pout) / 1_000_000;
}

export function summarize(
  results: PromptEvalResult[],
  meta: Pick<EvalSummary, "mode" | "model" | "gitSha" | "datasetSha256" | "split" | "sampling" | "seed" | "turath">,
): EvalSummary {
  const byCategory: Partial<Record<EvalCategory, CategoryMetrics>> = {};
  for (const c of CATEGORIES) {
    const s = results.filter((r) => r.category === c);
    if (s.length) byCategory[c] = metricsOf(s);
  }
  const overall = metricsOf(results);
  const cats = Object.values(byCategory).filter((m) => m && m.measured > 0) as CategoryMetrics[];
  const usage = results.reduce<Usage | undefined>((a, r) => addUsage(a, r.usage), undefined);
  const cost = costOf(usage);
  return {
    timestamp: new Date().toISOString(),
    ...meta,
    totalPrompts: results.length,
    measured: overall.measured,
    infraErrors: overall.infraErrors,
    reviewedLabelShare: results.length ? Math.round((results.filter((r) => r.labelReviewed).length / results.length) * 1000) / 10 : 0,
    overall,
    macroAccuracy: cats.length ? Math.round((cats.reduce((a, m) => a + m.accuracy.value, 0) / cats.length) * 10) / 10 : 0,
    byCategory,
    ...(usage ? { usage } : {}),
    ...(cost !== undefined ? { estimatedCostUsd: Math.round(cost * 10000) / 10000, costPerPromptUsd: Math.round((cost / Math.max(1, overall.measured)) * 1e6) / 1e6 } : {}),
  };
}

// ---------- Markdown ----------

const pct = (r: Rate) => (r.n ? `${r.value}% (${r.ci[0]}–${r.ci[1]}, n=${r.n})` : "—");

function verdict(r: Rate, target: number, mock: boolean, provisional: boolean): string {
  if (mock) return "n/a — mock run";
  if (!r.n) return "not measured";
  const tag = provisional ? " · provisional (unreviewed labels)" : "";
  if (r.ci[0] >= target) return `✅ met (95% CI ≥ ${target}%)${tag}`;
  if (r.value >= target) return `◐ estimate meets ${target}%, CI does not${tag}`;
  return `❌ below ${target}%${tag}`;
}

export interface ReportExtras {
  turath?: { lookups: number; unavailable: number; partial: number; patched: number; citationProblems: number; textHeld: Rate; examples: string[] };
  servedByList?: Partial<Record<EvalCategory, Rate>>;
  notes?: string[];
}

export function markdownReport(summary: EvalSummary, results: PromptEvalResult[], prompts: Map<string, EvalPrompt>, extras: ReportExtras = {}): string {
  const mock = summary.mode === "mock";
  const provisional = summary.reviewedLabelShare < 100 && results.some((r) => !r.labelReviewed && !isByConstruction(prompts.get(r.promptId)!));
  const o = summary.overall;
  const L: string[] = [
    `# Tathabbut evaluation — ${mock ? "MOCK harness check" : "live run"}`,
    "",
    mock
      ? "> ⚠️ **MOCK RUN.** The answers were simulated from the labels to exercise the harness. Nothing here measures the system; no target is judged."
      : "> Live run of the system on the labelled set. Rates show the 95% Wilson interval (for categories with several wordings of one text, the interval counts distinct texts).",
    "",
    `- **When:** ${summary.timestamp}`,
    `- **Mode:** \`${summary.mode}\`${summary.model ? ` · model \`${summary.model}\`` : ""}${summary.gitSha ? ` · commit \`${summary.gitSha.slice(0, 10)}\`` : ""}`,
    `- **Dataset:** sha256 \`${summary.datasetSha256.slice(0, 16)}\` · split \`${summary.split}\` · ${summary.sampling} (seed ${summary.seed}) · Turath step ${summary.turath ? "on" : "off"}`,
    `- **Prompts:** ${summary.totalPrompts} · measured ${summary.measured} · infrastructure errors ${summary.infraErrors} (relay/quota/timeouts: excluded from rates, listed below)`,
    `- **Labels reviewed by the specialist:** ${summary.reviewedLabelShare}% of prompts${provisional ? " — results on drafted/external labels are **provisional**" : ""}`,
    "",
    "## 1. Targets (docs/07-evaluation-plan.md §7.2)",
    "",
    "| Metric | Target | Measured | Status |",
    "|---|---|---|---|",
    `| Accuracy (all expected claims found with right kind, state and attribution; nothing fabricated) | ≥ ${TARGETS.accuracy}% | ${pct(o.accuracy)} · macro ${summary.macroAccuracy}% | ${verdict(o.accuracy, TARGETS.accuracy, mock, provisional)} |`,
    `| Attribution accuracy (surah+ayah / collection / scholar shown) | ≥ ${TARGETS.attribution}% | ${pct(o.attributionAccuracy)} | ${verdict(o.attributionAccuracy, TARGETS.attribution, mock, provisional)} |`,
    `| Fabricated attributions (evidence that does not hold the text or the state) | ${TARGETS.fabrications} | ${o.fabricationCount} | ${mock ? "n/a — mock run" : o.fabricationCount === 0 ? "✅ none found" : "❌ found — see §4"} |`,
    `| Correct referral (personal fatwa + no-source texts) | ≥ ${TARGETS.abstention}% | ${pct(o.abstention)} | ${verdict(o.abstention, TARGETS.abstention, mock, provisional)} |`,
    `| Verification time, p95 (s) | < ${TARGETS.latencyMs / 1000} | ${(o.p95DurationMs / 1000).toFixed(1)} (avg ${(o.avgDurationMs / 1000).toFixed(1)}) | ${mock ? "n/a — mock run" : o.p95DurationMs < TARGETS.latencyMs ? "✅ met" : "❌ exceeded"} |`,
    `| Claim extraction recall | measured | ${pct(o.claimRecall)} · precision ${pct(o.claimPrecision)} | ${mock ? "n/a — mock run" : "measured"} |`,
    `| Cost per verification | measured | ${summary.usage ? `${Math.round(summary.usage.totalTokens / Math.max(1, summary.measured))} tokens/prompt (${summary.usage.calls} model calls)` : "no token counts"}${summary.costPerPromptUsd !== undefined ? ` · $${summary.costPerPromptUsd}/prompt` : " · set EVAL_PRICE_INPUT_PER_MTOK / EVAL_PRICE_OUTPUT_PER_MTOK for USD"} | ${mock ? "n/a — mock run" : "measured"} |`,
    "",
    "## 2. By category",
    "",
    "| Category | Prompts (measured) | Accuracy | State | Attribution | Recall | Precision | Kind | Referral | Fabrications | p95 s |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
  ];
  for (const [c, m] of Object.entries(summary.byCategory)) {
    if (!m) continue;
    L.push(`| \`${c}\` | ${m.prompts} (${m.measured}) | ${pct(m.accuracy)} | ${pct(m.stateAccuracy)} | ${pct(m.attributionAccuracy)} | ${m.claimRecall.value}% | ${m.claimPrecision.value}% | ${m.kindAccuracy.value}% | ${m.abstention.n ? `${m.abstention.value}%` : "—"} | ${m.fabricationCount} | ${(m.p95DurationMs / 1000).toFixed(1)} |`);
  }

  if (extras.servedByList && Object.keys(extras.servedByList).length) {
    L.push("", "**Answered from the specialist's own list** (`circulating_sayings`) — such answers test a lookup, not verification; docs/07 §7.1 keeps the test set apart from that list:", "");
    for (const [c, r] of Object.entries(extras.servedByList)) if (r && r.n) L.push(`- \`${c}\`: ${r.value}% of found claims (${r.k}/${r.n})`);
  }

  if (extras.turath) {
    const t = extras.turath;
    L.push(
      "",
      "## 3. Turath step",
      "",
      `- Lookups made: ${t.lookups} · unavailable: ${t.unavailable} · partial: ${t.partial} · claims whose state Turath changed: ${t.patched}`,
      `- Passages that hold the asked text (hadith/scholar lookups): ${pct(t.textHeld)}`,
      `- Citation problems (no book, no id, no turath.io link to that book, no citation): ${t.citationProblems}`,
      "- **Relevance (precision@10) for fiqh topics needs labels**: `npx tsx eval/turath-labels.ts export <run dir>` → the specialist marks each passage → `npx tsx eval/turath-labels.ts score <filled file>`.",
    );
    if (t.examples.length) L.push("", ...t.examples.map((e) => `  - ${e}`));
  }

  const failures = results.filter((r) => !r.success && r.error?.kind !== "infra");
  L.push("", "## 4. Failures (first 25)", "", "| Prompt | Category | Expected | Shown | Why |", "|---|---|---|---|---|");
  for (const r of failures.slice(0, 25)) {
    const bad = r.scores.find((s) => !s.found || !s.kindOk || !s.stateOk || s.attributionOk === false) ?? r.scores[0];
    const why = r.error
      ? `error: ${r.error.message.slice(0, 80)}`
      : r.fabrications.length
        ? `fabricated: ${r.fabrications[0].reason}`
        : !bad?.found
          ? "claim not extracted"
          : !bad.kindOk
            ? `kind «${bad.extractedKind}»`
            : !bad.stateOk
              ? "state"
              : "attribution";
    const cell = (s: string | undefined) => (s ?? "—").replace(/\|/g, "\\|").replace(/\n/g, " ").slice(0, 60);
    L.push(`| \`${r.promptId}\` | \`${r.category}\` | ${cell(bad?.expectedState)} | ${cell(bad?.actualState)}${bad?.shownSource ? ` · ${cell(bad.shownSource)}` : ""} | ${cell(why)} |`);
  }
  const infra = results.filter((r) => r.error?.kind === "infra");
  if (infra.length) {
    L.push("", "## 5. Not measured (infrastructure)", "");
    const counts = new Map<string, number>();
    for (const r of infra) counts.set(r.error!.message.slice(0, 60), (counts.get(r.error!.message.slice(0, 60)) ?? 0) + 1);
    for (const [m, n] of counts) L.push(`- ${n} × ${m}`);
  }
  if (extras.notes?.length) L.push("", "## Notes", "", ...extras.notes.map((n) => `- ${n}`));
  L.push("", "---", "*Generated by `eval/run-eval.ts`. Scoring rules: `eval/scoring.ts` (unit-tested in `eval/scoring.test.ts`).*");
  return L.join("\n") + "\n";
}

/** Share of hadith/scholar Turath passages that hold the asked text. */
export function turathTextHeld(results: PromptEvalResult[]): Rate {
  let k = 0;
  let n = 0;
  for (const r of results) for (const t of r.turath) if (t.kind !== "fiqh") for (const ref of t.references) {
    n++;
    if (coverage(t.query, ref.excerpt) >= 0.8) k++;
  }
  return rate(k, n);
}

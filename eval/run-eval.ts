// Tathabbut evaluation runner.
//
// Runs each labelled prompt through the SAME path the screen uses — /api/ocr for a screenshot, /api/verify, then
// /api/turath for every claim the screen would send to the books (applying its patch) — and scores the final cards with
// eval/scoring.ts.
//
//   npx tsx --env-file=.env.local eval/run-eval.ts --sample 20                 # 20 prompts per category, test split
//   npx tsx --env-file=.env.local eval/run-eval.ts --category quran_distorted --sample 50
//   npx tsx --env-file=.env.local eval/run-eval.ts --all --concurrency 2       # every test-split prompt
//   npx tsx eval/run-eval.ts --mode api --api-url http://localhost:3000 --sample 20
//   npx tsx eval/run-eval.ts --mode mock --sample 10                            # harness check only, no API calls
//
// Options: --split test|dev|all (default test) · --seed N · --no-turath · --include-conflicts · --exclude-listed
// (texts check-leakage.ts found in the specialist's list) · --retries N (infra
// errors only) · --delay ms · --concurrency N · --out <dir>.
// Every run writes its own folder eval/runs/<time>-<mode>-<split>/ (results.json, report.md); nothing is overwritten.
// Cost: set EVAL_PRICE_INPUT_PER_MTOK and EVAL_PRICE_OUTPUT_PER_MTOK (USD per million tokens) to get a USD figure.
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { STATES } from "../src/lib/states";
import { turathKindOf, turathQueryOf } from "../src/lib/turathClient";
import { rng } from "./build-dataset";
import { citationProblems, scorePrompt } from "./scoring";
import { isByConstruction, isReviewed, markdownReport, summarize, turathTextHeld } from "./summary";
import { CATEGORIES, type ActualClaim, type EvalCategory, type EvalPrompt, type PromptEvalResult, type TurathOutcomeLite, type Usage } from "./types";
import type { ClaimResult } from "../src/lib/clientTypes";
import { rate } from "./scoring";

const DIR = __dirname;
const DATASET = join(DIR, "dataset.json");

type Mode = "pipeline" | "api" | "mock";
interface Args {
  mode: Mode;
  apiUrl: string;
  categories?: EvalCategory[];
  split: "test" | "dev" | "all";
  sample?: number;
  all: boolean;
  seed: number;
  concurrency: number;
  delayMs: number;
  retries: number;
  turath: boolean;
  includeConflicts: boolean;
  excludeListed: boolean;
  out?: string;
}

function parseArgs(argv = process.argv.slice(2)): Args {
  const get = (n: string) => {
    const i = argv.indexOf(`--${n}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const mode = (get("mode") ?? "pipeline") as Mode;
  if (!["pipeline", "api", "mock"].includes(mode)) throw new Error(`--mode must be pipeline, api or mock`);
  const cats = get("category")?.split(",").map((c) => c.trim()) as EvalCategory[] | undefined;
  for (const c of cats ?? []) if (!CATEGORIES.includes(c)) throw new Error(`unknown category ${c}; one of ${CATEGORIES.join(", ")}`);
  const split = (get("split") ?? "test") as Args["split"];
  return {
    mode,
    apiUrl: (get("api-url") ?? "http://localhost:3000").replace(/\/api\/verify\/?$/, "").replace(/\/$/, ""),
    categories: cats,
    split,
    sample: get("sample") ? Number(get("sample")) : undefined,
    all: argv.includes("--all"),
    seed: Number(get("seed") ?? 20261005),
    concurrency: Number(get("concurrency") ?? 2),
    delayMs: Number(get("delay") ?? 300),
    retries: Number(get("retries") ?? 2),
    turath: !argv.includes("--no-turath"),
    includeConflicts: argv.includes("--include-conflicts"),
    excludeListed: argv.includes("--exclude-listed"),
    out: get("out"),
  };
}

// ---------- sampling ----------

/**
 * Stratified and seeded: within each category, whole groups (all wordings of one text) are drawn in a shuffled order
 * until `perCategory` prompts are taken. The first items of a file are never favoured.
 */
export function selectPrompts(
  all: EvalPrompt[],
  a: Pick<Args, "categories" | "split" | "sample" | "all" | "seed" | "includeConflicts"> & { excludeListed?: boolean },
): EvalPrompt[] {
  const r = rng(a.seed);
  let pool = all.filter((p) => (a.split === "all" || p.split === a.split) && (!a.categories || a.categories.includes(p.category)));
  pool = pool.filter((p) => p.label.status !== "rejected" && (a.includeConflicts || !p.metadata?.conflict) && !(a.excludeListed && p.metadata?.inSpecialistList));
  if (a.all && !a.sample) return pool;
  const per = a.sample ?? 20;
  const out: EvalPrompt[] = [];
  for (const c of CATEGORIES) {
    const items = pool.filter((p) => p.category === c);
    const groups = [...new Set(items.map((p) => p.group))];
    for (let i = groups.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [groups[i], groups[j]] = [groups[j], groups[i]];
    }
    let taken = 0;
    for (const g of groups) {
      if (taken >= per) break;
      for (const p of items.filter((x) => x.group === g)) {
        if (taken >= per) break;
        out.push(p);
        taken++;
      }
    }
  }
  return out;
}

// ---------- transport: the same handlers, in process or over HTTP ----------

interface Transport {
  post(path: "/api/verify" | "/api/turath" | "/api/ocr", body: unknown): Promise<{ status: number; json: Record<string, unknown> }>;
}

function inProcess(): Transport {
  const handlers: Record<string, Promise<{ POST: (r: Request) => Promise<Response> }>> = {};
  const load = (path: string) =>
    (handlers[path] ??=
      path === "/api/verify" ? import("../src/app/api/verify/route") : path === "/api/turath" ? import("../src/app/api/turath/route") : import("../src/app/api/ocr/route"));
  return {
    async post(path, body) {
      const { POST } = await load(path);
      const res = await POST(new Request(`http://eval.local${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
      return { status: res.status, json: (await res.json()) as Record<string, unknown> };
    },
  };
}

function overHttp(base: string): Transport {
  return {
    async post(path, body) {
      const res = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(90_000) });
      const text = await res.text();
      let json: Record<string, unknown> = {};
      try {
        json = JSON.parse(text);
      } catch {
        json = { error: text.slice(0, 200) };
      }
      return { status: res.status, json };
    },
  };
}

/** Failures of things outside the system under test: they make an item unmeasurable, not wrong. */
const INFRA = /HTTP (429|5\d\d)|network|timeout|timed out|aborted|ECONN|ENOTFOUND|fetch failed|quota|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded/i;
const DORAR_DOWN = "تعذّر البحث في الدرر";
class InfraError extends Error {}

interface GeminiUsageLite {
  promptTokens: number;
  outputTokens: number;
  thoughtsTokens?: number;
  totalTokens: number;
}
const toUsage = (u: unknown): Usage | undefined => {
  const g = u as GeminiUsageLite | undefined;
  return g && typeof g.totalTokens === "number" ? { promptTokens: g.promptTokens, outputTokens: g.outputTokens + (g.thoughtsTokens ?? 0), totalTokens: g.totalTokens, calls: 1 } : undefined;
};
const plus = (a: Usage | undefined, b: Usage | undefined): Usage | undefined =>
  !b ? a : !a ? b : { promptTokens: a.promptTokens + b.promptTokens, outputTokens: a.outputTokens + b.outputTokens, totalTokens: a.totalTokens + b.totalTokens, calls: a.calls + b.calls };

async function runOne(p: EvalPrompt, t: Transport, a: Args): Promise<PromptEvalResult> {
  const t0 = Date.now();
  const stageMs: Record<string, number> = {};
  let usage: Usage | undefined;

  // 1. a screenshot is read first, exactly as the screen does
  let text = p.prompt;
  if (p.image) {
    const s = Date.now();
    const data = readFileSync(join(DIR, p.image.path)).toString("base64");
    const r = await t.post("/api/ocr", { image: data, mimeType: p.image.mimeType });
    stageMs.ocr = Date.now() - s;
    if (r.status !== 200) {
      const msg = `ocr ${r.status}: ${String(r.json.detail ?? r.json.error ?? "")}`;
      if (INFRA.test(msg)) throw new InfraError(msg);
      throw new Error(msg);
    }
    text = String(r.json.text ?? "");
    usage = plus(usage, toUsage(r.json.usage));
  }

  // 2. verify
  const s1 = Date.now();
  const v = await t.post("/api/verify", { text });
  stageMs.verify = Date.now() - s1;
  if (v.status !== 200) {
    const msg = `verify ${v.status}: ${String(v.json.detail ?? v.json.error ?? "")}`;
    // 502 = the model could not be reached or refused the call; a reply that is not the asked JSON is the system's fault
    if ((v.status === 502 && !/not JSON/.test(msg)) || INFRA.test(msg)) throw new InfraError(msg);
    throw new Error(msg);
  }
  usage = plus(usage, toUsage(v.json.usage));
  const model = typeof v.json.model === "string" ? v.json.model : undefined;
  const claims = (v.json.claims ?? []) as ClaimResult[];
  if (claims.some((c) => c.notes?.some((n) => n.includes(DORAR_DOWN)))) throw new InfraError("Dorar relay unreachable for a claim");

  // 3. the books, for every claim the screen sends there
  const s2 = Date.now();
  const turathLog: PromptEvalResult["turath"] = [];
  const final: ActualClaim[] = [];
  for (const [i, c] of claims.entries()) {
    const kind = a.turath ? turathKindOf(c) : null;
    if (!kind) {
      final.push(c as unknown as ActualClaim);
      continue;
    }
    const query = turathQueryOf(c, kind);
    const r = await t.post("/api/turath", { query, kind, state: c.state, basis: c.basis, notes: c.notes });
    const outcome = (r.status === 200 ? r.json.turath : { status: "unavailable", references: [] }) as TurathOutcomeLite;
    const patch = r.status === 200 ? (r.json.patch as { state: string; basis: string; notes: string[] } | null) : null;
    turathLog.push({ actualIndex: i, kind, query, status: outcome.status + (outcome.partial ? " (partial)" : ""), references: outcome.references ?? [], patched: Boolean(patch) });
    const withTurath = { ...(c as unknown as ActualClaim), turath: { ...outcome, kind, query } };
    final.push(patch ? { ...withTurath, state: patch.state, basis: patch.basis, notes: [...(c.notes ?? []), ...patch.notes] } : withTurath);
  }
  stageMs.turath = Date.now() - s2;

  const scored = scorePrompt(p, final);
  return {
    promptId: p.id,
    category: p.category,
    group: p.group,
    split: p.split,
    labelReviewed: isReviewed(p),
    success: scored.success,
    claimsExpected: p.expectedClaims.length,
    claimsFound: final.length,
    claimsMatched: scored.claimsMatched,
    scores: scored.scores,
    fabrications: scored.fabrications,
    extraClaims: scored.extraClaims,
    turath: turathLog,
    durationMs: Date.now() - t0,
    stageMs,
    ...(usage ? { usage } : {}),
    ...(model ? { model } : {}),
  } as PromptEvalResult;
}

// ---------- mock: exercises the harness with simulated, deliberately imperfect answers ----------

function mockAnswer(p: EvalPrompt, r: () => number): ActualClaim[] {
  const out: ActualClaim[] = [];
  for (const e of p.expectedClaims) {
    if (r() < 0.05) continue; // a missed claim
    const wrongState = r() < 0.1;
    const state = wrongState ? (e.expectedState === STATES.maqbul ? STATES.daif : STATES.maqbul) : e.expectedState;
    const translated = p.language !== "ar" && e.kind === "quran";
    const claim = { kind: e.kind, textAsWritten: e.quotedText, arabicSpan: translated ? null : e.quotedText, query: e.quotedText, queryIsTranslation: translated };
    if (e.kind === "question") out.push({ claim, state, basis: "kind" });
    else if (e.attribution?.surah) out.push({ claim, state, basis: "quran", verse: { surah: e.attribution.surah, ayah: e.attribution.ayah ?? 1, text: e.attribution.verseText ?? e.quotedText } });
    else if (e.shouldAbstain) out.push({ claim, state, basis: "none" });
    else out.push({ claim, state, basis: "dorar", dorar: { narrations: [{ matn: e.quotedText, source: e.attribution?.collections?.[0] ?? "—" }], summary: { grade: state } } });
  }
  if (r() < 0.1) out.push({ claim: { kind: "other", textAsWritten: "انشر تؤجر" }, state: STATES.notFound, basis: "none" });
  return out;
}

// ---------- run ----------

async function main() {
  const a = parseArgs();
  if (!existsSync(DATASET)) throw new Error("eval/dataset.json is missing: run npx tsx eval/build-dataset.ts");
  const raw = readFileSync(DATASET, "utf8");
  const dataset = JSON.parse(raw) as EvalPrompt[];
  const selected = selectPrompts(dataset, a);
  const byId = new Map(dataset.map((p) => [p.id, p]));
  if (a.mode === "pipeline" && !process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set: run with --env-file=.env.local (or use --mode api / mock)");

  console.log(`mode ${a.mode} · split ${a.split} · ${selected.length} prompts · Turath ${a.turath ? "on" : "off"} · seed ${a.seed}`);
  const transport = a.mode === "api" ? overHttp(a.apiUrl) : inProcess();
  const r = rng(a.seed + 1);
  const results: PromptEvalResult[] = new Array(selected.length);
  let next = 0;
  let done = 0;
  let configFailures = 0;

  async function worker() {
    while (next < selected.length) {
      const i = next++;
      const p = selected[i];
      if (a.mode === "mock") {
        const ans = mockAnswer(p, r);
        const s = scorePrompt(p, ans);
        results[i] = { promptId: p.id, category: p.category, group: p.group, split: p.split, labelReviewed: isReviewed(p), success: s.success, claimsExpected: p.expectedClaims.length, claimsFound: ans.length, claimsMatched: s.claimsMatched, scores: s.scores, fabrications: s.fabrications, extraClaims: s.extraClaims, turath: [], durationMs: 0 };
      } else {
        for (let attempt = 0; ; attempt++) {
          try {
            results[i] = await runOne(p, transport, a);
            break;
          } catch (err) {
            const msg = (err as Error).message;
            const infra = err instanceof InfraError || INFRA.test(msg);
            if (/is not set/.test(msg)) configFailures++;
            if (infra && attempt < a.retries) {
              await new Promise((res) => setTimeout(res, 2000 * (attempt + 1)));
              continue;
            }
            results[i] = { promptId: p.id, category: p.category, group: p.group, split: p.split, labelReviewed: isReviewed(p), success: false, error: { kind: infra ? "infra" : "system", message: msg }, claimsExpected: p.expectedClaims.length, claimsFound: 0, claimsMatched: 0, scores: p.expectedClaims.map((e, k) => ({ expectedIndex: k, actualIndex: -1, similarity: 0, found: false, kindOk: false, stateOk: false, attributionOk: e.shouldAbstain || !e.attribution ? null : false, abstentionOk: false, expectedState: e.expectedState })), fabrications: [], extraClaims: [], turath: [], durationMs: 0 };
            break;
          }
        }
        if (configFailures >= 3) throw new Error("configuration error (an API key is not set) — stopping");
        if (a.delayMs) await new Promise((res) => setTimeout(res, a.delayMs));
      }
      done++;
      if (process.stdout.isTTY) process.stdout.write(`\r${done}/${selected.length} ${p.id.padEnd(40)}`);
      else if (done % 25 === 0 || done === selected.length) console.log(`${done}/${selected.length}`);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(a.concurrency, selected.length)) }, worker));
  process.stdout.write("\n");

  let gitSha: string | undefined;
  try {
    gitSha = execSync("git rev-parse HEAD", { cwd: DIR, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    /* not a git checkout */
  }
  const models = [...new Set(results.map((x) => (x as PromptEvalResult & { model?: string }).model).filter(Boolean))];
  const summary = summarize(results, {
    mode: a.mode,
    model: models.join(", ") || undefined,
    gitSha,
    datasetSha256: createHash("sha256").update(raw).digest("hex"),
    split: a.split,
    sampling: a.all && !a.sample ? "all prompts of the split" : `stratified, ${a.sample ?? 20} per category, whole groups`,
    seed: a.seed,
    turath: a.turath && a.mode !== "mock",
  });

  // Turath and specialist-list figures
  const allRefs = results.flatMap((x) => x.turath.flatMap((t) => t.references));
  const servedByList: Partial<Record<EvalCategory, ReturnType<typeof rate>>> = {};
  for (const c of CATEGORIES) {
    const s = results.filter((x) => x.category === c && x.error?.kind !== "infra").flatMap((x) => x.scores.filter((sc) => sc.found));
    const k = s.filter((sc) => sc.basis === "specialist-list").length;
    if (s.length && (k > 0 || c === "circulating_saying")) servedByList[c] = rate(k, s.length);
  }
  const report = markdownReport(summary, results, byId, {
    ...(a.mode !== "mock" && a.turath
      ? {
          turath: {
            lookups: results.reduce((n, x) => n + x.turath.length, 0),
            unavailable: results.reduce((n, x) => n + x.turath.filter((t) => t.status.startsWith("unavailable")).length, 0),
            partial: results.reduce((n, x) => n + x.turath.filter((t) => t.status.includes("partial")).length, 0),
            patched: results.reduce((n, x) => n + x.turath.filter((t) => t.patched).length, 0),
            citationProblems: citationProblems(allRefs).length,
            textHeld: turathTextHeld(results),
            examples: citationProblems(allRefs).slice(0, 5),
          },
        }
      : {}),
    servedByList,
    notes: [
      `Labels: ${selected.filter(isByConstruction).length} of ${selected.length} prompts have labels true by construction (mushaf text, rule-made change, invented text, Sahihayn); ${selected.filter(isReviewed).length} are specialist-reviewed; the rest are drafted or external and make the figures provisional.`,
      "Not covered by this set yet: «غير حاسم» and «آية اقتطع سياقها» cases chosen by the specialist, real (not rendered) screenshots.",
    ],
  });

  const stamp = summary.timestamp.replace(/[:.]/g, "-");
  const outDir = a.out ?? join(DIR, "runs", `${stamp}-${a.mode}-${a.split}`);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "results.json"), JSON.stringify({ summary, results }, null, 1));
  writeFileSync(join(outDir, "report.md"), report);
  const o = summary.overall;
  if (!summary.measured) console.warn("no prompt could be measured — see «Not measured» in the report");
  console.log(`accuracy ${o.accuracy.value}% [${o.accuracy.ci.join("–")}] · attribution ${o.attributionAccuracy.value}% · referral ${o.abstention.value}% · fabrications ${o.fabricationCount} · infra errors ${summary.infraErrors} · p95 ${(o.p95DurationMs / 1000).toFixed(1)} s`);
  console.log(`report: ${join(outDir, "report.md")}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("evaluation failed:", (err as Error).message);
    process.exit(1);
  });
}

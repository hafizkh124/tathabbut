// Baseline comparison (docs/07-evaluation-plan.md §7.3): the same prompts given to a general chatbot with NO retrieval,
// scored with the same rules, plus a template for the manual-search baseline.
//
//   npx tsx --env-file=.env.local eval/run-baseline.ts --provider gemini --sample 20
//   OPENAI_API_KEY=… BASELINE_OPENAI_MODEL=… npx tsx eval/run-baseline.ts --provider openai --sample 20
//   npx tsx eval/run-baseline.ts --manual-template 30      # CSV for a person timing a manual search
//
// A chatbot shows no evidence, so «fabricated» is checked where it can be: a cited Quran verse whose text is in the
// dataset's verse pool and differs from the quote's verse, or a cited hadith book/number for a text with no source.
// Every other citation is listed for a person to check («citations to verify by hand»); none is assumed correct.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateJson } from "../src/lib/gemini";
import { STATES } from "../src/lib/states";
import { selectPrompts } from "./run-eval";
import { scorePrompt, textSimilarity } from "./scoring";
import { isReviewed, markdownReport, summarize } from "./summary";
import type { ActualClaim, EvalPrompt, PromptEvalResult, Usage } from "./types";

const DIR = __dirname;
const STATE_LIST = [STATES.verseOk, STATES.verseWrong, STATES.verseTranslated, STATES.maqbul, STATES.daif, STATES.shadid, STATES.unsure, STATES.notFound, STATES.fatwa, STATES.fiqh];

const PROMPT = (post: string) => `You check religious claims in a social-media post. Do not search the web; answer from what you know.
For each claim in the post return:
- kind: "hadith" | "quran" | "scholar_quote" | "question" | "other"
- text_as_written: the claim copied from the post
- verdict: exactly one of: ${STATE_LIST.map((s) => `«${s}»`).join(", ")}
  (verses: quoted correctly / misquoted / a translation; hadith: accepted / weak / very weak or baseless / not decisive;
   «${STATES.notFound}» if you cannot find a source; «${STATES.fatwa}» for a personal case or fatwa; «${STATES.fiqh}» for a general fiqh question)
- surah and ayah (numbers) for a verse; book and number for a hadith; the scholar whose grading you rely on.

POST:
${post}`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    claims: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          kind: { type: "STRING" },
          text_as_written: { type: "STRING" },
          verdict: { type: "STRING" },
          surah: { type: "INTEGER" },
          ayah: { type: "INTEGER" },
          book: { type: "STRING" },
          number: { type: "STRING" },
          grader: { type: "STRING" },
        },
        required: ["kind", "text_as_written", "verdict"],
      },
    },
  },
  required: ["claims"],
};

interface BaselineClaim {
  kind: string;
  text_as_written: string;
  verdict: string;
  surah?: number;
  ayah?: number;
  book?: string;
  number?: string;
  grader?: string;
}

async function askGemini(post: string): Promise<{ claims: BaselineClaim[]; usage?: Usage; model: string }> {
  const model = process.env.BASELINE_GEMINI_MODEL ?? process.env.GEMINI_MODEL;
  const r = await generateJson<{ claims?: BaselineClaim[] }>(PROMPT(post), { schema: SCHEMA, ...(model ? { model } : {}), timeoutMs: 60_000 });
  return { claims: r.data.claims ?? [], model: r.model, ...(r.usage ? { usage: { promptTokens: r.usage.promptTokens, outputTokens: r.usage.outputTokens + r.usage.thoughtsTokens, totalTokens: r.usage.totalTokens, calls: 1 } } : {}) };
}

async function askOpenAI(post: string): Promise<{ claims: BaselineClaim[]; usage?: Usage; model: string }> {
  const key = process.env.OPENAI_API_KEY;
  const model = process.env.BASELINE_OPENAI_MODEL;
  if (!key || !model) throw new Error("OPENAI_API_KEY and BASELINE_OPENAI_MODEL must be set");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model, response_format: { type: "json_object" }, messages: [{ role: "user", content: `${PROMPT(post)}\n\nAnswer as JSON: {"claims": [...]}` }] }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { choices: Array<{ message: { content: string } }>; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } };
  const data = JSON.parse(body.choices[0]?.message.content ?? "{}") as { claims?: BaselineClaim[] };
  const u = body.usage;
  return { claims: data.claims ?? [], model, ...(u ? { usage: { promptTokens: u.prompt_tokens, outputTokens: u.completion_tokens, totalTokens: u.total_tokens, calls: 1 } } : {}) };
}

/** The chatbot's claims in the shape the scorer reads: its citation becomes the «shown» source. */
function toActual(c: BaselineClaim): ActualClaim {
  const base = { claim: { kind: c.kind, textAsWritten: c.text_as_written, arabicSpan: c.text_as_written }, state: c.verdict, basis: "baseline" };
  if (c.kind === "quran" && c.surah) return { ...base, verse: { surah: c.surah, ayah: c.ayah ?? 0 } };
  if (c.book) return { ...base, dorar: { narrations: [{ matn: c.text_as_written, source: c.book, muhaddith: c.grader }] } };
  return base;
}

function main() {
  const argv = process.argv.slice(2);
  const get = (n: string) => {
    const i = argv.indexOf(`--${n}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const dataset = JSON.parse(readFileSync(join(DIR, "dataset.json"), "utf8")) as EvalPrompt[];
  const seed = Number(get("seed") ?? 20261005);

  const manual = get("manual-template");
  if (manual) {
    const sel = selectPrompts(dataset, { split: "test", sample: Math.max(1, Math.ceil(Number(manual) / 12)), all: false, seed, includeConflicts: false }).filter((p) => !p.image).slice(0, Number(manual));
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const rows = ["id,category,prompt,started_at,finished_at,source_found,grade_found,would_refer,notes", ...sel.map((p) => [p.id, p.category, esc(p.prompt), "", "", "", "", "", ""].join(","))];
    mkdirSync(join(DIR, "baseline"), { recursive: true });
    const out = join(DIR, "baseline", "manual-search-template.csv");
    writeFileSync(out, "﻿" + rows.join("\n") + "\n");
    console.log(`wrote ${sel.length} rows to ${out}: a person searches each text by hand (Dorar, Shamela, a mushaf) and records start/finish times and findings`);
    return;
  }

  const provider = get("provider") ?? "gemini";
  const ask = provider === "openai" ? askOpenAI : askGemini;
  const sel = selectPrompts(dataset, { split: (get("split") ?? "test") as "test", sample: Number(get("sample") ?? 20), all: argv.includes("--all"), seed, includeConflicts: false }).filter((p) => !p.image);
  const versePool = new Map<string, string>();
  for (const p of dataset) for (const c of p.expectedClaims) if (c.attribution?.surah && c.attribution.verseText) versePool.set(`${c.attribution.surah}:${c.attribution.ayah}`, c.attribution.verseText);

  (async () => {
    const results: PromptEvalResult[] = [];
    const toCheck: string[] = [];
    let model = "";
    for (const [i, p] of sel.entries()) {
      const t0 = Date.now();
      try {
        const r = await ask(p.prompt);
        model = r.model;
        const actual = r.claims.map(toActual);
        const fabrication = (a: ActualClaim): string | null => {
          if (a.verse) {
            const cited = versePool.get(`${a.verse.surah}:${a.verse.ayah}`);
            if (cited && textSimilarity(cited, a.claim.textAsWritten) < 0.3) return `cites ${a.verse.surah}:${a.verse.ayah}, which is another verse`;
            if (!cited) toCheck.push(`${p.id}: verse ${a.verse.surah}:${a.verse.ayah} for «${a.claim.textAsWritten.slice(0, 50)}»`);
          }
          const book = a.dorar?.narrations[0]?.source;
          if (book) {
            if (p.category === "no_source") return `cites «${book}» for a text with no source`;
            toCheck.push(`${p.id}: «${book}» for «${a.claim.textAsWritten.slice(0, 50)}»`);
          }
          return null;
        };
        const s = scorePrompt(p, actual, { fabrication });
        results.push({ promptId: p.id, category: p.category, group: p.group, split: p.split, labelReviewed: isReviewed(p), success: s.success, claimsExpected: p.expectedClaims.length, claimsFound: actual.length, claimsMatched: s.claimsMatched, scores: s.scores, fabrications: s.fabrications, extraClaims: s.extraClaims, turath: [], durationMs: Date.now() - t0, ...(r.usage ? { usage: r.usage } : {}) });
      } catch (err) {
        const msg = (err as Error).message;
        results.push({ promptId: p.id, category: p.category, group: p.group, split: p.split, labelReviewed: isReviewed(p), success: false, error: { kind: /HTTP (429|5\d\d)|network|timeout/i.test(msg) ? "infra" : "system", message: msg }, claimsExpected: p.expectedClaims.length, claimsFound: 0, claimsMatched: 0, scores: [], fabrications: [], extraClaims: [], turath: [], durationMs: Date.now() - t0 });
      }
      console.log(`${i + 1}/${sel.length} ${p.id}`);
    }
    const raw = readFileSync(join(DIR, "dataset.json"), "utf8");
    const summary = summarize(results, { mode: "api", model: `${provider}:${model}`, datasetSha256: createHash("sha256").update(raw).digest("hex"), split: get("split") ?? "test", sampling: "stratified baseline sample", seed, turath: false });
    const report = markdownReport(summary, results, new Map(dataset.map((p) => [p.id, p])), {
      notes: [
        `BASELINE: ${provider} plain chat, no retrieval. «Attribution» is the source the chatbot names; «fabricated» counts only what could be checked automatically.`,
        `Citations to verify by hand (${toCheck.length}): ${toCheck.slice(0, 40).join(" · ")}${toCheck.length > 40 ? " …" : ""}`,
      ],
    }).replace("# Tathabbut evaluation — live run", `# Baseline — ${provider} (no retrieval)`);
    const out = join(DIR, "runs", `${summary.timestamp.replace(/[:.]/g, "-")}-baseline-${provider}`);
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "results.json"), JSON.stringify({ summary, results, citationsToCheck: toCheck }, null, 1));
    writeFileSync(join(out, "report.md"), report);
    console.log(`report: ${join(out, "report.md")}`);
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

if (require.main === module) main();

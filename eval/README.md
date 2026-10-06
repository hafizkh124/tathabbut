# Tathabbut evaluation suite

Measures the targets of [`docs/07-evaluation-plan.md`](../docs/07-evaluation-plan.md) on the path the screen really uses:
`/api/ocr` (screenshots) → `/api/verify` → `/api/turath` for every claim the screen sends to the books (its patch applied).
Scoring rules are in [`scoring.ts`](./scoring.ts) and unit-tested in [`scoring.test.ts`](./scoring.test.ts).

> **Status:** no live benchmark has been run yet. Until a live run exists under `eval/runs/`, no accuracy figure may be
> quoted. The specialist has not reviewed the drafted and external labels yet, so a live run is **provisional** for those
> categories (the report says so on every line it affects).

> **Data not in the public repository:** `dataset.json`, `sources/v1-snapshot.json`, the screenshots and each run's
> `results.json` hold third-party texts (Sahih International, HadeethEnc grades, quranlab/hadith) whose licences do not
> allow republishing here. The code, the scoring rules and the run reports (`runs/*/report.md`) are published.

## Files

| File | What it does |
|---|---|
| `build-dataset.ts` | Builds `dataset.json` **offline and deterministically** (seeded) from `sources/`. `--check` fails if the file is stale. Writes `dataset-audit.md`. |
| `sources/v1-snapshot.json` | Raw texts fetched once by the first builder (mushaf Uthmani, Junagarhi Urdu, Sahih International, quranlab/hadith). Only texts and source metadata are reused. |
| `sources/lists.ts`, `sources/no-source.ts` | Drafted lists (circulating sayings, fiqh questions, invented no-source texts). |
| `fetch-sources.ts` | Optional: fetches full-text hadith rows from Hugging Face → `sources/hf-rows.json`, which the builder then prefers (needs network). |
| `make-screenshots.ts` | Renders a seeded sample of prompts as chat screenshots (`screenshots/`) for the OCR category. |
| `run-eval.ts` | The runner (in-process route handlers, or HTTP against a running app, or a mock harness check). |
| `summary.ts` | Metrics, 95% intervals, Markdown report. |
| `run-baseline.ts` | Baseline (§7.3): a plain chatbot (Gemini or OpenAI, no retrieval) on the same prompts; manual-search timing template. |
| `review.ts` | Specialist review sheet: export → fill decisions → import. |
| `turath-labels.ts` | Relevance/citation labelling of Turath passages from a run → precision@10 and citation correctness. |
| `check-leakage.ts` | Finds test texts that are already in the specialist's list (`circulating_sayings`). |

## Dataset (`dataset-audit.md` has the current counts)

Every item has: the app's own claim kind (`quran`, `hadith`, `scholar_quote`, `question`, `other`), the claim text as
quoted in the prompt (used to pair claims by text), the expected state as the app writes it, accepted alternatives,
the attribution to check (surah+ayah / collections / scholar), a `group` (all wordings of one source text), a `split`
(`dev` 30% / `test` 70%, by a hash of the group, so wordings of one text never straddle splits) and its label
provenance and review status.

| Category | Label basis |
|---|---|
| `quran_exact` | by construction — the mushaf text (one prompt per distinct verse text) |
| `quran_distorted` | by construction — a rule-made change (dropped word, swapped words, changed closing, و/ف), verified to differ from the verse and from every other verse in the pool |
| `quran_translation` | by construction — Junagarhi / Sahih International; the prompt no longer names the surah |
| `hadith_sahih` | Bukhari/Muslim (in the Sahihayn → مقبول by the grade scheme), HadeethEnc grade; the Prophet's words only, no chain of narrators, never cut |
| `hadith_weak` | external — kept only when **every** recorded grader says weak (or every one says very weak) |
| `hadith_disputed` | external — graders disagree; any grade one of them gave, or «غير حاسم», is accepted |
| `circulating_saying` | **drafted** (AI-drafted list, not the specialist's); items whose own note contradicts their state under the grade map are flagged `conflict` and left out of runs |
| `no_source` | by construction — invented texts tied to modern things; a referral is expected |
| `fiqh_personal`, `fiqh_general` | documented rule (docs/04 level د, and the fiqh-question rule), incl. third-person scenarios and Urdu/English questions |
| `multilingual` | HadeethEnc Urdu/English grade |
| `multi_claim` | inherited from the items each post quotes |
| `ocr_screenshot` | the quoted prompt rendered as an image |

**Known limits of this set** (also listed in `dataset-audit.md`): only 28 hadith have all graders agreeing on «weak»
(the snapshot cut texts at 280 characters; run `fetch-sources.ts` where Hugging Face is reachable to get more); no
«آية اقتطع سياقها» or specialist-chosen «غير حاسم» cases; rendered, not real, screenshots.

## Running

```bash
npm run eval:build                                   # rebuild dataset.json (deterministic)
npm test                                             # includes the scorer and dataset tests
npm run eval:mock -- --sample 10                     # harness check only: simulated answers, no target judged

npm run eval -- --sample 20                          # live, in-process: 20 prompts per category, test split
npm run eval -- --category quran_distorted,no_source --sample 50
npm run eval -- --all --concurrency 2                # the whole test split
npx tsx eval/run-eval.ts --mode api --api-url http://localhost:3000 --sample 20   # against a running app
```

Options: `--split test|dev|all` · `--seed N` · `--no-turath` · `--include-conflicts` · `--exclude-listed` ·
`--retries N` · `--delay ms` · `--concurrency N` · `--out dir`.

Each run writes **its own folder** `eval/runs/<time>-<mode>-<split>/` with `results.json` and `report.md`; nothing is
overwritten, and mock runs are git-ignored. The report records the commit, the dataset's sha256, the model, the seed
and the sampling.

Cost: set `EVAL_PRICE_INPUT_PER_MTOK` and `EVAL_PRICE_OUTPUT_PER_MTOK` (USD per million tokens, from the provider's
price list) for a USD figure; token counts are always reported (Gemini's `usageMetadata`, now returned by
`/api/verify` and `/api/ocr`).

## How a prompt is scored

1. Expected and extracted claims are **paired by text** (one-to-one, best overlap first; Uthmani and standard spellings
   compare equal). Recall can never exceed 100%; extra claims lower precision but do not fail the prompt.
2. A prompt **passes** when every expected claim is found with the right **kind**, the exact **state** (or an accepted
   alternative) and the right **attribution**, and **no claim in the answer is fabricated**.
3. **Attribution**: a verse must be the labelled surah **and ayah** (or a place with the same text, for repeated
   verses); a hadith must show a narration from one of the labelled collections; a saying from the list must carry
   the labelled scholar/reference.
4. **Fabricated** means the shown evidence does not hold the text, or does not give the shown state: a Dorar narration
   that is another text, a state different from the narrations' own summary, a list entry for another text, a verse
   that does not contain the quote, a Turath passage that does not hold the text, a grade with no evidence.
5. **Referral** is measured on personal questions and no-source texts (expected «إحالة»).
6. **Infrastructure failures** (Gemini quota/5xx, Dorar relay down, timeouts) are retried, then reported apart and
   excluded from the rates — they are not counted as wrong answers.
7. Rates carry a 95% Wilson interval; where several wordings share one source text the interval counts texts. A target
   is «met» only when the interval's lower bound reaches it.

## What people still have to do

1. **Specialist review** — `npx tsx eval/review.ts export` → fill `eval/review/labels-review.xlsx` → `npx tsx
   eval/review.ts import eval/review/labels-review.xlsx --reviewer "<name>"`. Rebuilding keeps the decisions. Do not
   change labels after the tool has run on the test split (docs/07 §7.4); look at errors on the dev split.
2. **Leakage check** — `npx tsx --env-file=.env.local eval/check-leakage.ts`, then rebuild; use `--exclude-listed`
   for a verification figure that does not come from the specialist's own list.
3. **Turath relevance** — after a live run: `npx tsx eval/turath-labels.ts export eval/runs/<run>`, mark each passage,
   `npx tsx eval/turath-labels.ts score eval/runs/<run>/turath-labels.xlsx`.
4. **Baselines** — `npx tsx --env-file=.env.local eval/run-baseline.ts --provider gemini --sample 20`, the same with
   `--provider openai` (`OPENAI_API_KEY`, `BASELINE_OPENAI_MODEL`), and `--manual-template 30` for a person to time
   a manual search.
5. Add specialist-chosen «غير حاسم» / «آية اقتطع سياقها» texts and real screenshots.

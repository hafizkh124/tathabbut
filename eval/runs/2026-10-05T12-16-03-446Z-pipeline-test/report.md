# Tathabbut evaluation — live run

> Live run of the system on the labelled set. Rates show the 95% Wilson interval (for categories with several wordings of one text, the interval counts distinct texts).

- **When:** 2026-10-05T12:16:03.446Z
- **Mode:** `pipeline` · model `gemini-3.8-flash` · commit `6d97723130`
- **Dataset:** sha256 `35767537e1a900ad` · split `test` · stratified, 80 per category, whole groups (seed 20261005) · Turath step on
- **Prompts:** 813 · measured 488 · infrastructure errors 325 (relay/quota/timeouts: excluded from rates, listed below)
- **Labels reviewed by the specialist:** 0% of prompts — results on drafted/external labels are **provisional**

## 1. Targets (docs/07-evaluation-plan.md §7.2)

| Metric | Target | Measured | Status |
|---|---|---|---|
| Accuracy (all expected claims found with right kind, state and attribution; nothing fabricated) | ≥ 90% | 80.5% (76.2–84.4, n=488) · macro 84.1% | ❌ below 90% · provisional (unreviewed labels) |
| Attribution accuracy (surah+ayah / collection / scholar shown) | ≥ 90% | 95.5% (92.3–97.4, n=268) | ✅ met (95% CI ≥ 90%) · provisional (unreviewed labels) |
| Fabricated attributions (evidence that does not hold the text or the state) | 0 | 0 | ✅ none found |
| Correct referral (personal fatwa + no-source texts) | ≥ 95% | 96.3% (90.9–98.6, n=109) | ◐ estimate meets 95%, CI does not · provisional (unreviewed labels) |
| Verification time, p95 (s) | < 30 | 5.7 (avg 3.0) | ✅ met |
| Claim extraction recall | measured | 99.8% (98.9–100, n=509) · precision 88.8% (86–91.1, n=572) | measured |
| Cost per verification | measured | 872 tokens/prompt (512 model calls) · set EVAL_PRICE_INPUT_PER_MTOK / EVAL_PRICE_OUTPUT_PER_MTOK for USD | measured |

## 2. By category

| Category | Prompts (measured) | Accuracy | State | Attribution | Recall | Precision | Kind | Referral | Fabrications | p95 s |
|---|---|---|---|---|---|---|---|---|---|---|
| `quran_exact` | 80 (78) | 32.1% (22.7–43, n=78) | 32.1% (22.7–43, n=78) | 98.7% (93.1–99.8, n=78) | 100% | 100% | 100% | — | 0 | 4.9 |
| `quran_distorted` | 80 (75) | 94.7% (87.1–97.9, n=75) | 98.7% (92.8–99.8, n=75) | 96% (88.9–98.6, n=75) | 100% | 100% | 100% | — | 0 | 4.3 |
| `quran_translation` | 80 (79) | 89.9% (81.3–94.8, n=79) | 98.7% (93.2–99.8, n=79) | 89.9% (81.3–94.8, n=79) | 98.7% | 100% | 100% | — | 0 | 3.2 |
| `hadith_sahih` | 80 (2) | 100% (34.2–100, n=2) | 100% (34.2–100, n=2) | 100% (34.2–100, n=2) | 100% | 100% | 100% | — | 0 | 5.3 |
| `hadith_weak` | 19 (1) | 100% (20.7–100, n=1) | 100% (20.7–100, n=1) | 100% (20.7–100, n=1) | 100% | 100% | 100% | — | 0 | 4.8 |
| `hadith_disputed` | 61 (2) | 100% (34.2–100, n=2) | 100% (34.2–100, n=2) | 100% (34.2–100, n=2) | 100% | 100% | 100% | — | 0 | 5.0 |
| `circulating_saying` | 80 (30) | 70% (43.4–90.3, n=30) | 70% (52.1–83.3, n=30) | — | 100% | 50.8% | 96.7% | — | 0 | 5.3 |
| `no_source` | 46 (28) | 85.7% (65.7–96.7, n=28) | 85.7% (68.5–94.3, n=28) | — | 100% | 71.8% | 100% | 85.7% | 0 | 5.7 |
| `fiqh_personal` | 58 (58) | 100% (83.2–100, n=58) | 100% (93.8–100, n=58) | — | 100% | 100% | 100% | 100% | 0 | 3.7 |
| `fiqh_general` | 64 (64) | 95.3% (75.4–99.1, n=64) | 95.3% (87.1–98.4, n=64) | — | 100% | 100% | 100% | — | 0 | 3.9 |
| `multilingual` | 80 (29) | 100% (88.3–100, n=29) | 100% (88.3–100, n=29) | — | 100% | 96.7% | 100% | — | 0 | 5.6 |
| `multi_claim` | 45 (17) | 41.2% (21.6–64, n=17) | 69.4% (53.1–82, n=36) | 100% (81.6–100, n=17) | 100% | 67.9% | 100% | 100% | 0 | 6.7 |
| `ocr_screenshot` | 40 (25) | 84% (65.3–93.6, n=25) | 85.2% (67.5–94.1, n=27) | 100% (78.5–100, n=14) | 100% | 81.8% | 100% | 100% | 0 | 18.2 |

**Answered from the specialist's own list** (`circulating_sayings`) — such answers test a lookup, not verification; docs/07 §7.1 keeps the test set apart from that list:

- `circulating_saying`: 80% of found claims (24/30)
- `no_source`: 7.1% of found claims (2/28)
- `multi_claim`: 2.8% of found claims (1/36)

## 3. Turath step

- Lookups made: 270 · unavailable: 71 · partial: 1 · claims whose state Turath changed: 0
- Passages that hold the asked text (hadith/scholar lookups): 98% (96.4–98.9, n=508)
- Citation problems (no book, no id, no turath.io link to that book, no citation): 0
- **Relevance (precision@10) for fiqh topics needs labels**: `npx tsx eval/turath-labels.ts export <run dir>` → the specialist marks each passage → `npx tsx eval/turath-labels.ts score <filled file>`.

## 4. Failures (first 25)

| Prompt | Category | Expected | Shown | Why |
|---|---|---|---|---|
| `quran_exact_12_5` | `quran_exact` | آية صحيحة النقل | آية منقولة بخطأ · سورة يوسف:5 | state |
| `quran_exact_42_1` | `quran_exact` | آية صحيحة النقل | آية منقولة بخطأ · سورة الفاتحة:1 | state |
| `quran_exact_21_6` | `quran_exact` | آية صحيحة النقل | آية منقولة بخطأ · سورة الأنبياء:6 | state |
| `quran_exact_6_20` | `quran_exact` | آية صحيحة النقل | آية منقولة بخطأ · سورة الأنعام:20 | state |
| `quran_exact_2_282` | `quran_exact` | آية صحيحة النقل | آية منقولة بخطأ · سورة البقرة:282 | state |
| `quran_exact_43_77` | `quran_exact` | آية صحيحة النقل | آية منقولة بخطأ · سورة الزخرف:77 | state |
| `quran_exact_28_29` | `quran_exact` | آية صحيحة النقل | آية منقولة بخطأ · سورة القصص:29 | state |
| `quran_exact_34_11` | `quran_exact` | آية صحيحة النقل | آية منقولة بخطأ · سورة سبأ:11 | state |
| `quran_exact_33_20` | `quran_exact` | آية صحيحة النقل | آية منقولة بخطأ · سورة الأحزاب:20 | state |
| `quran_exact_10_85` | `quran_exact` | آية صحيحة النقل | آية منقولة بخطأ · سورة يونس:85 | state |
| `quran_exact_17_76` | `quran_exact` | آية صحيحة النقل | آية منقولة بخطأ · سورة الإسراء:76 | state |
| `quran_exact_2_242` | `quran_exact` | آية صحيحة النقل | آية منقولة بخطأ · سورة البقرة:242 | state |
| `quran_exact_2_170` | `quran_exact` | آية صحيحة النقل | آية منقولة بخطأ · سورة البقرة:170 | state |
| `quran_exact_25_42` | `quran_exact` | آية صحيحة النقل | آية منقولة بخطأ · سورة الفرقان:42 | state |
| `quran_exact_6_100` | `quran_exact` | آية صحيحة النقل | آية منقولة بخطأ · سورة الأنعام:100 | state |
| `quran_exact_2_154` | `quran_exact` | آية صحيحة النقل | آية منقولة بخطأ · سورة البقرة:154 | state |
| `quran_exact_2_146` | `quran_exact` | آية صحيحة النقل | آية منقولة بخطأ · سورة البقرة:146 | state |
| `quran_exact_21_102` | `quran_exact` | آية صحيحة النقل | آية منقولة بخطأ · سورة الأنبياء:102 | state |
| `quran_exact_18_5` | `quran_exact` | آية صحيحة النقل | آية منقولة بخطأ · سورة الكهف:5 | state |
| `quran_exact_34_35` | `quran_exact` | آية صحيحة النقل | آية منقولة بخطأ · سورة سبأ:35 | state |
| `quran_exact_6_12` | `quran_exact` | آية صحيحة النقل | آية منقولة بخطأ · سورة الأنعام:12 | state |
| `quran_exact_11_32` | `quran_exact` | آية صحيحة النقل | آية منقولة بخطأ · سورة هود:32 | state |
| `quran_exact_49_14` | `quran_exact` | آية صحيحة النقل | آية منقولة بخطأ · سورة الحجرات:14 | state |
| `quran_exact_6_76` | `quran_exact` | آية صحيحة النقل | آية منقولة بخطأ · سورة الأنعام:76 | state |
| `quran_exact_12_21` | `quran_exact` | آية صحيحة النقل | آية منقولة بخطأ · سورة يوسف:21 | state |

## 5. Not measured (infrastructure)

- 323 × Dorar relay unreachable for a claim
- 2 × verify 502: network: fetch failed

## Notes

- Labels: 364 of 813 prompts have labels true by construction (mushaf text, rule-made change, invented text, Sahihayn); 0 are specialist-reviewed; the rest are drafted or external and make the figures provisional.
- Not covered by this set yet: «غير حاسم» and «آية اقتطع سياقها» cases chosen by the specialist, real (not rendered) screenshots.

---
*Generated by `eval/run-eval.ts`. Scoring rules: `eval/scoring.ts` (unit-tested in `eval/scoring.test.ts`).*

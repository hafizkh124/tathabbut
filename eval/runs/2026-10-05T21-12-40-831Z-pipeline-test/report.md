# Tathabbut evaluation — live run

> Live run of the system on the labelled set. Rates show the 95% Wilson interval (for categories with several wordings of one text, the interval counts distinct texts).

- **When:** 2026-10-05T21:12:40.831Z
- **Mode:** `pipeline` · model `gemini-3.8-flash` · commit `730195c0c5`
- **Dataset:** sha256 `5c90d1392e387c82` · split `test` · stratified, 15 per category, whole groups (seed 20261005) · Turath step on
- **Prompts:** 195 · measured 195 · infrastructure errors 0 (relay/quota/timeouts: excluded from rates, listed below)
- **Labels reviewed by the specialist:** 0% of prompts — results on drafted/external labels are **provisional**

## 1. Targets (docs/07-evaluation-plan.md §7.2)

| Metric | Target | Measured | Status |
|---|---|---|---|
| Accuracy (all expected claims found with right kind, state and attribution; nothing fabricated) | ≥ 90% | 88.7% (82.6–92.6, n=195) · macro 88.7% | ❌ below 90% · provisional (unreviewed labels) |
| Attribution accuracy (surah+ayah / collection / scholar shown) | ≥ 90% | 93.1% (87–96.5, n=116) | ◐ estimate meets 90%, CI does not · provisional (unreviewed labels) |
| Fabricated attributions (evidence that does not hold the text or the state) | 0 | 0 | ✅ none found |
| Correct referral (personal fatwa + no-source texts) | ≥ 95% | 88.4% (75.5–94.9, n=43) | ❌ below 95% · provisional (unreviewed labels) |
| Verification time, p95 (s) | < 30 | 5.2 (avg 2.7) | ✅ met |
| Claim extraction recall | measured | 100% (98.3–100, n=216) · precision 84% (79.1–88, n=257) | measured |
| Cost per verification | measured | 1079 tokens/prompt (210 model calls) · set EVAL_PRICE_INPUT_PER_MTOK / EVAL_PRICE_OUTPUT_PER_MTOK for USD | measured |

## 2. By category

| Category | Prompts (measured) | Accuracy | State | Attribution | Recall | Precision | Kind | Referral | Fabrications | p95 s |
|---|---|---|---|---|---|---|---|---|---|---|
| `quran_exact` | 15 (15) | 93.3% (70.2–98.8, n=15) | 93.3% (70.2–98.8, n=15) | 93.3% (70.2–98.8, n=15) | 100% | 100% | 100% | — | 0 | 6.8 |
| `quran_distorted` | 15 (15) | 80% (54.8–93, n=15) | 80% (54.8–93, n=15) | 86.7% (62.1–96.3, n=15) | 100% | 100% | 100% | — | 0 | 5.4 |
| `quran_translation` | 15 (15) | 100% (79.6–100, n=15) | 100% (79.6–100, n=15) | 100% (79.6–100, n=15) | 100% | 100% | 100% | — | 0 | 3.5 |
| `hadith_sahih` | 15 (15) | 93.3% (70.2–98.8, n=15) | 93.3% (70.2–98.8, n=15) | 100% (72.2–100, n=10) | 100% | 93.8% | 100% | — | 0 | 5.3 |
| `hadith_weak` | 15 (15) | 60% (35.7–80.2, n=15) | 66.7% (41.7–84.8, n=15) | 80% (54.8–93, n=15) | 100% | 93.8% | 100% | — | 0 | 3.1 |
| `hadith_disputed` | 15 (15) | 93.3% (70.2–98.8, n=15) | 100% (79.6–100, n=15) | 93.3% (70.2–98.8, n=15) | 100% | 93.8% | 100% | — | 0 | 4.2 |
| `circulating_saying` | 15 (15) | 100% (56.6–100, n=15) | 100% (79.6–100, n=15) | — | 100% | 60% | 100% | — | 0 | 3.7 |
| `no_source` | 15 (15) | 73.3% (40.9–92.9, n=15) | 73.3% (48–89.1, n=15) | — | 100% | 65.2% | 100% | 73.3% | 0 | 4.8 |
| `fiqh_personal` | 15 (15) | 100% (61–100, n=15) | 100% (79.6–100, n=15) | — | 100% | 100% | 100% | 100% | 0 | 3.7 |
| `fiqh_general` | 15 (15) | 100% (61–100, n=15) | 100% (79.6–100, n=15) | — | 100% | 100% | 100% | — | 0 | 3.2 |
| `multilingual` | 15 (15) | 100% (79.6–100, n=15) | 100% (79.6–100, n=15) | — | 100% | 93.8% | 100% | — | 0 | 3.9 |
| `multi_claim` | 15 (15) | 80% (54.8–93, n=15) | 87.9% (72.7–95.2, n=33) | 94.4% (74.2–99, n=18) | 100% | 68.8% | 100% | 88.9% | 0 | 3.8 |
| `ocr_screenshot` | 15 (15) | 80% (54.8–93, n=15) | 83.3% (60.8–94.2, n=18) | 100% (77.2–100, n=13) | 100% | 81.8% | 100% | 100% | 0 | 16.7 |

**Answered from the specialist's own list** (`circulating_sayings`) — such answers test a lookup, not verification; docs/07 §7.1 keeps the test set apart from that list:

- `circulating_saying`: 80% of found claims (12/15)
- `multi_claim`: 3% of found claims (1/33)

## 3. Turath step

- Lookups made: 154 · unavailable: 0 · partial: 0 · claims whose state Turath changed: 1
- Passages that hold the asked text (hadith/scholar lookups): 97.4% (96.1–98.3, n=778)
- Citation problems (no book, no id, no turath.io link to that book, no citation): 0
- **Relevance (precision@10) for fiqh topics needs labels**: `npx tsx eval/turath-labels.ts export <run dir>` → the specialist marks each passage → `npx tsx eval/turath-labels.ts score <filled file>`.

## 4. Failures (first 25)

| Prompt | Category | Expected | Shown | Why |
|---|---|---|---|---|
| `quran_exact_42_1` | `quran_exact` | آية صحيحة النقل | آية منقولة بخطأ · سورة الفاتحة:1 | state |
| `quran_distorted_37_86` | `quran_distorted` | آية منقولة بخطأ | لم يُعثر عليه — إحالة | state |
| `quran_distorted_2_203` | `quran_distorted` | آية منقولة بخطأ | آية صحيحة النقل · سورة البقرة:203 | state |
| `quran_distorted_17_101` | `quran_distorted` | آية منقولة بخطأ | لم يُعثر عليه — إحالة | state |
| `hadith_sahih_hadeethenc_597661d7` | `hadith_sahih` | مقبول | موجود في كتب التراث · المسند المصنف المعلل | state |
| `hadith_weak_tirmidhi_50` | `hadith_weak` | ضعيف | شديد الضعف أو لا أصل له · الجامع الصغير | state |
| `hadith_weak_abudawud_15` | `hadith_weak` | ضعيف | مقبول · الإيجاز شرح سنن أبي داود | state |
| `hadith_weak_tirmidhi_106` | `hadith_weak` | ضعيف | شديد الضعف أو لا أصل له · سنن الترمذي | state |
| `hadith_weak_ibnmajah_342` | `hadith_weak` | ضعيف | مقبول · صحيح الترغيب | state |
| `hadith_weak_ibnmajah_301` | `hadith_weak` | ضعيف | ضعيف · الجامع الصغير | attribution |
| `hadith_weak_ibnmajah_338` | `hadith_weak` | ضعيف | مقبول · خلاصة الأحكام للنووي | state |
| `hadith_disputed_ibnmajah_222` | `hadith_disputed` | غير حاسم | شديد الضعف أو لا أصل له · شعب الإيمان | attribution |
| `no_source_22_1` | `no_source` | لم يُعثر عليه — إحالة | ضعيف · فتح الباري لابن حجر | state |
| `no_source_22_2` | `no_source` | لم يُعثر عليه — إحالة | ضعيف · فتح الباري لابن حجر | state |
| `no_source_13_1` | `no_source` | لم يُعثر عليه — إحالة | ضعيف · عمدة التفسير | state |
| `no_source_13_2` | `no_source` | لم يُعثر عليه — إحالة | ضعيف · عمدة التفسير | state |
| `multi_claim_52` | `multi_claim` | مقبول | ضعيف · صحيح الجامع | state |
| `multi_claim_36` | `multi_claim` | آية صحيحة النقل | آية صحيحة النقل · سورة الحجر:45 | attribution |
| `multi_claim_26` | `multi_claim` | ضعيف | شديد الضعف أو لا أصل له · ميزان الاعتدال | state |
| `ocr_hadith_weak_tirmidhi_50` | `ocr_screenshot` | ضعيف | شديد الضعف أو لا أصل له · الجامع الصغير | state |
| `ocr_quran_distorted_2_267` | `ocr_screenshot` | آية منقولة بخطأ | آية صحيحة النقل · سورة البقرة:267 | state |
| `ocr_multi_claim_59` | `ocr_screenshot` | آية صحيحة النقل | آية منقولة بخطأ · سورة نوح:7 | state |

## Notes

- Labels: 82 of 195 prompts have labels true by construction (mushaf text, rule-made change, invented text, Sahihayn); 0 are specialist-reviewed; the rest are drafted or external and make the figures provisional.
- Not covered by this set yet: «غير حاسم» and «آية اقتطع سياقها» cases chosen by the specialist, real (not rendered) screenshots.

---
*Generated by `eval/run-eval.ts`. Scoring rules: `eval/scoring.ts` (unit-tested in `eval/scoring.test.ts`).*

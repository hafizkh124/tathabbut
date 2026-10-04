# 7. Evaluation Plan

Evaluation is never cut, even if other features are. Results are published in `docs/results.md` once measured;
until then, every number in these documents is a **target**.

## 7.1 Test set

- **200 texts**, prepared and labelled by the project's hadith specialist **before** the tool is run on them.
- Each expected answer is verified against the book and number.
- The test set is kept **separate from the database**: its answers live only in the test sheet
  (`Tathabbut_TestSet.xlsx`), not in `circulating_sayings`, otherwise the tool would simply return its own answers.
- Labels use the same grades as the product ([verification rules](04-verification-rules.md)).

Planned composition:

| Group | Approx. count |
|---|---|
| Quran (correct and wrongly quoted verses, translations) | 50–60 |
| Hadith (more than half **not** in the circulating-texts list) | ≈70 |
| Circulating sayings that are in the list | ≈30 |
| Referral cases (fiqh questions, personal cases, texts with no source) | 20–25 |
| Urdu/English posts and screenshots | ≈20 |

## 7.2 Metrics

| Metric | Definition | Target |
|---|---|---|
| Attribution accuracy | Share of claims where the source and grade shown match the specialist's label | ≥ 90% |
| Fabricated attributions | Count of results citing a source/grade that does not exist or does not contain the text | 0 |
| Correct abstention / referral | Share of no-source and level-د cases correctly answered with «إحالة» | ≥ 95% |
| Verification time | Seconds per text, end to end | < 30 s |
| Cost per verification | Tokens and cost per call, logged by the evaluation script | Measured, reported in the business model |
| Claim extraction recall | Share of claims in a post that are found (e.g. chain-message lines must not be dropped) | Measured |

## 7.3 Baseline comparison

The same texts are given to **ChatGPT** and **Gemini** (plain chat, no retrieval) and compared with manual search on:
time per text, fabricated attributions, abstention when no reference exists, and support for Urdu/translated text.

## 7.4 Process

1. Specialist finalises labels (at least 100 before the first run; no changes after the tool has run on them).
2. First run on all labelled texts → error analysis → tune thresholds on measured data → fix.
3. Final run and baseline comparison.
4. Publish `docs/results.md` (results, limitations, error cases) and a results page in the app.
5. Replace targets with measured results in the slides and README. If a result is not available, the claim is
   removed rather than estimated.

## 7.5 Expert feedback

Mentor feedback on the grade map, state rules and demo (if obtained) is recorded with dates in
`docs/mentor_feedback.md` as evidence for the reliability criterion.

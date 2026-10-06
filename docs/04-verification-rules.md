# 4. Verification Rules

## Second review: approved decisions received — 5 October 2026

- A translated hadith claim shows the first retrieved narration's Arabic matn with a translation-match label and a warning that this is not word-for-word verification of the translation. Shared replies preserve this distinction; the reconstructed search query is never displayed as the source text.
- The specific verdict «إسناده هالك» is severe weakness, explicitly restricted to that chain. It does not automatically reclassify every narrator criticism containing «هالك». The existing aggregate policy remains unchanged. Matching narrations returned to the interface are now capped at Dorar's 15-result limit instead of 8, so a reordered chain verdict does not disappear from the available evidence.
- Narrator criticism has a distinct scope and a note beside the complete source wording: it concerns a narrator in this chain, not a final verdict on every route. Shared replies preserve the note, scholar and exact source wording. This changes presentation metadata, not grades or aggregate policy. Detection is conservative; a chain defect such as «في إسناده انقطاع» is not automatically treated as criticism of a narrator.
- The specialist chose to keep longer/differing narrations together, with an explicit wording-and-verdict warning. Each such result displays the full retrieved matn beside its own source and verdict; shared replies preserve these differences. This does not change the aggregate-grade policy.
- A quotation's explicitly named weekday and prayer must occur in the retrieved narration before the existing text-matching rules may accept it. This rejects the observed Thursday/Asr quotation falsely matched to a Maghrib narration. It is a limited lexical safeguard, not proof of complete semantic identity; alternative time expressions and broader retrieval recall need separate evaluation.
- When no matching reference is found, the approved Urdu wording is «اس عبارت کا معتبر حوالہ نہیں ملا — اہلِ علم سے رجوع کریں». No grade is inferred from a different narration.

## Specialist-approved clarifications — 5 October 2026

- The Sahihayn's own records are displayed as inclusion in the collection: «امام بخاری نے اپنی صحیح میں روایت کیا ہے۔» / «امام مسلم نے اپنی صحیح میں روایت کیا ہے۔» Dorar's wholly bracketed additions have their own attribution label, rather than «His words». Another scholar's judgement remains attributed to that scholar. The same collection attribution is included in shared replies.
- The specific quotation «ولا تقربوا الصلاة» (or «لا تقربوا الصلاة») from 4:43 receives an omitted-context warning and the full verse. Ordinary partial quotations are not automatically flagged. This adds state «آية اقتطع سياقها».
- «إن الله لا يغير ما بقوم حتى يغيروا أنفسهم» is a misquotation of 13:11. Its correction preserves the related stretch through «ما بأنفسهم» and shows the word differences. These examples are development examples, not held-out evaluation data.
- For «واحمرارها في العصر» in the passage about the sun, the approved Urdu translation is «اور عصر میں سورج کے سرخ ہونے سے»; no added «زرد». The prompt includes the example; a targeted Urdu check rejects the observed wrong colour addition, including in an older cached answer. This narrow check does not certify every machine translation's meaning.
- The personal-case warning now says «کیونکہ حکم کا تعلق واقعے کی مکمل تفصیل سے ہوتا ہے۔», with the same meaning in Arabic and English. It is preserved in shared personal-case replies.

Implemented locally and covered by automated checks. Production rollout and real-interface rechecking are tracked separately in the joint work plan.

## Quran candidate refinement — 5 October 2026

Candidate ranking still starts with word edit distance. Ties are now resolved by normalized character edit distance over the aligned quotation, before the retrieval score. Alternatives must also be at least as close in characters as the top candidate, within the existing word-distance margin. This removes the unrelated «ولا تقربوا الفواحش» and «ولا تقربوا الزنا» alternatives beside «ولا تقربوا الصلاة», while keeping identical phrases found in several verses. No new similarity threshold or scholarly verdict was introduced. This is a retrieval heuristic checked against development examples; broader held-out evaluation of candidate recall remains necessary.

These rules decide what a user sees. They are **deterministic code**, not model output. The scholarly decisions
in them (the grade scheme, and which texts the circulating-texts list holds) were made by the project's hadith specialist. Every verdict itself comes from an approved source.

## 4.1 Order of authority

For each claim, evidence is taken in this order:

1. **The circulating-texts list** (`circulating_sayings`): well-known texts and their Urdu wordings, with the verdict, its author and the reference copied verbatim from Dorar's results.
2. **The Quran text** (for verse claims).
3. **Dorar al-Saniyya** — the verdicts of the muhaddithun, read through the grade map.

If none applies, the claim is **not found** and is referred.

## 4.2 States

| State (as displayed) | Meaning | Basis |
|---|---|---|
| آية صحيحة النقل | Verse quoted correctly | Mushaf text |
| آية منقولة بخطأ | Verse quoted with wrong wording; correct text shown with surah and verse | Mushaf text |
| آية (نص مترجم) | A translated verse; the approved translation is shown for comparison | Mushaf + approved translation |
| مقبول (صحيح أو حسن) | Accepted (sahih or hasan) | Dorar verdicts via grade map (directly, or as copied into the circulating-texts list) |
| ضعيف | Weak | Same |
| شديد الضعف أو لا أصل له | Very weak, or has no basis | Same |
| غير حاسم | Not decisive — the evidence does not settle it; all verdicts are shown with their authors | Same |
| لم يُعثر عليه — إحالة | Not found — referred to a specialist | No matching evidence |
| فتوى أو حالة شخصية — إحالة | Fatwa or personal case — referred | Governance level د |

Sayings wrongly attributed to scholars are not in it: they are looked
up in Dorar and Turath like any other text.

## 4.3 Quran rules

- Exact wording match → **آية صحيحة النقل**.
- Wording differs → **آية منقولة بخطأ**, with the correct text, surah and verse.
- Translation differs from the approved translation → "the translation differs from the approved translation;
  the approved translation is:" (translator and source named). The tool does **not** declare it a distortion; the
  reader judges.
- Displayed Quran text is never modified. Normalization (removing diacritics, the invisible `U+FEFF` mark, etc.)
  applies only to the search index.

## 4.4 Hadith grade scheme (decided by the specialist, 3 October 2026)

Implemented in `src/lib/gradeMap.ts` and covered by tests. Each Dorar verdict wording maps to one of four grades.

**1. مقبول (shown as «صحيح أو حسن»)**
- صحيح، حسن، قوي، جيد، ثبت، متفق عليه، and similar.
- «إسناده صحيح / حسن» counts as a verdict on the hadith.
- «أخرجه البخاري / مسلم» and «أخرجه في صحيحه» **when the muhaddith field is al-Bukhari or Muslim**.
- «متواتر».
- «من صحاح الأحاديث (وعيونها)» at the start of the wording.

**2. ضعيف**
- ضعيف، لين، مجهول، معلول، مرسل، منقطع، «في إسناده انقطاع».
- Every negation of authenticity: ليس بصحيح، لا يصح، لا يثبت، عدم صحة، and similar.

**3. شديد الضعف أو لا أصل له**
- منكر، مناكير، واه، متروك، مضطرب، موضوع، باطل، لا أصل له، كذب، كذاب، معضل، ضعيف جداً، ساقط، مختلق.
- «لم أجد / لم أقف / لا أعرفه…» at the start of the wording = لا أصل له.
- «لا أصل له لكن معناه صحيح» stays in this grade.

**4. غير حاسم**
- Reported disagreement (اختلاف، بعضهم), weakening forms (قيل، زعم), silence (سكت عنه).
- «أخرجه في صحيحه» by anyone other than al-Bukhari or Muslim (e.g. Ibn Hibban, Ibn Khuzayma); al-Mukhtara, al-Mustadrak.
- غريب.
- Wordings longer than 40 characters (except narrator criticism, which is taken by its wording).
- Acceptance mixed with weakness in one wording.

**Tie-break:** if one wording contains both weak and very-weak terms, the stronger (very weak) wins.

**Display policy:** the grade is always shown; medium-confidence grades carry a caution; the muhaddith's own words
are always shown beside it.

**Not a grade:** when Dorar has no matching result, the state is «لم يُعثر عليه — إحالة» — never «لا أصل له».

## 4.5 Matching rules

- Dorar returns 15 results even for invented text, so an empty response can never be the abstention signal.
  Abstention comes from **our matching step**: the model chooses only among returned candidate IDs, or says
  NO_MATCH, and any ID outside the list is rejected.
- The same hadith appears in many Dorar records; they are grouped per narration before grading.
- Different narrations of the same text keep separate verdicts (example: «إنما الأعمال بالنيات» via Umar is sahih in
  the Sahihayn, while a narration via Abu Sa'id al-Khudri was called «خطأ» by Ibn Abd al-Barr). They are shown
  side by side with the narrator, not merged.
- Confidence thresholds (e.g. similarity cut-offs) are set by **measuring on the test set**, not by guessing.

## 4.6 Content levels (from the challenge's scientific package)

| Level | Scope | Required handling | In Tathabbut |
|---|---|---|---|
| **أ** — settled core information | Quran, authentic approved hadith, pillars of Islam and iman, core seerah, ethics | Direct answer documented with its source | Verse found; hadith graded مقبول — shown with full source |
| **ب** — explanation and argument | Concepts, comparisons, objectives of the Sharia, general questions | Answer from approved material, show the reference, avoid certainty where disagreement is possible | Terminology from the approved glossary; explanations kept separate from source text; a question about a text's meaning is referred to the approved commentary |
| **ج** — disputed or highly sensitive | Fiqh disagreement, detailed creed, controversial history | Restricted answer, state the disagreement, or refer | «غير حاسم»: all verdicts shown with their authors, no merged ruling |
| **د** — fatwa or personal case | Ruling on an individual case, validity of a contract or act of worship, family disputes, legal/medical matters with a religious effect | No independent ruling; general information and referral to a qualified body | «فتوى أو حالة شخصية — إحالة» |

## 4.7 Things the model is never allowed to do

- Produce or change a grading.
- Produce or change an attribution or reference.
- Rewrite, correct or "improve" Arabic source text (observed in testing: the model silently corrected
  «إن الله مع الصابرون» to «الصابرين» — which would hide exactly the error we must flag).
- Pick a source that was not in the retrieved candidates.
- Answer a fiqh or personal question.

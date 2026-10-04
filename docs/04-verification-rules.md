# 4. Verification Rules

These rules decide what a user sees. They are **deterministic code**, not model output. The scholarly decisions
in them (the grade scheme, the circulating-texts list) were made by the project's hadith specialist.

## 4.1 Order of authority

For each claim, evidence is taken in this order:

1. **The specialist's reviewed list** of circulating texts (`circulating_sayings`).
2. **The Quran text** (for verse claims).
3. **Dorar al-Saniyya** — the verdicts of the muhaddithun, read through the grade map.

If none applies, the claim is **not found** and is referred.

## 4.2 States

| State (as displayed) | Meaning | Basis |
|---|---|---|
| آية صحيحة النقل | Verse quoted correctly | Mushaf text |
| آية منقولة بخطأ | Verse quoted with wrong wording; correct text shown with surah and verse | Mushaf text |
| آية (نص مترجم) | A translated verse; the approved translation is shown for comparison | Mushaf + approved translation |
| مقبول (صحيح أو حسن) | Accepted (sahih or hasan) | Dorar verdicts via grade map, or specialist's list |
| ضعيف | Weak | Same |
| شديد الضعف أو لا أصل له | Very weak, or has no basis | Same |
| غير حاسم | Not decisive — the evidence does not settle it; all verdicts are shown with their authors | Same |
| لم يُعثر عليه — إحالة | Not found — referred to a specialist | No matching evidence |
| فتوى أو حالة شخصية — إحالة | Fatwa or personal case — referred | Governance level د |

The specialist's list may also carry its own status for a text (for example a saying wrongly attributed to a
scholar); that status is shown as written by the specialist.

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
| **ب** — explanation and argument | Concepts, comparisons, objectives of the Sharia, general questions | Answer from approved material, show the reference, avoid certainty where disagreement is possible | Terminology from the approved glossary; explanations kept separate from source text |
| **ج** — disputed or highly sensitive | Fiqh disagreement, detailed creed, controversial history | Restricted answer, state the disagreement, or refer | «غير حاسم»: all verdicts shown with their authors, no merged ruling |
| **د** — fatwa or personal case | Ruling on an individual case, validity of a contract or act of worship, family disputes, legal/medical matters with a religious effect | No independent ruling; general information and referral to a qualified body | «فتوى أو حالة شخصية — إحالة» |

## 4.7 Things the model is never allowed to do

- Produce or change a grading.
- Produce or change an attribution or reference.
- Rewrite, correct or "improve" Arabic source text (observed in testing: the model silently corrected
  «إن الله مع الصابرون» to «الصابرين» — which would hide exactly the error we must flag).
- Pick a source that was not in the retrieved candidates.
- Answer a fiqh or personal question.

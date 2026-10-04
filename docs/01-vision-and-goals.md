# 1. Vision and Goals

## 1.1 The name

**تَثَبُّت (Tathabbut)** means "making sure before accepting". It comes from Surah al-Hujurat 49:6, in the reading
﴿فَتَثَبَّتُوا﴾ of Hamza, al-Kisa'i and Khalaf (the Hafs reading is ﴿فَتَبَيَّنُوا﴾): when news reaches you,
verify it before acting on it.

## 1.2 The problem

Every day, messages on WhatsApp and social media spread:

- weak or fabricated hadith attributed to the Prophet ﷺ;
- Quranic verses quoted with wrong wording;
- translations (Urdu, English) that distort the meaning;
- sayings of scholars attributed to the wrong person.

Checking them by hand is slow and needs hadith expertise. Keyword search fails when the text is translated or
narrated by meaning. General-purpose AI chatbots are fast, but they can invent a source or a grading that does not
exist — which is exactly the harm we are trying to prevent.

## 1.3 Who it is for

| Segment | Need |
|---|---|
| **Primary:** du'at and admins of WhatsApp groups, especially Urdu speakers, also Arabic and English | Check a forwarded post in seconds and reply with a sourced answer |
| **Secondary:** people who introduce Islam, content moderators, Islamic websites (later, through an API) | Screen content before publishing or sharing |

## 1.4 The solution

A simple multilingual web app (Arabic, Urdu, English, right-to-left aware). The user pastes a whole post as it is,
or uploads a screenshot. Tathabbut:

1. extracts every religious claim in it (verse, hadith, saying, fiqh question);
2. looks each one up in approved sources;
3. shows, for each claim, its **source with full reference**, the **grading of the specialists, attributed to the
   one who said it**, a warning when the wording or translation is distorted, and an explicit **"not found —
   refer to a specialist"** when no reference exists;
4. produces a result card ready to share back into the conversation.

## 1.5 Core principle

> **The AI extracts and matches. It never grades and never attributes.**

Every grading and every attribution is read from an approved source (Dorar's muhaddithun, the mushaf text, or the
specialist's reviewed list). The language model is not allowed to produce a verdict. This follows the challenge's
scientific package rule: «لا يُنسب حديث دون مصدر وحكم معتمد» — no hadith is attributed without an approved source
and grading.

When the evidence is missing or confidence is low, Tathabbut **abstains and refers** instead of guessing.

## 1.6 Goals

### Product goals
- **G1 — Speed:** turn minutes of manual searching into seconds per text.
- **G2 — Trust:** every displayed grading is traceable to a named muhaddith and source; zero invented attributions.
- **G3 — Honesty:** abstain and refer whenever no approved reference matches.
- **G4 — Reach:** work across Arabic, Urdu and English, including translated and paraphrased text.
- **G5 — Shareability:** give the user an answer they can paste back into the group.

### Measurable targets (to be measured on the 200-text test set; see [Evaluation plan](07-evaluation-plan.md))

| Metric | Target |
|---|---|
| Attribution accuracy | ≥ 90% |
| Fabricated attributions | 0 |
| Correct abstention / referral | ≥ 95% |
| Time to verify one text | < 30 seconds (vs. minutes by hand) |

These are targets, not results. Measured results replace them in `docs/results.md`.

### Challenge goals
- Submit a complete, working entry by **Tuesday 6 October 2026, 23:59 Riyadh time**.
- Reach the **top 20 finalists** (announced 18 October) and present live in the finals (19–22 October).

## 1.7 What Tathabbut is not

- It does **not** issue fatwas or rule on personal situations (content level د — it refers).
- It does **not** grade hadith by itself or by AI judgement.
- It does **not** judge people or groups.
- It is **not** a replacement for a scholar; it is a fast, sourced first check.

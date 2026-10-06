# 2. Scope

The MVP is sized for the challenge window (4–6 October 2026). Anything not listed under
"In scope" is out of scope for the submission.

## 2.1 In scope (MVP)

| Area | Included |
|---|---|
| **Input** | Paste text, or upload a screenshot (OCR), with a basic box to correct the OCR text before checking (fuller editing is planned, months 1–3) |
| **Languages** | Arabic, Urdu, English — interface and input; right-to-left layout |
| **Claim extraction** | Split a post into claims: verse / hadith / saying / fiqh or personal question |
| **Quran** | All 6,236 verses (Hafs mushaf text from quranpedia); find the verse; flag wrongly quoted wording and show the correct text with surah and verse number |
| **Quran translations** | Urdu (Muhammad Junagarhi) and English (Hilali–Khan), both King Fahd Complex editions via quranpedia; flag when a quoted translation differs from the approved one |
| **Hadith** | Live search of Dorar's public API, with a cache; Arabic text and the muhaddith's verdict as written (no hadith translation in the MVP) |
| **Circulating texts** | A list of widely circulated texts («النصوص المتداولة») with their Urdu wordings; each verdict, its author and its book/volume/page reference are copied verbatim from Dorar's results (checked by the specialist) |
| **Grading** | Fixed, rule-based mapping from Dorar's verdict wording to four grades, decided by the specialist ([rules](04-verification-rules.md)) |
| **Governance** | The four content levels أ / ب / ج / د from the challenge package; fiqh and personal questions are referred, never answered |
| **Output** | One card per claim with state, source, verdict and its author, and links to the original source; shareable text in Arabic, Urdu, English |
| **Terminology** | A small approved glossary (Arabic / English / Urdu) built from the package's Jamhara sample |
| **Review queue** | Texts that could not be resolved are stored (without user identity) for specialist review, behind a secret admin key |
| **API** | `POST /api/verify` (the full pipeline) and `GET /api/lookup` (Dorar lookup via cache) |
| **Evaluation** | A script that runs the test set and logs accuracy, time and cost per check (the comparison with general chatbots is planned) |

### Experimental (not part of any verdict)
- **Origin tracker** (`POST /api/origin`): uses Gemini with Google Search grounding to report the earliest
  public digital traces of a viral claim. It is clearly labelled as informational, never accuses individuals,
  and never affects a claim's state or grading. Its links are search results, not a source for any verdict or attribution.

## 2.2 Out of scope (after the challenge)

| Item | Why deferred |
|---|---|
| Voice input | Planned, months 1–3 (shown as «soon» in the app) |
| WhatsApp / Telegram bots, mobile app, browser text-select button, floating button | Channel work; the API is ready for them later |
| Hadith translations (Urdu/English) from HadeethEnc | Time; only where a hadith is matched, unmodified and cited |
| Local database of the Sahihayn | Resilience if Dorar is unavailable; needs a source with clear rights |
| Al-Maktaba al-Shamela integration | Its terms allow reading, search and citation only; needs permission |
| Full Jamhara dictionary integration | MVP uses a small approved sample |
| Tafsir, aqeedah, fiqh, seerah references | Only needed if the tool starts answering questions; out of verification scope |
| Isnad / narrator (rijal) views, topical hadith families | Beyond the MVP |
| Streaming responses (SSE), automatic switching across several LLM vendors | One complete response and one fallback model are enough |
| Rate limiter, OAuth for admin | Not needed for a judged demo |
| Hadith-translation datasets with unclear rights (e.g. fawazahmed0, hadith-json) | Excluded until their rights are clear |
| Formal permission and partnership with Dorar | Planned after the challenge (draft letter prepared) |

## 2.3 Roadmap after the challenge

As in the submitted presentation:

1. **Today:** text or image, in three languages, at a public link.
2. **Month 1 — permission and partnership:** formal permission from the digital libraries (Dorar al-Saniyya first,
   with thanks and a partnership proposal), and a pilot with a da'wah association or community office (planned, not yet in place).
3. **Months 1–3 — improvement:** fuller editing of the text read from an image, and voice input.
4. **Months 3–4 — sharing:** mobile app, WhatsApp and Telegram bots, and a floating button to check with one tap.
5. **Months 4–6 — sources:** hadith translations (HadeethEnc), the full Jamhara, and an API for platforms.

Later: a local Sahihayn database, and Shamela matching only with permission.

**Sustainability:** free for users — no sign-up, no ads, and no input stored against a user (only anonymous
unresolved texts for review and cached source answers). Costs (hosting, model calls, scholarly review) are to be
funded by awqaf and da'wah institutions. The digital libraries are target partners. The path is an association,
then a foundation, depending on demand. No source's content is ever sold.

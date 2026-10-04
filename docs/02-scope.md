# 2. Scope

The MVP is sized for a solo builder over the challenge window (4–6 October 2026). Anything not listed under
"In scope" is out of scope for the submission.

## 2.1 In scope (MVP)

| Area | Included |
|---|---|
| **Input** | Paste text, or upload a screenshot (OCR), with a box to correct the OCR text before checking |
| **Languages** | Arabic, Urdu, English — interface and input; right-to-left layout |
| **Claim extraction** | Split a post into claims: verse / hadith / saying / fiqh or personal question |
| **Quran** | All 6,236 verses (Hafs mushaf text from quranpedia); find the verse; flag wrongly quoted wording and show the correct text with surah and verse number |
| **Quran translations** | Urdu (Muhammad Junagarhi) and English (Hilali–Khan), both King Fahd Complex editions via quranpedia; flag when a quoted translation differs from the approved one |
| **Hadith** | Live search of Dorar's public API, with a cache; Arabic text and the muhaddith's verdict as written (no hadith translation in the MVP) |
| **Circulating texts** | A specialist-reviewed list of widely circulated texts («النصوص المتداولة»), each with verdict, who gave it, and book/volume/page reference |
| **Grading** | Fixed, rule-based mapping from Dorar's verdict wording to four grades, decided by the specialist ([rules](04-verification-rules.md)) |
| **Governance** | The four content levels أ / ب / ج / د from the challenge package; fiqh and personal questions are referred, never answered |
| **Output** | One card per claim with state, source, verdict and its author, and links to the original source; shareable text in Arabic, Urdu, English |
| **Terminology** | A small approved glossary (Arabic / English / Urdu) built from the package's Jamhara sample |
| **Review queue** | Texts that could not be resolved are stored (without user identity) for specialist review, behind a secret admin key |
| **API** | `POST /api/verify` (the full pipeline) and `GET /api/lookup` (Dorar lookup via cache) |
| **Evaluation** | A script that runs the test set, logs accuracy, time and cost per check, and compares with general chatbots |

### Experimental (not part of any verdict)
- **Origin tracker** (`POST /api/origin`): uses Gemini with Google Search grounding to report the earliest
  public digital traces of a viral claim. It is clearly labelled as informational, never accuses individuals,
  and never affects a claim's state or grading.

## 2.2 Out of scope (after the challenge)

| Item | Why deferred |
|---|---|
| WhatsApp / Telegram bots, Android app, browser text-select button, floating button | Channel work; the API is ready for them later |
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

1. Formal written permission from Dorar al-Saniyya, with thanks and a partnership proposal.
2. Pilot with an established da'wah association or community-awareness office (planned, not yet in place).
3. Hadith translations (HadeethEnc) and a local Sahihayn database.
4. Messaging-app bots and a public API for Islamic websites.
5. Full Jamhara integration; Shamela matching only with permission.
6. Sustainability path: association → foundation → non-profit company, depending on demand and funding.

The app stays free. No commercial model is chosen yet, and no external source's data will ever be sold or
licensed; any commercial use starts only after written permission from that source.

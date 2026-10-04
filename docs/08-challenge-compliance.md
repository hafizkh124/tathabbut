# 8. Challenge Compliance

**Islamic AI Challenge 2026** ("AI in the Service of Islamic Content"), organised by Bathel Foundation with
MCIT, SDAIA, Technical Transformation Company and Future Frontiers. Tathabbut is entered in **Track 4: knowledge
and verification tools that empower people who introduce Islam**.

## 8.1 Judging criteria and how Tathabbut addresses them

| Criterion | Weight | How Tathabbut meets it |
|---|---|---|
| Technical quality and use of AI | 25% | Gemini vision OCR; structured claim extraction with schema validation; cross-lingual retrieval with Arabic normalization; candidate-constrained matching; hallucination controls |
| Benefit per the track's success criterion | 20% | Separates authentic from weak and fabricated texts and makes the status of the evidence clear, for du'at handling real viral posts |
| Reliability and scientific soundness | 15% | Gradings only from approved sources; specialist-decided grade map; four content levels; no fatwa; abstention and referral; measured on a specialist-labelled test set |
| Innovation and added value | 15% | Whole-post and screenshot checking in one go; wrongly quoted verse detection with the correct text; shareable cards in three languages; narration-level verdicts instead of one merged label |
| Operational readiness (live demo) | 10% | Deployed on Vercel with Supabase; Dorar answers pre-cached so the demo cannot stall |
| User experience and accessibility | 10% | No sign-up; Arabic/Urdu/English with RTL; colour-coded states; mobile-first |
| Clarity of presentation and verifiability | 5% | Public GitHub repo, README with setup steps, these docs, 2-minute video, official Bathel slide template |

## 8.2 Required deliverables (submitted by the team lead on the challenge platform)

| # | Deliverable | Requirement | Status |
|---|---|---|---|
| 1 | Live demo link | Works fully in the cloud, no local install for judges | Deployed; completing features |
| 2 | Public GitHub repository | Public; full code; README with install/run steps; licences and sources | In progress |
| 3 | Walkthrough video | Max 2 minutes; problem, solution, live use, role of AI; YouTube (public/unlisted) or open Google Drive | To do (6 Oct) |
| 4 | Presentation | PDF or PPTX on the official Bathel template; problem, beneficiary, how it works, technical/AI, references and scientific package, sustainability and business model | Registration deck done; final deck 6 Oct |
| 5 | Documentation field | Setup and running, data sources and approved scientific packages, open licences, environment | Drawn from these docs |

## 8.3 Timeline

| Date (Riyadh time) | Milestone |
|---|---|
| Thu 1 Oct 2026 | Opening session; organisers allowed preparation to start |
| Sun 4 Oct, 07:00 | Submission system opens; official build days begin |
| 4–6 Oct | Daily attendance on the Discord bot: check-in 07:00–09:00, check-out 22:00 |
| **Tue 6 Oct, 23:59** | **Final submission closes (no extension).** Internal target: submitted by 20:00 |
| 7–15 Oct | First-round offline judging |
| 18 Oct | Top 20 finalists announced |
| 19–22 Oct | Finals: 8 minutes per team on Zoom (5 min presentation + live demo, 3 min Q&A; cut off at 5:00 exactly) |
| 26 Oct | Closing ceremony; 5 winners; SAR 200,000 total prizes |

Riyadh is 2 hours behind Pakistan time (the participant's location).

## 8.4 Scientific package compliance

| Package rule | Implementation |
|---|---|
| «لا ينسب حديث دون مصدر وحكم معتمد» | Every hadith shown carries source and the muhaddith's verdict from Dorar or the specialist's referenced list |
| Approved hadith references: dorar.net/hadith, approved editions on Shamela | Dorar used; Shamela linked for search only (planned as a source after permission) |
| Quran: approved text with approved translations (King Fahd Complex or quranpedia) | Hafs text and King Fahd Complex translations from quranpedia |
| Terminology: Jamhara preferred over automatic translation | Approved glossary table from the package sample |
| Content levels أ/ب/ج/د | Implemented as governance ([rules](04-verification-rules.md#46-content-levels-from-the-challenges-scientific-package)) |
| Anti-hallucination: abstain or refer when evidence is insufficient | «لم يُعثر عليه — إحالة», candidate-constrained matching |
| Transparency: disclose AI nature | Disclaimer in the UI and README |
| Privacy: collect only what is needed, with a stated policy | No accounts; no user identity in the review queue; Gemini processing disclosed |
| Test case: wrongly quoted verse | Correct text shown gently with surah and verse; nothing built on the wrong text |
| Test case: "give me a hadith proving this" when none exists | Refuses to invent; says no matching evidence was found |
| Test case: personal fiqh question | Recognised as level د; general information only, with referral |

## 8.5 Disclosures

- **Start version («نسخة البداية»):** with the organisers' permission, preparation and development started before
  4 October 2026. The repository's commit history shows when each part was written.
- **Reuse:** parts of the participant's own Al-Ulama Easy Editor (AGPL-3.0) — see [sources](05-data-sources-and-licensing.md#54-reuse-disclosure).
- **AI coding tools** were used to write code, which the organisers explicitly allow.
- **Secrets:** no keys in the repo; `.env.example` and the README explain how to obtain each key.

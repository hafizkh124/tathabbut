# 3. Requirements

Each requirement has an ID for tracking. Priority: **P0** = must ship in the submission, **P1** = should ship,
**P2** = nice to have (first to be cut if time runs short).

## 3.1 Functional requirements

### Input
| ID | Requirement | Priority |
|---|---|---|
| FR-01 | The user MUST be able to paste a full post (any mix of Arabic, Urdu, English) without pre-editing it. | P0 |
| FR-02 | The user SHOULD be able to upload a screenshot; the text is read by OCR (Gemini vision). | P1 |
| FR-03 | After OCR, the extracted text MUST be shown in an editable box so the user can correct it before checking. | P1 |
| FR-04 | Input length MUST be bounded, and over-long input rejected with a clear message. | P0 |

### Claim extraction
| ID | Requirement | Priority |
|---|---|---|
| FR-10 | The system MUST split the input into separate claims and classify each as verse, hadith, saying, or fiqh/personal question. | P0 |
| FR-11 | For Arabic claims, the system MUST use the text exactly as written in the post (`text_as_written`) and MUST verify it is a substring of the input. The model MUST NOT rewrite or "correct" Arabic text. | P0 |
| FR-12 | For Urdu/English claims, the model MAY produce an Arabic rendering for searching only; this rendering is never displayed as the source text. | P0 |
| FR-13 | Model output MUST be validated against a schema (JSON + Zod), retried on failure, and on repeated failure sent to the review queue — never silently assumed to be a hadith. | P0 |

### Quran
| ID | Requirement | Priority |
|---|---|---|
| FR-20 | The system MUST find the matching verse among all 6,236 verses using normalized Arabic search (normalization for the index only; displayed text is never changed). | P0 |
| FR-21 | If the quoted wording differs from the mushaf, the state MUST be «آية منقولة بخطأ» and the card MUST show the correct text with surah name and verse number. | P0 |
| FR-22 | The card MUST show the approved Urdu and English translations with translator and source. | P1 |
| FR-23 | If a quoted translation differs from the approved one, the card MUST say so and show the approved translation. The system MUST NOT label it «تحريف» by model judgement; the reader decides. | P1 |

### Hadith and sayings
| ID | Requirement | Priority |
|---|---|---|
| FR-30 | The specialist's circulating-texts list MUST be checked first; a match returns the specialist's verdict, its author and the book reference. | P0 |
| FR-31 | Otherwise the system MUST query Dorar's public API (cache first) using 2–4 distinctive words, retrying with fewer words on failure. | P0 |
| FR-32 | The model MAY only choose among the candidate IDs returned by the search (EXACT / SEMANTIC / DISTORTED / NO_MATCH). Any ID outside the candidate list MUST be rejected. | P0 |
| FR-33 | Each matched narration's verdict MUST be classified by the fixed grade map, never by the model. | P0 |
| FR-34 | Different narrations/chains of the same text MUST be shown separately with their own verdicts; they MUST NOT be merged into a single "disputed" verdict. | P0 |
| FR-35 | The muhaddith's own words MUST always be displayed next to the grade. | P0 |
| FR-36 | Sahihayn records marked «[صحيح]» by the encyclopedia MUST be shown as «أخرجه البخاري/مسلم في صحيحه», not as a verdict spoken by al-Bukhari or Muslim. | P0 |
| FR-37 | "No result in Dorar" MUST NOT be presented as «لا أصل له». That wording appears only when a muhaddith actually said it. Otherwise the state is «لم يُعثر عليه — إحالة». | P0 |

### Governance and output
| ID | Requirement | Priority |
|---|---|---|
| FR-40 | Fiqh questions and personal situations MUST be classified as level د and referred to a qualified person, with no ruling given. | P0 |
| FR-41 | Every card MUST show: state, source with reference, verdict with its author, and a link to the original source (Dorar, quran.com / quranpedia, Shamela search where relevant). | P0 |
| FR-42 | The UI MUST use a distinct colour for each state. | P1 |
| FR-43 | The user SHOULD be able to share/copy a result in Arabic, Urdu or English. | P1 |
| FR-44 | The UI MUST state clearly that this is an AI-assisted tool that does not issue fatwas. | P0 |
| FR-45 | Unresolved claims SHOULD be added to a review queue (no user identity stored), viewable at `/admin` with a secret key. | P2 |

### API
| ID | Requirement | Priority |
|---|---|---|
| FR-50 | `POST /api/verify` MUST accept text and return one result per claim with its evidence, as JSON. | P0 |
| FR-51 | `GET /api/lookup?q=` MUST return Dorar's results field by field, from cache or live, saying which. | P1 |

## 3.2 Non-functional requirements

### Scientific reliability (challenge standard)
| ID | Requirement |
|---|---|
| NFR-01 | **Traceability:** every religious text, quote or grading shown MUST be traceable to its source. |
| NFR-02 | **No fabrication:** no text or saying is attributed to a reference that does not contain it. |
| NFR-03 | **Abstain over guess:** when evidence is missing or confidence is low, abstain, qualify, or refer. |
| NFR-04 | **Qat'i vs. ijtihadi:** disputed matters are not presented as certain; differences are shown with attribution. |
| NFR-05 | **No independent fatwa.** |
| NFR-06 | **Separate text from explanation:** source text and generated explanation are visually distinct. |
| NFR-07 | **Terminology:** approved glossary terms take priority over automatic translation of sensitive terms. |
| NFR-08 | **Grading changes** are made only through `src/lib/gradeMap.ts` and its tests, and only with the specialist's decision. |

### Performance and availability
| ID | Requirement |
|---|---|
| NFR-10 | Target under 30 seconds per text end to end; measured on the test set. |
| NFR-11 | The live demo MUST stay up for judging (7–22 October). Dorar answers for the test set and demo texts are pre-cached so the demo does not depend on Dorar being reachable. |
| NFR-12 | Dorar calls use retry with backoff and spacing between calls; a stale cached answer is used (and labelled) if Dorar is unreachable. |
| NFR-13 | A fallback Gemini model is configured; HTTP 429/5xx triggers retry then fallback. |

### Security and privacy
| ID | Requirement |
|---|---|
| NFR-20 | No secret keys in the repository; `.env.example` documents every variable and where to obtain it. |
| NFR-21 | The service key is used server-side only; row-level security blocks the public key from private tables (e.g. the Dorar cache). |
| NFR-22 | No personal data is collected beyond what a check needs; the review queue stores no user identity. |
| NFR-23 | The README discloses that post text is sent to Google Gemini for processing, under its terms. |

### Data and licensing
| ID | Requirement |
|---|---|
| NFR-30 | Only sources actually used are cited; unused sources are listed as "planned". |
| NFR-31 | Third-party data dumps (quranpedia files, Dorar cache) are NOT committed to the public repo; only download/ingest scripts are. |
| NFR-32 | No scraping, no bypassing of bot protection; Dorar is used through its official public API, caching only queries actually asked. |
| NFR-33 | Every source's terms of use, attribution and our handling are documented ([sources](05-data-sources-and-licensing.md)). |

### Usability and accessibility
| ID | Requirement |
|---|---|
| NFR-40 | Works on mobile browsers (most users arrive from WhatsApp on a phone). |
| NFR-41 | Correct right-to-left rendering for Arabic and Urdu, left-to-right for English. |
| NFR-42 | No sign-up required to check a text. |

### Code quality
| ID | Requirement |
|---|---|
| NFR-50 | Core logic (Arabic normalization, Dorar parser, grade map, matching, verify) is covered by unit tests (`npm test`). |
| NFR-51 | The repository is public, with README instructions to install, configure and run locally. |

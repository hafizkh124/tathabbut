# 5. Data Sources and Licensing

**Principle:** a source is used only if it is needed for Tathabbut's scope **and** its terms allow our use.
A source whose permission is unclear is not used without permission. We do not scrape, and we do not place other
people's data in our public repository. Only sources actually used are cited; others are listed as planned.

## 5.1 Sources used in the MVP

| Domain | Source | How we use it | Terms and our handling |
|---|---|---|---|
| Hadith and gradings | **Dorar al-Saniyya** — official public API `dorar.net/dorar_api.json` ([service page](https://dorar.net/article/389)) | Search and retrieve the muhaddithun's verdicts as written; cache only queries actually asked | The service page offers the API for sites to display results; no explicit terms are stated and rights are reserved. We use the official API with an honest User-Agent, attribute every verdict to Dorar, cache narrowly, make no commercial use, and will request formal permission after the challenge (draft letter prepared). |
| Classical-book references | **Turath** via the server-side [`nusus` SDK](https://github.com/mwijanarko1/nusus), pinned at 0.7.2 | On each hadith claim, retrieve up to ten short passages; show the source citation, page locator, and Turath link as supporting material, separately from Dorar grading | The SDK's MIT license applies to the SDK code, not necessarily the API output or each underlying book. We show brief, attributed excerpts with direct links and do not persist or bulk-download book text. Confirm applicable Turath and book-level terms before expanding use; see [the decision record](10-turath-integration-decisions.md). |
| Quran text | **quranpedia** official dumps — Hafs mushaf (`mushafs-1.json.gz`) | Verse matching and correction of wrongly quoted verses | Free to use in-app; attribution and link preferred. Downloadable redistribution would require quranpedia's name, link and version. The file's SHA-256 matches the published value. We describe it as «نص مصحف حفص من quranpedia». Morphology/treebank fields (GPL/MIT) are not used. |
| Quran translations | **quranpedia**: Urdu — Muhammad Junagarhi (id 1966); English — Hilali & Khan (id 1948); both King Fahd Complex editions | Show the approved translation; flag differing translations | Same quranpedia terms. No published hash for translation files, so we store our own. Footnotes are not displayed in the MVP (they contain commentary and hadith we have not reviewed). |
| Circulating texts | **Specialist's own list**, each entry attributed to al-Maqasid al-Hasana, Kashf al-Khafa', al-Silsila al-Da'ifa (book, volume, page) | Recognise widely circulated unauthentic texts | Our own work. Entries are checked against the books themselves (via Shamela / Turath as reading libraries; the reference is the book). No bulk dumps of these books are stored. |
| Terminology | **Jamhara** sample terms from the challenge's scientific package ([islamic-content.com](https://islamic-content.com/dictionary)) | Approved Arabic/English/Urdu equivalents in the interface and replies | Small table (≈10–20 terms) taken from the package; Urdu equivalents decided by the specialist. |
| Language model | **Google Gemini** (generation, vision/OCR, embeddings) | Claim extraction, OCR, candidate matching; never grading | Post text is sent to Google for processing; disclosed in the README. Keys are server-side only. |

## 5.2 Sources considered and not used

| Source | Decision | Reason |
|---|---|---|
| Tanzil translations | Not used | Non-commercial-only condition; quranpedia/King Fahd editions used instead |
| fawazahmed0 hadith datasets, hadith-json | Not used | Translations appear copied from third-party sites; rights unclear |
| Al-Maktaba al-Shamela (as a data source) | Planned | Terms allow reading, search and citation only |
| HadeethEnc hadith translations | Planned | Deferred for time; to be used unmodified and cited, only for matched hadith |
| Local Sahihayn database | Planned | Needs a source with clear rights |
| Full Jamhara, tafsir, fiqh, seerah references | Planned | Outside the verification scope of the MVP |

## 5.3 What is in the public repository

- **Included:** source code, database migrations, scripts that download and ingest data from the original sources,
  tests and small test fixtures.
- **Not included:** quranpedia dump files, the Dorar cache, API keys, `.env.local`.

## 5.4 Reuse disclosure

Parts of the participant's own earlier project, **Al-Ulama Easy Editor** (AGPL-3.0, owned by the participant), were
reused: the Dorar response parser and Arabic text normalization / wording comparison. No data was copied from it.

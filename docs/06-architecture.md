# 6. Architecture

## 6.1 Pipeline

```
User (paste text / upload screenshot)
  │
  ▼
Next.js web app ──► POST /api/verify
  1. OCR (if image)                          Gemini vision
  2. Extract claims: verse / hadith /        Gemini, JSON output validated with Zod
     saying / fiqh-personal                  failure → review queue (never assumed to be hadith)
  3. Arabic rendering for search             only for Urdu/English claims; Arabic kept verbatim
  4. Retrieve candidates
       verse          → quran_verses (normalized text, trigram + full-text search)
       hadith/saying  → circulating_sayings, then Dorar API (cache first, via relay)
       no verdict / general fiqh question → Turath book passages (no verdict drawn from them)
  5. Match                                   model picks only from candidate IDs:
                                             EXACT / SEMANTIC / DISTORTED / NO_MATCH
  6. Decide state                            fixed rules + gradeMap.ts (no model)
  7. Governance level                        أ / ب / ج / د (display label, src/lib/levels.ts)
  8. Attach translations                     quran_translations
  9. Return cards + shareable text
 10. After the cards are on screen (separate calls, never blocking them):
       Turath passages (/api/turath), questions العلماء already answered (/api/alulama)

Before step 1 (optional, FAST_PATH=1): one short Arabic quotation is checked directly against the
circulating-texts list, the mushaf and Dorar; only a strong positive result answers, anything else
goes the normal way. Share requests («انشرها …») and greetings are removed from claims in step 2
(src/lib/chainPressure.ts) and are never searched for.
```

## 6.2 Components

| Component | Location | Role |
|---|---|---|
| Web UI | `src/app/page.tsx`, `src/components/` | Input, cards, source modal, sharing |
| Verify API | `src/app/api/verify/route.ts`, `src/lib/verify.ts` | Runs the pipeline; routes each claim to the right check |
| Claim extraction | `src/lib/claims.ts`, `src/lib/gemini.ts` | Model calls, schema validation, retries, fallback model |
| Arabic normalization | `src/lib/arabic.ts` | Search-only normalization and wording comparison |
| Quran check | `src/lib/quranCheck.ts`, `quranData.ts`, `quranTranslation.ts` | Verse lookup, word-level difference, translations |
| Dorar client | `src/lib/dorar.ts`, `lookup.ts`, `dorarCache.ts` | API call, HTML parsing, cache-first lookup, stale fallback |
| Hadith matching | `src/lib/hadithMatch.ts` | Candidate selection and grade summary per narration |
| Grade map | `src/lib/gradeMap.ts` | Specialist's rules from verdict wording to grade |
| Circulating texts | `src/lib/sayingsMatch.ts`, `sayingsSheet.ts`, `scripts/load-sayings.ts` | Match against and load the circulating-texts list |
| Origin tracker (experimental) | `src/lib/originTracker.ts`, `src/app/api/origin/route.ts` | Public digital traces of a viral claim; informational only — its links are search results, never a source for a verdict or attribution |
| Share requests | `src/lib/chainPressure.ts` | Finds «forward this»-type requests (Arabic, Urdu, English); pure, also used by the screen |
| Summary and levels | `src/lib/summary.ts`, `src/lib/levels.ts` | The line over the results and the أ–د badge, from the states alone |
| Soft reply | `src/lib/softReply.ts`, `src/components/SoftReplyDialog.tsx` | A reply to whoever forwarded a text that does not hold, composed only from the result's own fields |
| Fast path | `src/lib/fastPath.ts`, `eval/fastpath-offline.ts` | The checks that need no model, for one short Arabic quotation; off unless `FAST_PATH=1` |
| العلماء | `src/lib/alulama.ts`, `alulamaMatch.ts`, `alulamaSync.ts`, `src/app/api/alulama/`, `src/app/api/cron/alulama/`, `scripts/sync-alulama.ts` | Our copy of the answered questions of alulama.org: parse, daily sync, matching, the card |
| Sahih alternative (experimental, off) | `src/lib/alternative.ts`, `src/app/api/alternative/`, `eval/alternatives.ts` | An authentic text on the same matter for a soft reply; `ALTERNATIVE=1`, not wired to the screen until its check passes |
| Dorar relay | `worker/` (Cloudflare Worker) | Forwards Dorar API calls from a network location Dorar accepts |
| Data scripts | `scripts/` | Download and ingest Quran data, warm and upload the Dorar cache |

## 6.3 Database (Supabase, PostgreSQL)

Schema in `supabase/migrations/`.

| Table | Contents | Size |
|---|---|---|
| `quran_verses` | Hafs mushaf text + normalized search text | 6,236 |
| `quran_translations` | Urdu (Junagarhi) and English (Hilali–Khan); cleaned text plus raw text kept unshown | 12,472 |
| `circulating_sayings` | Circulating texts and their Urdu wordings, with the verdict, its author and reference copied from Dorar's results, correct text, notes | 55 |
| (no table) glossary | The 10 sample terms of the package's Jamhara glossary are a fixed list in `src/lib/translate.ts`, used as approved equivalents when book excerpts are machine-translated | 10 |
| `dorar_cache` | Raw Dorar responses per normalized query, with fetch time; private (service key only) | As queried |
| `turath_cache` | The answer to a Turath lookup per normalized query and kind (hadith, scholar_quote, fiqh), 30-day TTL; private (service key only) | As queried |
| `turath_translations` | The machine translation of a Turath passage per SHA-256 of the Arabic text and language (ur, en); private (service key only) | As translated |
| `alulama_posts` | The answered questions of alulama.org (about 8,500): title, folded search text, the first ~500 characters of the answer, the shaikh named under it, link back, date; private (service key only); migration 014 | ~22 MB with indexes |
| `sync_state` | Where the daily العلماء sync stands | 1 |
| `review_queue` | Unresolved texts, no user identity (`/admin` page not built yet) | — |
| `data_sources` | Source name, version, link, licence notes | — |

There is deliberately **no local hadith collection** in the MVP.

## 6.4 Infrastructure

| Piece | Choice |
|---|---|
| App hosting | Vercel (Next.js 16, region Singapore) |
| Database | Supabase (Singapore, free tier); row-level security on private tables |
| Dorar access | Cloudflare Worker relay with placement near dorar.net (direct calls from Vercel were blocked by Dorar's own firewall) |
| Language model | Gemini flash model with a fallback flash model (no embedding model in this version); low thinking level for speed (≈2.5 s per call measured) |
| Caching | Supabase Dorar cache (30-day freshness, stale fallback) plus edge cache on `/api/lookup` |

## 6.5 Design decisions

- **One verification API, thin clients.** Web now; bots and website integrations later reuse the same API.
- **Rules over model for anything scholarly.** The model's job ends at extraction and candidate choice.
- **Verbatim Arabic.** Arabic claims are never passed through the model's rewriting; code checks the claim is a
  substring of the post.
- **Cache narrowly.** Only answers to queries actually asked are cached; no bulk harvesting. The one exception is
  العلماء' own question-and-answer pages, which belong to the same organisation as Tathabbut and are copied as short
  excerpts with a link back (see 5.1).
- **A source is shown as it is.** The العلماء card carries that site's own answer and shaikh, apart from the books of
  Turath, and says it is not Tathabbut's ruling; for a personal case there is no ruling at all, only the way to ask.
- **A cached answer follows the pipeline.** `postKey` carries a version number that is raised whenever the way a post is
  read changes, so an answer made the old way is not served again.

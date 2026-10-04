# Turath Integration — Decision Record

> **Reconciled 2026-10-05.** Where this record and [11-turath-extension-decisions.md](11-turath-extension-decisions.md) differ, document 11 and the chat decisions of the specialist hold (category-scoped search, card state and the «غير حاسم» lines, the ruling-book tag). The client is now a direct `fetch` client; see Decision 1.

This is the durable record of material decisions for the Turath reference integration. Entries describe the chosen
implementation, why it was selected, alternatives considered, and whether the decision has been implemented or
still needs validation. Dates use the project timezone (Asia/Karachi).

## Decision 1 — SDK vs. Direct Fetch, runtime boundary, and dependencies

- **Date:** 2026-10-04 (Updated per consultation)
- **Context:** Tathabbut needs short, linkable Turath passages in ordinary application requests.
- **Chosen:** Use **direct `fetch()`** calls to the Turath endpoints (`api.turath.io`) within server-side code,
  eliminating third-party package dependencies (`nusus`). Keep all parsing, timeout handling, and citation
  normalization in-house (similar to `dorar.ts`).
- **Rationale:** Avoids relying on a single-maintainer third-party package (`nusus`), eliminates supply-chain risks,
  provides 100% auditable control over request payloads/headers, and keeps the project lightweight and self-contained.
- **Alternatives considered:** Using the TypeScript SDK `nusus 0.7.2` was considered and prototyped on the
  `turath-integration` branch; however, direct `fetch()` was selected to maintain zero external dependency and
  long-term stability.
- **Status:** **Implemented 2026-10-05**: `src/lib/turathApi.ts` (request, decoding, excerpting, citation) and `src/lib/turath.ts` (the lookup). `nusus` is removed from `package.json`. The API (`GET api.turath.io/search?q=&ver=3&page=&cat_id=`) returns 20 hits a page, each with `book_id`, `cat_id`, `author_id`, a JSON `meta` string, `snip` and the page `text`; with the markup removed the hit's text equals the `/page` text (8 of 8 compared), so one request per category is enough. Requests carry an honest User-Agent without a contact address.

## Decision 2 — Search scope, query source, and bounds

- **Date:** 2026-10-04 (Updated per consultation)
- **Context:** Additional references should be available both for hadith narrations and for scholarly/Sahaba sayings
  (`scholar_quote`), especially where Dorar does not index non-hadith sayings or when a hadith requires supplementary context.
- **Chosen:** Start one live retrieval for every claim whose extracted kind is **`hadith` OR `scholar_quote`**, using that
  claim's existing `query`, **scoped by Turath category** (hadith: «كتب السنة»; a saying: four categories in parallel) as
  decided in document 11, Decision 9. The first version of this entry chose an unfiltered search; the live probe of
  2026-10-04 showed it returning lectures, fatwa sites and manuscript catalogues instead of the books, and the specialist
  kept the category filter on 2026-10-05. Return up to **ten passages**, capped at **1,500 characters** each,
  with a **5-second overall timeout** (reduced from 10 seconds).
- **Rationale:** Expanding to `scholar_quote` covers sayings of Sahaba (e.g. Ali RA) and classical scholars that Dorar
  does not catalog. Reducing the timeout to 5 seconds prevents interface lag and ensures the verification pipeline
  remains fast and responsive for users.
- **Alternatives considered:** Searching only `hadith` was the initial implementation, but it left scholar sayings
  without textual references. A 10-second timeout was found to be too slow for responsive UI expectations.
- **Implementation detail:** An `AbortController` with a 5,000ms timer bounds the whole retrieval operation.
- **Status:** Decided; to be updated in lookup logic.

## Decision 3 — Response shape and authority separation

- **Date:** 2026-10-04 (Affirmed per consultation)
- **Context:** Turath books can report scholarly discussion and criticism, but retrieved text is not a normalized
  hadith grading decision.
- **Chosen:** Add `turath: { status, references }` to both `hadith` and `scholar_quote` claim results,
  independently from `dorar`, `state`, and `basis`. A successful search has `status: "success"` whether it returns
  passages or an empty array. A timeout, rate limit, malformed response, or other provider error has
  `status: "unavailable"` and no references.
- **Rationale:** A passage may inform specialist review and contextual reading but must not silently become an
  automated grade or alter the verdict produced by existing checks. Furthermore, if Dorar finds no match but
  Turath contains the text, the card ends as **«غير حاسم»** with a line naming the book and saying Dorar has no explicit
  ruling (document 11, Decision 11), without fabricating a verdict. The references travel in a separate request,
  `POST /api/turath`, made after `/api/verify` has answered (document 11, Decision 14).
- **Alternatives considered:** Folding Turath material into Dorar narrations or recomputing the grade from retrieved
  passages was rejected because the providers have different evidence shapes and authority.
- **Status:** Affirmed; covered by verification and schema types.

## Decision 4 — Errors, retries, caching, and text retention

- **Date:** 2026-10-04 (Updated per consultation)
- **Context:** Turath is an auxiliary, live source; repeat lookups should be instantaneous, and failures must not block verification.
- **Chosen:** Convert provider errors to `unavailable`; do not retry in the application. Coalesce identical
  normalized queries in-flight within a single request. **Cache successful query results in Supabase** (similar to
  `dorarCache.ts`), caching the query's returned references (citations, URLs, and capped passages) so frequently
  circulated hadiths and sayings return immediately without repeat network delay or rate-limiting. Do not store or
  bulk-download full book texts offline.
- **Rationale:** Persistent query caching speeds up responses for popular queries from ~3-5s down to <50ms,
  protects against third-party API downtime/rate-limits, and saves bandwidth, while still avoiding full-text corpus
  retention liability.
- **Alternatives considered:** Zero persistent caching was initially proposed to avoid storage schema changes, but
  was rejected by the project lead in favor of fast repeat lookups via Supabase.
- **Status:** Decided; Supabase cache adapter to be created for Turath lookups.

## Decision 5 — Citation and page-locator behavior

- **Date:** 2026-10-04 (Affirmed per consultation)
- **Context:** A reader must be able to identify and inspect the source rather than receive an uncited extract.
- **Chosen:** Preserve the book title and ID, author metadata when supplied, primary Turath URL, retrieval provenance,
  and page locator. Deduplicate passages by Turath book ID plus internal page ID. Display the internal page identifier
  separately from a printed page number and volume; never present the internal ID as a printed page.
- **Rationale:** Turath's internal page key is what identifies the linked database page; printed pagination is the
  citable physical source location. Keeping both prevents ambiguous or fabricated citations.
- **Alternatives considered:** Deduplicating solely by title or printed page could merge different books or distinct
  Turath records. Omitting page IDs would weaken reproducibility.
- **Status:** Affirmed; covered by parser/adapter and UI tests.

## Decision 6 — Attribution and text-rights assumption

- **Date:** 2026-10-04 (Affirmed per consultation)
- **Context:** The integration displays brief passages from books made accessible through Turath.
- **Chosen:** Display the book citation and a direct Turath link beside every returned excerpt. Retain only the
  minimum short passage needed for the result view. Treat digital library access as fair academic quotation;
  do not infer that it grants ownership or reuse rights for Turath's API output or the underlying books.
- **Rationale:** Attribution improves source traceability and fulfills academic standards, but it is not a substitute
  for permission. Displaying bounded snippets respects fair-use quotation while providing rigorous verifiable citations.
- **Alternatives considered:** Bulk copying or caching complete book text was rejected.
  Hiding the source link/citation was rejected because it would make passages unverifiable.
- **Status:** Affirmed; UI attribution confirmed for research and challenge demonstration.

## Decision 7 — Evaluation and acceptance

- **Date:** 2026-10-04 (Affirmed per consultation)
- **Context:** A technically valid citation does not by itself establish that a retrieved passage is useful or
  correctly supports the text under review.
- **Chosen:** Automated tests cover passage parsing, deduplication, citation/URL retention, ranked best-first
  ordering, printed vs. internal page locators, result bounds, and the invariant that lookup failures cannot alter
  the verification outcome. In parallel, separately evaluate textual relevance and citation correctness on a labelled
  benchmark set of hadiths and sayings, followed by specialist domain review.
- **Rationale:** Technical availability (HTTP 200) does not imply semantic relevance. Combining automated unit
  coverage with specialist human review ensures academic fidelity.
- **Alternatives considered:** Treating successful HTTP responses or raw passage counts as quality metrics was rejected.
- **Status:** Affirmed; automated tests in place, specialist review protocol active.

## Decision 8 — Passage count, ranking, and UI presentation

- **Date:** 2026-10-04 (Affirmed per consultation)
- **Context:** Finding a balance between surfacing rich classical works without overwhelming the card with long text.
- **Chosen:** Retrieve up to a maximum cap of **ten passages** from the provider. Preserve the provider's
  natural best-first relevance order (`provenance.rank`). In the user interface, employ progressive disclosure:
  render the **top 2–3 most relevant passages** immediately, and provide an expandable toggle/button (*"View more references ({n})"*)
  to reveal the remaining passages up to ten.
- **Rationale:** Ten provides deep reference material for researchers while preserving provider ranking. Displaying
  2-3 initially keeps the UI clean, readable, and focused, avoiding wall-of-text fatigue for general users.
- **Alternatives considered:** Showing all 10 passages unconditionally was rejected due to UI clutter; hard-capping
  at 3 was rejected because it conceals valuable scholarly discussions.
- **Evaluation:** Measure precision@10 and citation correctness on the labelled benchmark set.
- **Status:** Affirmed; progressive disclosure pattern to be reflected in the Next.js UI component.

## Implementation changes from the initial plan

- One abort deadline (5 s) bounds the whole lookup, which is several category searches in parallel.
- The 1,500-character cap is applied when a page is cut around the asked phrase and again in the adapter boundary.
- Failure details are intentionally not returned to the client; only `unavailable` is exposed, avoiding provider
  internals in the public response while preserving the normal verification result.

# Turath Integration — Decision Record

This is the durable record of material decisions for the Turath reference integration. Entries describe the chosen
implementation, why it was selected, alternatives considered, and whether the decision has been implemented or
still needs validation. Dates use the project timezone (Asia/Karachi).

## Decision 1 — SDK, runtime boundary, and version

- **Date:** 2026-10-04
- **Context:** Tathabbut needs short, linkable Turath passages in ordinary application requests.
- **Chosen:** Use the TypeScript SDK `nusus` **0.7.2**, importing `createTurathClient()` from `nusus/turath`. Keep the
  SDK client in server-side code. Do not make the local stdio `nusus-mcp` server a deployed-app dependency.
- **Rationale:** The SDK is intended for application code and `retrieve()` returns bounded passages together with
  citations, book metadata, locators, URLs, and provenance. Pinning the reviewed version makes its contract explicit.
  The SDK has no API key requirement in its published setup guide.
- **Alternatives considered:** Calling Turath endpoints directly would duplicate transport, normalization, and
  citation behavior. `nusus-mcp` is appropriate for a local MCP client/research workflow, not a Next.js request
  handler. Other Turath clients were not selected because the reviewed plan specifically needs Nusus's higher-level
  citation-carrying retrieval interface.
- **Snapshot clarification:** The Nusus repository describes an 8,124-book offline discovery snapshot scanned in
  March 2026. It is catalog metadata, not a local copy of every book's text and not a guarantee of exhaustive live
  retrieval coverage. The snapshot did not determine the SDK choice and is not Tathabbut's runtime corpus.
- **Status:** Implemented; review the pin when deliberately upgrading the SDK.

## Decision 2 — Search scope, query source, and bounds

- **Date:** 2026-10-04
- **Context:** Additional references should be available even when Tathabbut's specialist list, Quran check, or
  Dorar check takes an early-return path.
- **Chosen:** Start one live, unfiltered `retrieve()` for every claim whose extracted kind is `hadith`, using that
  claim's existing `query`. Do not pass a book, author, or category filter. For repeated normalized queries in one
  submitted post, share the same in-flight lookup. Return up to ten passages, capped at 1,500 characters each,
  with a ten-second overall timeout.
- **Rationale:** This is broad ranked retrieval across Turath, not a claim of exhaustive enumeration over every book.
  The cap constrains latency and the amount of third-party text shown. Request-local deduplication avoids duplicate
  provider traffic without retaining content between posts.
- **Alternatives considered:** Searching only when Dorar finds no grade would miss helpful source discussions for
  graded narrations and would make availability depend on another provider. Searching selected books or iterating the
  whole catalog is out of scope for this version.
- **Implementation detail:** The SDK client is configured with a 10-second transport timeout and an `AbortController`
  enforces the same bound across the complete retrieval. The pure adapter independently enforces the excerpt cap.
- **Status:** Implemented; retrieval relevance and provider rate limits remain evaluation items.

## Decision 3 — Response shape and authority separation

- **Date:** 2026-10-04
- **Context:** Turath books can report scholarly discussion and criticism, but retrieved text is not a normalized
  hadith grading decision.
- **Chosen:** Add `turath: { status, references }` to hadith claim results, independently from `dorar`, `state`, and
  `basis`. A successful search has `status: "success"` whether it returns passages or an empty array. A timeout,
  rate limit, malformed response, or other provider error has `status: "unavailable"` and no references.
- **Rationale:** A passage may inform specialist review but must not silently become an automated grade or change
  the result produced by the existing checks.
- **Alternatives considered:** Folding Turath material into Dorar narrations or recomputing the grade from retrieved
  passages was rejected because the providers have different evidence shapes and authority.
- **Status:** Implemented and covered by verification/API tests.

## Decision 4 — Errors, retries, caching, and text retention

- **Date:** 2026-10-04
- **Context:** Turath is an auxiliary, live source; its availability must not become a prerequisite for verification.
- **Chosen:** Convert provider errors to `unavailable`; do not retry in the application. Cache no provider result
  persistently. Coalesce identical normalized queries only within the current post request. Do not store or bulk
  download full book text. Return only capped excerpts and citations as part of the live response.
- **Rationale:** A single bounded attempt limits latency and duplicate load; a temporary failure remains visible and
  does not suppress or overwrite the Dorar result. No persistent text cache avoids expanding storage and retention
  obligations.
- **Alternatives considered:** Persistent caching and automatic retries could reduce repeat latency or transient
  errors, but require an explicit retention policy, stale-data behavior, and rate-limit evaluation first.
- **Status:** Implemented. Revisit retry or cache policy only with measured need and source-term review.

## Decision 5 — Citation and page-locator behavior

- **Date:** 2026-10-04
- **Context:** A reader must be able to identify and inspect the source rather than receive an uncited extract.
- **Chosen:** Preserve the SDK's citation, book title and ID, author metadata when supplied, primary Turath URL,
  retrieval provenance, and page locator. Deduplicate passages by Turath book ID plus internal page ID. Display the
  internal page identifier separately from a printed page number and volume; never present the internal ID as a
  printed page.
- **Rationale:** Turath's internal page key is what identifies the linked database page; printed pagination may be a
  separate source location. Keeping both prevents an ambiguous or fabricated citation.
- **Alternatives considered:** Deduplicating solely by title or printed page could merge different books or distinct
  Turath records. Omitting page IDs would weaken reproducibility.
- **Status:** Implemented; citations and both page fields are covered by adapter/UI tests.

## Decision 6 — Attribution and text-rights assumption

- **Date:** 2026-10-04
- **Context:** The integration displays brief passages from books made accessible through Turath.
- **Chosen:** Display the book citation and a direct Turath link beside every returned excerpt. Retain only the
  minimum short passage needed for the result view. Treat Nusus's MIT license as applying to the SDK software only;
  do not infer that it grants reuse rights for Turath's API output or the underlying books.
- **Rationale:** Attribution improves source traceability, but it is not a substitute for permission or a license.
  Many underlying works and editions can have distinct rights holders or terms.
- **Alternatives considered:** Bulk copying the 8,124-book snapshot or caching complete book text was rejected.
  Hiding the source link/citation was rejected because it would make passages difficult to verify.
- **Status:** UI attribution implemented. Confirm Turath API/output terms and the rights applicable to displayed
  excerpts before expanding public/commercial use; this record is not a legal determination.

## Decision 7 — Evaluation and acceptance

- **Date:** 2026-10-04
- **Context:** A technically valid citation does not by itself establish that a retrieved passage is useful or
  correctly supports the hadith under review.
- **Chosen:** Automated tests cover passage mapping and deduplication, citation/URL/provenance retention, ranked
  best-first ordering, internal versus printed page locators, result bounds, per-hadith lookup routing,
  request-local query deduplication, empty
  versus unavailable results, and the invariant that lookup failures cannot change a Dorar grade/state. The API and
  source modal are tested for passages, no hits, and unavailable status. Separately evaluate relevance and citation
  correctness on the labelled hadith set, followed by specialist review.
- **Alternatives considered:** Treating successful HTTP responses or the number of retrieved passages as a quality
  metric was rejected; relevance and citation correctness require labelled examples and human review.
- **Status:** Automated coverage implemented. Labelled-set evaluation and specialist review are pending; publish
  measured results only after they are completed.

## Decision 8 — Passage count and what “best matches” means

- **Date:** 2026-10-04
- **Context:** The initial three-passage cap surfaced useful Turath works, but the user asked to see at least ten
  passages where Turath has them.
- **Chosen:** Raise Nusus `retrieve()`'s requested cap to ten. Preserve the provider's `provenance.rank` order
  (best-ranked first) through adaptation and show that rank in the source view. Ten is a maximum: fewer may be
  returned if the provider has fewer distinct passages or a lookup is unavailable.
- **Rationale:** Nusus's retrieval results carry the source search order as provenance. Preserving it is the only
  documented, auditable relevance ordering available to this integration; rank is not a confidence score or a
  guarantee that every passage is relevant to hadith grading.
- **Alternatives considered:** An app-authored keyword or model-based reranker could reorder the results, but without
  a labelled specialist-reviewed set it could demote important critical discussions or promote superficial text
  matches. Defer reranking until retrieval quality is measured.
- **Evaluation:** Measure precision@10 and citation correctness on the labelled hadith set; have the specialist
  review the returned passages. If results are poor, use those judgements to decide whether to refine queries or add
  a separately evaluated reranker.
- **Status:** Ten-result cap and rank preservation implemented; the quality evaluation remains pending.

## Implementation changes from the initial plan

- The SDK-level ten-second timeout is supplemented by a whole-retrieval abort deadline because a retrieval may
  involve more than one HTTP operation.
- The 1,500-character cap is enforced both in SDK options and in the adapter boundary.
- Failure details are intentionally not returned to the client; only `unavailable` is exposed, avoiding provider
  internals in the public response while preserving the normal verification result.

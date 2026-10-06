# 9. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Dependence on Dorar** (every hadith grading comes from it) | High — no gradings if unavailable | Cache of asked queries with stale fallback; test-set and demo answers pre-cached; specialist's circulating-texts list works independently; formal permission and partnership requested after the challenge. Bot protection will never be bypassed and no bulk scraping will be done. |
| Dorar blocks requests from cloud IPs | High | Relay through a Cloudflare Worker placed near dorar.net, using an honest User-Agent; verified working from production |
| Dorar returns results even for invented text | High — false matches | Abstention decided by our matching step (candidate IDs only, NO_MATCH allowed); measured on non-existent texts in the test set |
| Dorar intermittent 5xx errors | Medium | Retry with backoff, spacing between calls, cache |
| Model silently corrects Arabic text | High — hides the very error we must flag | Use verbatim `text_as_written`; code checks it is a substring of the input; model never rewrites Arabic |
| Model drops a claim (e.g. a chain-message line) | Medium | Extraction recall measured on the test set; prompt and schema tuned on errors |
| Gemini quota exhausted or service down | High | Fallback model, retry on 429, cached results for the demo |
| Weak OCR on screenshots | Medium | User can correct the OCR text before checking |
| Live demo fails during judging | Critical — loses the full 10% | Deployed early; pre-warmed cache; full check of the link before submitting |
| Time runs out | High | Cut order: hadith translations → admin page → English UI → image input. **Testing and evaluation are never cut.** |
| Unclear rights on a data source | Medium — legal and reputational | Use only sources with clear terms; exclude others; document all terms; keep dumps out of the public repo |
| Overclaiming in slides or README | Medium — credibility with judges | Only measured numbers; partnerships described as planned; unused sources listed as planned |
| Mentors unavailable | Low | Mentor review is optional; scholarly review is done by the project's specialist |
| Privacy concerns about sending posts to Gemini | Low–Medium | No accounts or identity stored; processing disclosed in the README; a question's own words (which may tell a personal story) are sent to Gemini only, and to Turath only a topic of a few Arabic words |

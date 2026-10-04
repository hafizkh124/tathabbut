# Turath extension — decisions of 2026-10-04 and drafts awaiting the specialist

Companion to [10-turath-integration-decisions.md](10-turath-integration-decisions.md). Decisions below were taken in a
question-and-answer session with the specialist and **replace** the matching entries of document 10 where they differ
(Decision 2 «unfiltered search» and the response-shape part of Decision 3).

## Decisions

| # | Topic | Decision |
|---|---|---|
| 9 | Search scope | Search by Turath **category**, not unfiltered. Hadith → «كتب السنة» (6). A scholar's saying → «كتب السنة» (6), «الرقائق والآداب والأذكار» (23), «التراجم والطبقات» (26), «التاريخ» (25), parallel searches (Turath accepts one category per search). General fiqh → one search per madhhab category (14 حنفي, 15 مالكي, 16 شافعي, 17 حنبلي) **plus «الفتاوى» (کتب الفتاویٰ)** to cover classical and contemporary responsa/fatwa compendia (e.g. مجموع الفتاوى، فتاوى اللجنة الدائمة، الفتاوى الهندية). A passage is labelled with the category it was found in. *Why:* live probe — an unfiltered search for «إنما الأعمال بالنيات» returned lectures, fatwa sites and a manuscript catalogue and no Bukhari/Muslim in its first ten; with category filters it returned authentic collections. Approved by project lead with the explicit addition of the Fatawa category. |
| 10 | When a passage is «this text» | Stricter than Dorar's 60 %: the whole phrase is in the passage, or about 80 % of its content words (and, for a phrase of under three content words, only the whole phrase). Code: `turathMatch.ts`. *Status:* Affirmed per consultation to prevent noisy or coincidentally similar passages. |
| 11 | Card state | Turath gives no verdict. A hadith or a scholar's saying that Dorar did not find (or could not be reached for) but whose text the books hold ends as **«غير حاسم»** with the line «ورد في كتاب … ولا حكم صريح في الدرر» (saying: «منسوب إليه في كتاب …؛ صحة النسبة غير محققة»; Dorar unreachable: «… وتعذّر البحث في الدرر فلا نعرض حكمًا»). No fifth badge. Never «لم يُعثر عليه» when the books hold the text; never a grade taken from a passage. The lines stay even though a passage may itself say «موضوع» (seen live in Al-Albani's *Da'if al-Jami'*): they say where the text is found and that **Dorar** has no ruling; decision 13 tells the reader to read the book. Code: `turathFallback.ts`, `basis: "turath"`. *Confirmed by the specialist, 2026-10-05 (an earlier edit of this row that dropped the lines was set aside).* |
| 12 | Scholar sayings order | Precedence order: the specialist's verified list first, then Dorar, then Turath as comprehensive supplementary material. Approved per consultation. |
| 13 | Books that judge hadith | **No special tag** and no list: every passage is shown the same way (book, author, citation, category label) and the reader reads the author's words. *Specialist, 2026-10-05: the tag is not needed, because the card lines of decision 11 already say where the text is found and that Dorar has no ruling. A tag and a draft list were built and removed the same day.* |
| 14 | Loading | Separate request after the card: `POST /api/turath`. `/api/verify` does not wait for Turath. Measured live: 0.2–3.8 s per lookup (scoped). *Status:* Affirmed per consultation; progressive decoupled loading approved. |
| 15 | Caching | Persistent query cache in Supabase (like Dorar's `dorar_cache`), keyed by normalized query. Store only queries actually asked with a reasonable TTL (30 days). Disclose in `05-data-sources-and-licensing.md`. Approved per consultation. |
| 16 | General fiqh question | **Single unified section:** Present all retrieved fiqh and fatwa passages together in a single clean, combined section rather than splitting into 4 separate madhhab tabs/boxes. Each passage clearly states its book title, author, and citation. Maintain strict neutrality: no preference, no AI verdict, and no declaration of «the sound opinion». Approved per consultation. |
| 17 | Personal case | Doubt → treat as personal. Prominent warning banner + the **topic** extracted by Gemini and shown to the user (only the abstracted topic goes to Turath, preserving privacy) + educational passage retrieval + generic referral («راجع دار الإفتاء أو المفتي الذي تثق به»). Third-person only, never second-person rulings. Approved per consultation. |
| 18 | Translation | **Arabic text first + faithful machine translation underneath:** The original Arabic text is always shown first. If the user's interface language is Urdu or English, a faithful, literal machine translation is displayed underneath with a clear label (e.g., «ترجمة آلية»). In Arabic interface mode, no translation is needed. The AI model is strictly constrained to translating faithfully without adding commentary, interpretations, or explanations. Approved per consultation. |
| 19 | Phase 1 scope | **Phased, test-driven roadmap (Stages 1 to 5):** (1) Backend integration + Turath hadith fallback + scholar sayings, (2) UI screens and components across Arabic, Urdu, and English, (3) General fiqh inquiries and personal fatwa case handling with referral banners, (4) Faithful literal translation under Arabic excerpts, (5) Supabase query cache layer. Each stage undergoes complete test verification before advancing to the next. Approved per consultation. |
| 20 | Client | Turath is called **directly** (`src/lib/turathApi.ts`, native `fetch`), not through the `nusus` SDK, which is removed (specialist, 2026-10-05; see document 10, Decision 1). One request per category: a search hit already holds the whole page text (equal to `/page`, 8 of 8 compared), so no second request per hit. Whole-lookup deadline **5 s**. Measured live after the change: 0.17–0.7 s per lookup, the same passages as with the SDK. |

Built so far: decisions 9 through 19 affirmed in consultation; implementation proceeds strictly on user instruction.

## Approved Test Suite: ten test questions for personal / general classification

Used to measure and unit-test the classifier. The approved operational rule is: **in doubt, treat as personal**.
Approved per consultation.

| # | Question | Language | Expected | Topic extracted |
|---|---|---|---|---|
| 1 | میں نے غصے میں بیوی کو تین طلاقیں دے دیں، کیا میری طلاق ہو گئی؟ | ur | personal | طلاق الغضبان |
| 2 | میں سفر میں تھا اور 16 دن ٹھہرا مگر قصر کرتا رہا، کیا میری نمازیں ہو گئیں؟ | ur | personal | مدة القصر للمسافر |
| 3 | والد کا انتقال ہوا، ہم 3 بھائی اور 2 بہنیں ہیں، میراث میں میرا حصہ کتنا ہے؟ | ur | personal | الميراث |
| 4 | Is my fast broken? I ate by mistake yesterday in Ramadan. | en | personal | الأكل ناسيا في الصيام |
| 5 | نكاحنا كان بلا شهود فهل هو صحيح؟ | ar | personal | الشهود في النكاح |
| 6 | اسلام میں تین طلاق کا کیا حکم ہے؟ | ur | general | حكم الطلاق الثلاث |
| 7 | ما حكم سجود السهو؟ | ar | general | سجود السهو |
| 8 | What is the nisab for zakat? | en | general | نصاب الزكاة |
| 9 | اگر کوئی شخص غصے میں طلاق دے دے تو اس کا کیا حکم ہے؟ | ur | general, but borderline → **personal** by the doubt rule | طلاق الغضبان |
| 10 | سجدہ سہو کب واجب ہوتا ہے اور میں آج نماز میں بھول گیا تو کیا کروں؟ | ur | mixed → **personal** | سجود السهو |

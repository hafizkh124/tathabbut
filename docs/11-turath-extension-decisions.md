# Turath extension — decisions of 2026-10-04 and drafts awaiting the specialist

Companion to [10-turath-integration-decisions.md](10-turath-integration-decisions.md). Decisions below were taken in a
question-and-answer session with the specialist and **replace** the matching entries of document 10 where they differ
(Decision 2 «unfiltered search» and the response-shape part of Decision 3).

## Decisions

| # | Topic | Decision |
|---|---|---|
| 9 | Search scope | Search by Turath **category**, not unfiltered. Hadith → «كتب السنة» (6). A scholar's saying → «كتب السنة» (6), «الرقائق والآداب والأذكار» (23), «التراجم والطبقات» (26), «التاريخ» (25), four parallel searches (Turath accepts one category per search). General fiqh → one search per madhhab category (14 حنفي, 15 مالكي, 16 شافعي, 17 حنبلي). A passage is labelled with the category it was found in. *Why:* live probe — an unfiltered search for «إنما الأعمال بالنيات» returned lectures, fatwa sites and a manuscript catalogue and no Bukhari/Muslim in its first ten; with the category filter it returned Bukhari, Muslim and the Sunnah collections. The official package names the approved fiqh and aqeeda sources. |
| 10 | When a passage is «this text» | Stricter than Dorar's 60 %: the whole phrase is in the passage, or about 80 % of its content words (and, for a phrase of under three content words, only the whole phrase). Code: `turathMatch.ts`. |
| 11 | Card state | Turath gives no verdict. A hadith or a scholar's saying that Dorar did not find (or could not be reached for) but whose text the books hold ends as **«غير حاسم»** with the line «ورد في كتاب … ولا حكم صريح في الدرر» (saying: «منسوب إليه في كتاب …؛ صحة النسبة غير محققة»). No fifth badge. Never «لم يُعثر عليه» when the books hold the text; never a grade taken from a passage. Code: `turathFallback.ts`, `basis: "turath"`. |
| 12 | Scholar sayings order | Unchanged: the specialist's list, then Dorar, then Turath as additional material. |
| 13 | Books that judge hadith | A passage from a book on the specialist's list (below) carries a visible tag «كتاب في الحكم على الأحاديث» and the line «اقرأ عبارة الكتاب». The tool does **not** extract the book's verdict. |
| 14 | Loading | Separate request after the card: `POST /api/turath`. `/api/verify` does not wait for Turath. Measured live: 0.2–3.8 s per lookup (scoped). |
| 15 | Caching | Persistent cache in Supabase (like Dorar's). **Open risk:** the rights to the book text are unsettled (document 10, Decision 6). Until settled: a short TTL, store only queries actually asked, disclose it in `05-data-sources-and-licensing.md`. |
| 16 | General fiqh question (levels ب/ج) | Four madhhab sections, each with a passage from that madhhab's books, no preference and no «the sound opinion»; an empty section says «لم يُعثر في كتب هذا المذهب». |
| 17 | Personal case (level د) | Doubt → treat as personal. Warning banner + the **topic** extracted by Gemini and shown to the user (only the topic goes to Turath, never the story) + a generic referral line («راجع دار الإفتاء/المفتي الذي تثق به»); no names, addresses or location. Third person only, never «آپ کی طلاق ہو گئی». |
| 18 | Translation | Arabic first, machine translation under it with a clear label and the Jamhara terms in the prompt; Urdu and English, in the interface language; none when the interface is Arabic. The model translates only, adds nothing. |
| 19 | Phase 1 scope | Everything above, built in this order, each stage tested before the next: (1) backend + hadith fallback + sayings, (2) screens in three languages, (3) fiqh and personal cases, (4) translation, (5) cache. |

Built so far (stage 1): decisions 9, 10, 11, 14 in code; 13 awaits the list below.

## Draft: books that judge hadith (specialist to correct)

Ids are Turath's, from its catalogue. Mark each ✓ (keep), ✗ (remove) or add what is missing. Only an approved list goes
into `src/data/turathRulingBooks.json`.

**A. Books of fabricated and spurious reports**

| id | Book | Author |
|---|---|---|
| 882 | الموضوعات لابن الجوزي | ابن الجوزي |
| 6070 | الموضوعات للصغاني | الصغاني |
| 6068 | تلخيص كتاب الموضوعات | الذهبي |
| 18315 | الزيادات على الموضوعات | السيوطي |
| 6062 | اللآلئ المصنوعة في الأحاديث الموضوعة | السيوطي |
| 1432 | تنزيه الشريعة المرفوعة | ابن عراق |
| 2671 | الفوائد المجموعة | الشوكاني |
| 6064 | المصنوع في معرفة الحديث الموضوع | الملا علي القاري |
| 6056 | الأسرار المرفوعة في الأخبار الموضوعة | الملا علي القاري |
| 12738 | تذكرة الموضوعات | الفتني |
| 6079 | النخبة البهية في الأحاديث المكذوبة على خير البرية | الأمير المالكي |
| 6077 | الجد الحثيث في بيان ما ليس بحديث | أحمد العامري |
| 6063 | اللؤلؤ المرصوع | القاوقجي |
| 8566, 9388 | المنار المنيف في الصحيح والضعيف | ابن القيم |

**B. Books on widely circulated reports**

| id | Book | Author |
|---|---|---|
| 856, 9576 | كشف الخفاء | العجلوني |
| 1263, 1266, 23177 | المقاصد الحسنة | السخاوي |
| 21542 | الدرر المنتثرة في الأحاديث المشتهرة | السيوطي |
| 6076 | أسنى المطالب في أحاديث مختلفة المراتب | الحوت |

**C. Al-Albani's books of verdicts**

| id | Book |
|---|---|
| 1663 | ضعيف الجامع الصغير وزيادته |
| 10757 | صحيح الجامع الصغير وزيادته |
| 12762 | سلسلة الأحاديث الضعيفة والموضوعة |
| 9442 | سلسلة الأحاديث الصحيحة |
| 171 | صحيح الترغيب والترهيب |
| 179 | ضعيف الترغيب والترهيب |
| 22592 | إرواء الغليل |

**D. Books of takhrij (judge the chains of other books' hadith)**

| id | Book | Author |
|---|---|---|
| 1581, 21601 | التلخيص الحبير | ابن حجر |
| 11428 | نصب الراية | الزيلعي |
| 5922 | البدر المنير | ابن الملقن |
| 21550 | تخريج أحاديث الإحياء (المغني عن حمل الأسفار) | العراقي |

**Questions for the specialist:** is **D** a «ruling» book for this tag, or only A–C? Is al-Hakim's *al-Mustadrak*
(1424, 2266, 1200) one? Not found by name in the catalogue: «تمييز الطيب من الخبيث»; the Sunan sets of «صحيح وضعيف» —
give the exact titles if wanted.

## Draft: ten test questions for personal / general (specialist to correct the expected side)

Used to measure the classifier. The rule is: in doubt, personal.

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

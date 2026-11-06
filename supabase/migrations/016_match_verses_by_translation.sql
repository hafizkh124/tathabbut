-- 016: find a verse from an Urdu or English translation of it (the stored translations, quran_translations).
-- The verify route calls match_verses_by_translation only for a claim presented as Quran that has no Arabic wording, after
-- the usual ways found nothing; a missing function reads as «no match» (src/lib/quranCheck.ts matchVersesByTranslation),
-- so the code can be deployed before this is run. Run it once, as 011 and 012 were.
-- It scores by pg_trgm word_similarity, as match_verses does for Arabic. It finds a quote of the stored translator's own
-- wording (the many posts that copy it); it is a way to the verse, never a judge of any translation.
create or replace function match_verses_by_translation(q text, lang_in text default 'ur', min_score real default 0.6, max_results int default 3)
returns table (surah int, ayah int, surah_name_ar text, text_uthmani text, text_clean text, score real)
language sql stable
set search_path = public, extensions
as $$
  select v.surah, v.ayah, v.surah_name_ar, v.text_uthmani, v.text_clean, word_similarity(q, t.text)::real as score
  from quran_translations t
  join quran_verses v on v.surah = t.surah and v.ayah = t.ayah
  where t.lang = lang_in and word_similarity(q, t.text) >= min_score
  order by score desc, v.surah, v.ayah
  limit least(max_results, 10)
$$;

grant execute on function match_verses_by_translation(text, text, real, int) to anon, authenticated;

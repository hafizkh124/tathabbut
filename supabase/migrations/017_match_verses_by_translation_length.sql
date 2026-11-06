-- 017: match_verses_by_translation also says how many words the stored translation has, so a short text that only sits
-- inside a long verse's translation is not taken for that verse (live case 2026-11-07: a hadith of seven words scored 0.79
-- on 59:3, whose translation has 35). The caller requires the text to be a fair share of the translation (quranCheck.ts
-- acceptTranslationHit). The return type changes, so the function is dropped and made again.
drop function if exists match_verses_by_translation(text, text, real, int);

create function match_verses_by_translation(q text, lang_in text default 'ur', min_score real default 0.6, max_results int default 3)
returns table (surah int, ayah int, surah_name_ar text, text_uthmani text, text_clean text, score real, translation_words int)
language sql stable
set search_path = public, extensions
as $$
  select v.surah, v.ayah, v.surah_name_ar, v.text_uthmani, v.text_clean, word_similarity(q, t.text)::real as score,
         coalesce(array_length(regexp_split_to_array(btrim(regexp_replace(t.text, '[[:punct:]،۔؛؟]', ' ', 'g')), '\s+'), 1), 0) as translation_words
  from quran_translations t
  join quran_verses v on v.surah = t.surah and v.ayah = t.ayah
  where t.lang = lang_in and word_similarity(q, t.text) >= min_score
  order by score desc, v.surah, v.ayah
  limit least(max_results, 10)
$$;

grant execute on function match_verses_by_translation(text, text, real, int) to anon, authenticated;

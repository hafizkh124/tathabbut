-- Finds the verses inside a pasted text that holds several of them (src/lib/quranCheck.ts findVerseRuns).
-- match_verses scores how much of the quote is in one verse, so a paste of two or more verses fits no single verse
-- well. This scores the other way round: how much of each verse is in the paste (pg_trgm word_similarity with the
-- verse first), in every script of the verse (quran_verses, and quran_verse_scripts from migration 007), and keeps
-- each verse's best score. Nothing that exists is changed.
--
-- Short verses («الرحمن», «طه») are found inside many texts; longer verses come first among equal scores, and the
-- caller keeps only verses that sit in the paste in order, next to each other.
create or replace function match_verses_in_text(q text, min_score real default 0.75, max_results int default 100)
returns table (surah int, ayah int, surah_name_ar text, text_uthmani text, text_clean text, score real, script text)
language sql stable
set search_path = public, extensions
as $$
  with hits as (
    select v.surah, v.ayah, 'standard'::text as script, word_similarity(v.text_clean, q) as score
    from quran_verses v
    union all
    select s.surah, s.ayah, s.script, word_similarity(s.text_clean, q)
    from quran_verse_scripts s
  ), best as (
    select distinct on (h.surah, h.ayah) h.surah, h.ayah, h.script, h.score
    from hits h
    where h.score >= min_score
    order by h.surah, h.ayah, h.score desc, (h.script = 'standard') desc, h.script
  )
  select v.surah, v.ayah, v.surah_name_ar, v.text_uthmani, v.text_clean, b.score, b.script
  from best b
  join quran_verses v on v.surah = b.surah and v.ayah = b.ayah
  order by b.score desc, length(v.text_clean) desc, v.surah, v.ayah
  limit max_results
$$;

grant execute on function match_verses_in_text(text, real, int) to anon, authenticated;

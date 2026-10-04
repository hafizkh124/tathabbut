-- Search functions called by the verification API (through PostgREST /rpc).
-- Both compare normalized text (src/lib/arabic.ts normalizeArabic, Urdu keyboard letters folded) with pg_trgm's
-- word_similarity, which scores how well the query matches the best-matching stretch of the other text, so a
-- partial quotation of a verse or of a saying still finds it.

create or replace function match_verses(q text, min_score real default 0.5, max_results int default 5)
returns table (surah int, ayah int, surah_name_ar text, text_uthmani text, text_clean text, score real)
language sql stable
set search_path = public, extensions
as $$
  select v.surah, v.ayah, v.surah_name_ar, v.text_uthmani, v.text_clean, word_similarity(q, v.text_clean) as score
  from quran_verses v
  where word_similarity(q, v.text_clean) >= min_score
  order by score desc, v.surah, v.ayah
  limit max_results
$$;

-- A post may quote a saying in part, or add words around it: take the better of both directions.
create or replace function match_sayings(q text, min_score real default 0.5, max_results int default 3)
returns table (
  id int, text_ar text, status text, verdict text, verdict_by text, reference text, correct_text text, note text,
  claimed_attribution text, claimed_reference text, score real
)
language sql stable
set search_path = public, extensions
as $$
  select s.id, s.text_ar, s.status, s.verdict, s.verdict_by, s.reference, s.correct_text, s.note,
         s.claimed_attribution, s.claimed_reference,
         greatest(word_similarity(q, s.text_clean), word_similarity(s.text_clean, q)) as score
  from circulating_sayings s
  where greatest(word_similarity(q, s.text_clean), word_similarity(s.text_clean, q)) >= min_score
  order by score desc
  limit max_results
$$;

grant execute on function match_verses(text, real, int) to anon, authenticated;
grant execute on function match_sayings(text, real, int) to anon, authenticated;

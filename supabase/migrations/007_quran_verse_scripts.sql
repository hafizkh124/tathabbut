-- The same Hafs text in other scripts, for matching quotes copied from a mushaf, and a search across all of them.
-- Source: quranpedia.net dumps — mushaf 2 (Uthmani script, KFGQPC encoding) and mushaf 3 (IndoPak Nastaleeq), both
-- King Fahd Complex. Rows are built by scripts/ingest-quran.ts (validateScriptRows checks every row is an ayah of
-- quran_verses, with the same numbering).
--
-- No existing table or function is altered: quran_verses, quran_translations and match_verses are left as they are
-- (quran_verses is only read by the new function, and quran_verse_scripts has no foreign key to it). The only change
-- to existing data is two new rows in data_sources (quranpedia-mushaf-2, quranpedia-mushaf-3), added by the ingest
-- script before the script rows that reference them.

create table if not exists quran_verse_scripts (
  id          serial primary key,
  surah       int  not null check (surah between 1 and 114),
  ayah        int  not null check (ayah >= 1),
  script      text not null check (script in ('uthmani', 'indopak')),
  text        text not null,                      -- as published, less invisible marks
  text_clean  text not null,                      -- normalizeArabic(text): the same search form as quran_verses
  source_id   text not null references data_sources (id),
  unique (surah, ayah, script)
);
create index if not exists quran_scripts_clean_trgm on quran_verse_scripts using gin (text_clean gin_trgm_ops);

alter table quran_verse_scripts enable row level security;
create policy "public read" on quran_verse_scripts for select using (true);

-- Like match_verses, but the query is scored against every script of every ayah: the standard text of quran_verses
-- (script 'standard', mushaf 1) and each row of quran_verse_scripts. Each ayah is returned once, with the script that
-- matched it best, that script's text and source, and the standard text the app shows.
--   q      the search form of the quote (searchForm in src/lib/quranCheck.ts), as for match_verses.
--   q_raw  optional: the quote as written, with its marks. Scripts often share the same letters (Uthmani and IndoPak
--          both read «ملك يوم الدين» once the marks are gone), so q alone scores them equally; q_raw then picks the
--          script whose written text is closest. Without it, a tie goes to the standard text, then the script name.
create or replace function match_verses_scripts(q text, min_score real default 0.5, max_results int default 5, q_raw text default null)
returns table (
  surah int, ayah int, surah_name_ar text,
  script text, source_id text, text text, text_clean text, score real,
  text_standard text
)
language sql stable
set search_path = public, extensions
as $$
  with hits as (
    select v.surah, v.ayah, 'standard'::text as script, v.source_id, v.text_uthmani as text, v.text_clean,
           word_similarity(q, v.text_clean) as score
    from quran_verses v
    union all
    select s.surah, s.ayah, s.script, s.source_id, s.text, s.text_clean, word_similarity(q, s.text_clean)
    from quran_verse_scripts s
  ), best as (
    select distinct on (h.surah, h.ayah) h.*
    from hits h
    where h.score >= min_score
    order by h.surah, h.ayah, h.score desc, similarity(q_raw, h.text) desc nulls last, (h.script = 'standard') desc, h.script
  )
  select b.surah, b.ayah, v.surah_name_ar, b.script, b.source_id, b.text, b.text_clean, b.score, v.text_uthmani
  from best b
  join quran_verses v on v.surah = b.surah and v.ayah = b.ayah
  order by b.score desc, b.surah, b.ayah
  limit max_results
$$;

grant execute on function match_verses_scripts(text, real, int, text) to anon, authenticated;

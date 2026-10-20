-- The questions and answers of العلماء (alulama.org), copied (title, question, the start of the answer, a link back) so a
-- visitor's question can be matched to them with our own folding of Urdu and Arabic spellings. The live WordPress search needs
-- every word spelled the same and sorts by date, so it cannot do this. Filled by scripts/sync-alulama.ts and kept current by
-- /api/cron/alulama (src/lib/alulama.ts). Server-only: row level security on with NO policy, the match function only for the service key.

create table if not exists alulama_posts (
  id             int primary key,                 -- the WordPress post id
  kind           text not null check (kind in ('fatwa', 'hadith_ruling')),
  number         int,                             -- the question's number on the site («سوال 7586»), when it has one
  title          text not null,
  title_clean    text not null,                   -- folded (searchForm) for matching
  answer_snippet text not null default '',        -- the start of the answer (about 500 characters), as written; the link has the rest
  answerers      text[] not null default '{}',    -- the shaikhs named in the answer, as written
  link           text not null,
  published      timestamptz,
  modified       timestamptz,
  categories     int[] not null default '{}',
  search_text    text not null                    -- folded title + the start of the question (the question itself is not kept)
);
create index if not exists alulama_title_trgm on alulama_posts using gin (title_clean gin_trgm_ops);
create index if not exists alulama_search_trgm on alulama_posts using gin (search_text gin_trgm_ops);
create index if not exists alulama_kind on alulama_posts (kind);
alter table alulama_posts enable row level security;

-- Small server-side state of the sync (the position of the weekly pass over the id list, the time of the last update).
create table if not exists sync_state (
  key        text primary key,
  value      jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table sync_state enable row level security;

-- word_similarity scores how well the query matches the best-matching stretch of the text, so a few key words find a
-- long title. The title counts a little more than the title and question together.
create or replace function match_alulama(q text, k text, min_score real default 0.5, max_results int default 3)
returns table (id int, kind text, number int, title text, answer_snippet text, answerers text[], link text, published timestamptz, score real)
language sql stable
set search_path = public, extensions
as $$
  select p.id, p.kind, p.number, p.title, p.answer_snippet, p.answerers, p.link, p.published,
         greatest(word_similarity(q, p.title_clean), 0.9 * word_similarity(q, p.search_text)) as score
  from alulama_posts p
  where p.kind = k
    and greatest(word_similarity(q, p.title_clean), 0.9 * word_similarity(q, p.search_text)) >= min_score
  order by score desc, p.published desc nulls last
  limit max_results
$$;

revoke all on function match_alulama(text, text, real, int) from public, anon, authenticated;
grant execute on function match_alulama(text, text, real, int) to service_role;

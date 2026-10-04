-- Tathabbut initial schema.
-- Rulings are never written by the model: they come from Dorar (cached here), the Quran text,
-- or the expert-curated circulating_sayings list, and are classified by the expert's grade_map.

create extension if not exists pg_trgm;
-- pgvector and embedding columns are added in a later migration, once the embedding model
-- (and therefore its dimension) is confirmed on the build day.

-- Quran text (Hafs mushaf text from quranpedia dumps; ur/en translations in quran_translations), one row per ayah.
create table if not exists quran_verses (
  id            serial primary key,
  surah         int  not null,
  ayah          int  not null,
  surah_name_ar text not null,
  text_uthmani  text not null,
  text_clean    text not null,           -- normalizeArabic(text_uthmani)
  unique (surah, ayah)
);
create index if not exists quran_clean_trgm on quran_verses using gin (text_clean gin_trgm_ops);

-- Circulating sayings with no basis / weak / misattributed, curated by the expert with references.
create table if not exists circulating_sayings (
  id              serial primary key,
  text_ar         text not null,
  text_clean      text not null,
  phrasings       text[] not null default '{}',   -- common Urdu / English / variant wordings
  status          text not null check (status in (
                    'موضوع أو لا أصل له', 'ضعيف', 'قول منسوب خطأً إلى النبي ﷺ', 'لفظ أو ترجمة غير دقيقة')),
  verdict         text not null,                  -- the scholar's words, verbatim
  verdict_by      text not null,                  -- who said it
  reference       text not null,                  -- book, volume/page or number
  correct_text    text,                           -- the established wording, when there is one
  note            text,
  created_at      timestamptz not null default now()
);
create index if not exists sayings_clean_trgm on circulating_sayings using gin (text_clean gin_trgm_ops);

-- Raw Dorar answers, keyed by the normalized query, so a repeated lookup (and the demo) never
-- depends on dorar.net being up.
create table if not exists dorar_cache (
  query_clean text primary key,
  results     jsonb not null,                     -- DorarResult[] exactly as parsed
  fetched_at  timestamptz not null default now()
);

-- The expert's mapping from Dorar verdict wording to a category. Ordered: first match wins.
create table if not exists grade_map (
  id        serial primary key,
  priority  int  not null,
  pattern   text not null,                        -- substring or regex over the normalized verdict
  is_regex  boolean not null default false,
  category  text not null check (category in ('صحيح أو حسن', 'ضعيف', 'موضوع أو لا أصل له', 'غير حاسم')),
  note      text,
  unique (priority)
);

-- Texts referred to a specialist. No user identity is stored.
create table if not exists review_queue (
  id             serial primary key,
  claim_text     text not null,
  language       text,
  reason         text not null,                   -- low_confidence | extraction_failed | contested | user_flag
  candidates     jsonb,
  status         text not null default 'pending' check (status in ('pending', 'resolved', 'rejected')),
  scholar_notes  text,
  created_at     timestamptz not null default now()
);

-- Reference data is read-only to the public API key.
alter table quran_verses        enable row level security;
alter table circulating_sayings enable row level security;
alter table dorar_cache         enable row level security;
alter table grade_map           enable row level security;
alter table review_queue        enable row level security;
create policy "public read" on quran_verses        for select using (true);
create policy "public read" on circulating_sayings for select using (true);
create policy "public read" on grade_map           for select using (true);

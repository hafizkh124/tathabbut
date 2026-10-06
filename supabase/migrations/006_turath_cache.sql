-- Turath caches (server-only: row level security is on and there is NO policy, so the public key sees nothing;
-- the service key, used by the server, bypasses it).
--
-- turath_cache: the answer to a Turath lookup, keyed by what was asked. Only queries actually asked are stored, only
-- successful and complete answers, and a row older than 30 days is ignored by the code (and may be deleted).
-- turath_translations: the machine translation of a Turath passage, keyed by the hash of the Arabic text and the language,
-- so a passage is translated once.
-- Both hold third-party book text in short passages; the rights are not settled, hence the TTL.

create table if not exists turath_cache (
  query_key   text        not null,              -- normalizeArabic(query), single spaces
  kind        text        not null check (kind in ('hadith', 'scholar_quote', 'fiqh')),
  result      jsonb       not null,              -- TurathLookupOutcome (status "success") exactly as returned
  fetched_at  timestamptz not null default now(),
  primary key (query_key, kind)
);

create table if not exists turath_translations (
  text_hash   text        not null,              -- sha-256 (hex) of the Arabic passage
  lang        text        not null check (lang in ('ur', 'en')),
  translation text        not null,
  model       text,
  fetched_at  timestamptz not null default now(),
  primary key (text_hash, lang)
);

alter table turath_cache        enable row level security;
alter table turath_translations enable row level security;

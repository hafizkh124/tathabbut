-- Urdu and English translations of the Quran, and where each dataset came from.
-- Source: quranpedia.net dumps (mushaf 1, translation-books 1966 and 1948; the translations are King Fahd Complex).
-- Only the cleaned translation is stored: the translators' footnotes in the dumps are not republished here.

-- Provenance, and the attribution quranpedia asks for when its data is republished (name, link, version).
create table if not exists data_sources (
  id          text primary key,                   -- e.g. quranpedia-mushaf-1, quranpedia-translation-1966
  title       text not null,
  publisher   text not null,
  url         text not null,
  version     text,                               -- the dump's version string, when it has one
  sha256      text,                               -- of the file we downloaded
  license     text not null,
  attribution text,
  loaded_at   timestamptz not null default now()
);

alter table quran_verses add column if not exists source_id text references data_sources (id);

create table if not exists quran_translations (
  id         serial primary key,
  surah      int  not null,
  ayah       int  not null,
  lang       text not null check (lang in ('ur', 'en')),
  text       text not null,
  source_id  text not null references data_sources (id),
  unique (surah, ayah, lang),
  foreign key (surah, ayah) references quran_verses (surah, ayah)
);

alter table data_sources        enable row level security;
alter table quran_translations  enable row level security;
create policy "public read" on data_sources       for select using (true);
create policy "public read" on quran_translations for select using (true);

-- The words where the other canonical readings (the ten qira'at, twenty ruwat) differ from Hafs in wording, so that a
-- quote in another reading («فَتَثَبَّتُوا», 49:6) is not reported as a misquote. Source: quranpedia.net, dump
-- qiraat.json.gz (the service /v1/ayah/{s}/{a}/qiraat). Rows are built by scripts/load-qiraat.ts (src/lib/qiraat.ts):
-- only different words, not ways of saying the same word (imala, madd, ishmam).
--
-- Nothing existing is altered; the only change to existing data is one new row in data_sources (quranpedia-qiraat),
-- added by the load script before these rows.

create table if not exists quran_qiraat (
  id            serial primary key,
  surah         int  not null check (surah between 1 and 114),
  ayah          int  not null check (ayah >= 1),
  hafs_word     text not null,   -- the Hafs word, search form (normalizeArabic, letters only)
  variant_word  text not null,   -- the other reading's word, search form
  variant_text  text not null,   -- the other reading's word as quranpedia writes it
  readers       jsonb not null,  -- [{ id, imam, ruwat: [..] }], in the order of the ten
  source_id     text not null references data_sources (id),
  unique (surah, ayah, hafs_word, variant_word)
);
create index if not exists quran_qiraat_verse on quran_qiraat (surah, ayah);

alter table quran_qiraat enable row level security;
create policy "public read" on quran_qiraat for select using (true);

-- circulating_sayings, after the specialist's review (2026-10-03):
-- 1) status uses the new terms (and a status for sayings wrongly attributed to a scholar, with a wrong citation);
-- 2) for those, what is being circulated: to whom it is attributed and the citation given;
-- 3) one row per text, so the loader can upsert.

do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'circulating_sayings'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%status%'
  loop
    execute format('alter table circulating_sayings drop constraint %I', c);
  end loop;
end $$;

alter table circulating_sayings add constraint circulating_sayings_status_check check (status in (
  'شديد الضعف أو لا أصل له',
  'ضعيف',
  'غير حاسم',
  'قول منسوب خطأً إلى النبي ﷺ',
  'لفظ أو ترجمة غير دقيقة',
  'قول منسوب خطأً إلى عالم'
));

alter table circulating_sayings add column if not exists claimed_attribution text;  -- e.g. «ابن قدامة»
alter table circulating_sayings add column if not exists claimed_reference   text;  -- e.g. «البيهقي: 3449»

create unique index if not exists sayings_text_clean_key on circulating_sayings (text_clean);

-- turath_translations also holds the machine translation of an answer of العلماء (Urdu) into Arabic, for a reader whose screen is in Arabic
-- (src/lib/translateAnswer.ts). Without this the Arabic translation is made but not remembered, so every viewing would ask the model again.
alter table turath_translations drop constraint if exists turath_translations_lang_check;
alter table turath_translations add constraint turath_translations_lang_check check (lang in ('ur', 'en', 'ar'));

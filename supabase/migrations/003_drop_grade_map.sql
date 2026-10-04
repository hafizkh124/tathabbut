-- The grade_map table from 001 is no longer used (it was empty).
-- The specialist's grading rules have several stages (negations removed first, the strongest tier first, conflicts,
-- the muhaddith's name for «أخرجه في صحيحه», long wordings) that a flat pattern → category table cannot express,
-- and its category check still listed the old four names. The rules now live in src/lib/gradeMap.ts, with tests.

drop table if exists grade_map;

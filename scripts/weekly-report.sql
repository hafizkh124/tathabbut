-- Tathabbut weekly report: paste into the Supabase SQL editor (or run through the MCP), one block at a time.
-- Every block reads only the `events` table (migration 012): counts and ids of devices, never texts or numbers.
-- Change the window by editing the interval ('7 days'). Written 2026-11-23 from the first full review.

-- 1. Reach: who came, who checked, who came back
with v as (select device, created_at::date d from events where event = 'visit' and created_at > now() - interval '7 days'),
     c as (select distinct device from events where event = 'verify' and created_at > now() - interval '7 days'),
     r as (select device from v group by device having count(distinct d) >= 2)
select (select count(distinct device) from v)                as visitors,
       (select count(*) from c)                              as checked,
       round(100.0 * (select count(*) from c) / nullif((select count(distinct device) from v), 0)) as pct_checked,
       (select count(*) from r)                              as came_back_2plus_days;

-- 2. Where they come from (device counts; "pwa" = the installed app)
select coalesce(nullif(source, ''), '?') as source,
       coalesce(nullif(regexp_replace(referrer, '^https?://([^/]+).*', '\1'), ''), 'direct') as referrer,
       count(distinct device) as devices
from events where event = 'visit' and created_at > now() - interval '7 days'
group by 1, 2 order by 3 desc limit 10;

-- 3. Checks: how many failed (Dorar could not be asked), how fast, and how many came from the cache
select count(*) as checks,
       count(*) filter (where data->>'failed' is not null) as failed,
       round(100.0 * count(*) filter (where data->>'failed' is not null) / nullif(count(*), 0)) as pct_failed,
       count(*) filter (where (data->>'cached')::boolean) as from_cache,
       round(percentile_cont(0.5) within group (order by (data->>'ms')::numeric)) as p50_ms,
       round(percentile_cont(0.9) within group (order by (data->>'ms')::numeric)) as p90_ms
from events where event = 'verify' and created_at > now() - interval '7 days';

-- 4. Why checks failed (kinds are recorded from 2026-11-23: empty, timeout, network, http:<status>)
select k as failure_kind, count(*) as n
from events, jsonb_array_elements_text(coalesce(data->'kinds', '[]'::jsonb)) k
where event = 'verify' and data->>'failed' is not null and created_at > now() - interval '7 days'
group by 1 order by 2 desc;

-- 5. Where the Dorar answers came from for the claims that were checked (cache / live / stale-cache)
select l->>'o' as origin, count(*) as n
from events, jsonb_array_elements(coalesce(data->'lookups', '[]'::jsonb)) l
where event = 'verify' and created_at > now() - interval '7 days' and l ? 'o'
group by 1 order by 2 desc;

-- 6. What the results said (claims by state)
select s as state, count(*) as n
from events, jsonb_array_elements_text(coalesce(data->'states', '[]'::jsonb)) s
where event = 'verify' and created_at > now() - interval '7 days'
group by 1 order by 2 desc;

-- 7. Which model answered (the first one in the chain should answer most)
select coalesce(data->>'model', '(no AI / failed)') as model, count(*) as n, round(avg((data->>'ms')::numeric)) as avg_ms
from events where event = 'verify' and created_at > now() - interval '7 days' and data->>'cached' is distinct from 'true'
group by 1 order by 2 desc;

-- 8. Pictures: reads, successes, and whether people fix the text (ocr_edit is recorded from 2026-11-23)
select (select count(*) from events where event = 'ocr' and created_at > now() - interval '7 days') as pictures_read,
       (select count(*) from events where event = 'ocr' and (data->>'ok')::boolean and created_at > now() - interval '7 days') as read_ok,
       count(*) as confirmed,
       count(*) filter (where (data->>'edited')::boolean) as edited,
       coalesce(sum((data->>'fixes')::int), 0) as word_fixes
from events where event = 'ocr_edit' and created_at > now() - interval '7 days';

-- 9. Voice: starts and problems (voice is recorded from 2026-11-23)
select coalesce(data->>'phase', '?') as phase, coalesce(data->>'lang', data->>'problem', '-') as detail, count(*) as n, count(distinct device) as devices
from events where event = 'voice' and created_at > now() - interval '7 days'
group by 1, 2 order by 3 desc;

-- 10. Sharing: shares and copies per 100 checks
select (select count(*) from events where event in ('share', 'copy') and created_at > now() - interval '7 days') as shares_and_copies,
       (select count(*) from events where event = 'verify' and created_at > now() - interval '7 days') as checks,
       round(100.0 * (select count(*) from events where event in ('share', 'copy') and created_at > now() - interval '7 days')
             / nullif((select count(*) from events where event = 'verify' and created_at > now() - interval '7 days'), 0), 1) as per_100_checks;

-- 11. The specialist's queue: reports not yet looked at
select count(*) as waiting, min(created_at)::date as oldest from reports where not reviewed;

-- 12. Where the time of a check goes (stages recorded from 2026-11-23): average and slowest, in ms
select count(*) as checks,
       round(avg((data->'trace'->'stages'->>'cache')::numeric))   as cache_ms,
       round(avg((data->'trace'->'stages'->>'limit')::numeric))   as limit_ms,
       round(avg((data->'trace'->'stages'->>'extract')::numeric)) as ai_ms,
       round(avg((data->'trace'->'stages'->>'verify')::numeric))  as verify_ms,
       max((data->'trace'->'stages'->>'extract')::int)            as slowest_ai_ms,
       max((data->'trace'->'stages'->>'verify')::int)             as slowest_verify_ms
from events where event = 'verify' and data ? 'trace' and created_at > now() - interval '7 days';

-- 13. Time lost to AI attempts that did not answer (the wall time of the AI stage minus the answering attempt)
select count(*) filter (where lost > 1000) as checks_that_lost_over_1s,
       count(*) as checks,
       round(avg(lost) filter (where lost > 1000)) as avg_lost_ms
from (select (data->'trace'->'stages'->>'extract')::int - (data->>'extractMs')::int as lost
      from events where event = 'verify' and data ? 'trace' and data ? 'extractMs' and created_at > now() - interval '7 days') t;

-- 14. Per model: how often it was asked, answered, timed out or failed, and how long its answers took (tried is recorded from 2026-11-23)
select a->>0 as model, a->>2 as outcome, count(*) as n, round(avg((a->>1)::numeric)) as avg_ms, max((a->>1)::int) as max_ms
from events, jsonb_array_elements(coalesce(data->'tried', '[]'::jsonb)) a
where event = 'verify' and created_at > now() - interval '7 days'
group by 1, 2 order by 1, 3 desc;

-- 15. Dorar and the Supabase searches inside the verification: calls, average and slowest
select c.key as call, sum((c.value->>0)::int) as calls, round(sum((c.value->>1)::numeric) / nullif(sum((c.value->>0)::int), 0)) as avg_ms, max((c.value->>2)::int) as slowest_ms
from events, jsonb_each(coalesce(data->'trace'->'calls', '{}'::jsonb)) c
where event = 'verify' and created_at > now() - interval '7 days'
group by 1 order by 2 desc;

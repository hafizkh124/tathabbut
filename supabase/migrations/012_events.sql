-- Usage analytics, kept in our own database (free, with no monthly event quota): what was done, from which device, how
-- the person came, and from which country. There are no accounts, so a "user" is a device: a random id the browser keeps
-- (localStorage). Written by the server only (/api/event, /api/verify, /api/ocr); row level security is on with no policy.

create table if not exists events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  device      text        check (char_length(device) <= 64),   -- the browser's random id; null when storage is blocked
  event       text        not null check (char_length(event) <= 32),
  source      text        check (char_length(source) <= 32),   -- how the page was opened: direct, pwa, share_target, link
  locale      text        check (char_length(locale) <= 8),
  country     text        check (char_length(country) <= 8),   -- from Vercel's geo headers
  region      text        check (char_length(region) <= 64),
  city        text        check (char_length(city) <= 64),
  referrer    text        check (char_length(referrer) <= 300),
  data        jsonb                                            -- the event's own details (states found, time taken, …)
);

create index if not exists events_created_at on events (created_at);
create index if not exists events_device on events (device);

alter table events enable row level security;

-- The numbers to watch, for the SQL editor or a dashboard: `select * from stats_daily;` and `select * from stats_totals;`
create or replace view stats_daily as
select
  (created_at at time zone 'Asia/Karachi')::date                       as day,
  count(distinct device)                                               as devices,
  count(distinct device) filter (where event = 'verify')               as checking_devices,
  count(*) filter (where event = 'verify')                             as checks,
  count(*) filter (where event = 'verify' and (data->>'cached')::boolean) as cached_checks,
  count(*) filter (where event = 'ocr')                                as pictures,
  count(*) filter (where event in ('share', 'copy'))                   as shares,
  count(*) filter (where event = 'visit' and data->>'path' like '/r/%') as link_opens,
  count(*) filter (where event = 'installed')                          as installs
from events
group by 1
order by 1 desc;

create or replace view stats_totals as
select
  count(distinct device)                                    as devices,
  count(distinct device) filter (where event = 'verify')    as checking_devices,   -- the 10,000 target counts these
  count(*) filter (where event = 'verify')                  as checks,
  count(*) filter (where event in ('share', 'copy'))        as shares,
  count(*) filter (where event = 'visit' and data->>'path' like '/r/%') as link_opens,
  count(*) filter (where event = 'installed')               as installs
from events;

-- the views read the table with their owner's rights; keep them away from the public key too
revoke all on stats_daily, stats_totals from public, anon, authenticated;

-- Supabase's free database is 500 MB: /api/health (the daily cron) clears events older than a year and cached answers past
-- their 30 days. Shared results are kept: links in old messages should still open.
create or replace function purge_old_rows() returns void
language sql
security definer
set search_path = public
as $$
  delete from events where created_at < now() - interval '365 days';
  delete from verify_cache where created_at < now() - interval '30 days';
$$;

revoke all on function purge_old_rows() from public, anon, authenticated;
grant execute on function purge_old_rows() to service_role;

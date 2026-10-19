-- Three server-only tables (row level security on, NO policy: the public key can neither read nor write; the service key,
-- used by the API routes, bypasses it). Neither keeps anything that names a reader.

-- 1. Rate limits (src/lib/rateLimit.ts): how many checks a client, and the whole site, asked for in each time window, so one
--    script cannot spend the free AI quota the whole site shares. The client is a keyed hash of its address, never the address.
create table if not exists rate_limits (
  key           text        not null,   -- "verify:min:<hash>", "verify:day:<hash>", "ai:day:all", …
  window_start  timestamptz not null,
  hits          integer     not null default 0,
  primary key (key, window_start)
);

alter table rate_limits enable row level security;

-- Counts one request against each rule in order and returns the 1-based index of the first rule over its limit, or 0 when
-- all are within. Rules after a refused one are not counted, so a client refused by its own limit does not use up the
-- site-wide one. Windows are aligned to the epoch (a "day" is a UTC day). Old windows are cleared now and then.
create or replace function take_rate_limit(p_keys text[], p_windows integer[], p_limits integer[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  i      integer;
  w      timestamptz;
  n      integer;
begin
  for i in 1 .. coalesce(array_length(p_keys, 1), 0) loop
    w := to_timestamp(floor(extract(epoch from now()) / p_windows[i]) * p_windows[i]);
    insert into rate_limits (key, window_start, hits) values (p_keys[i], w, 1)
      on conflict (key, window_start) do update set hits = rate_limits.hits + 1
      returning hits into n;
    if n > p_limits[i] then
      return i;
    end if;
  end loop;
  if random() < 0.01 then
    delete from rate_limits where window_start < now() - interval '2 days';
  end if;
  return 0;
end;
$$;

revoke all on function take_rate_limit(text[], integer[], integer[]) from public, anon, authenticated;
grant execute on function take_rate_limit(text[], integer[], integer[]) to service_role;

-- 2. Shared results (src/lib/sharedClaims.ts, /r/<id>): each result /api/verify returned, as it returned it, so a link in a
--    WhatsApp message opens the same result. Written by the server only, so a link always shows what the sources said;
--    nothing a reader sends is stored here. The id is a keyed hash of the result, so the same result has the same link
--    (a viral text is stored once) and ids cannot be guessed. Personal fiqh questions are never stored; nor is the post.
create table if not exists shared_claims (
  id          text        primary key check (char_length(id) between 8 and 32),
  claim       jsonb       not null,
  created_at  timestamptz not null default now()
);

alter table shared_claims enable row level security;

-- 3. Answers by text (src/lib/sharedClaims.ts): a post checked before is answered from its stored results, without asking
--    the AI again (the free quota is small, and viral texts are checked again and again). The key is a hash of the post;
--    the post itself is not kept. Answers older than 30 days are asked again, so new grading reaches readers.
create table if not exists verify_cache (
  key         text        primary key check (char_length(key) = 64),
  ids         text[]      not null,
  created_at  timestamptz not null default now()
);

alter table verify_cache enable row level security;

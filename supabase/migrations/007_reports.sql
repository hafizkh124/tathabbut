-- «Is this result wrong? Report it»: what a reader reported, for the team to review (server-only: row level security is on
-- and there is NO policy, so the public key can neither read nor write; the service key, used by /api/report, bypasses it).
-- Only the reported text and the result shown are kept: no IP address, no account, nothing that names the reader.

create table if not exists reports (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  locale      text        not null check (locale in ('ar', 'en', 'ur')),
  text        text        not null check (char_length(text) between 1 and 5000),  -- the claim as the reader wrote it
  query       text                 check (char_length(query) <= 1000),           -- what the books were asked
  state       text        not null check (char_length(state) <= 64),             -- the result that was shown
  reviewed    boolean     not null default false
);

alter table reports enable row level security;

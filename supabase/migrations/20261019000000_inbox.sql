-- Inbox digest: a small Google Apps Script in each person's own Gmail sends
-- the new mails of the day to /api/inbox once every morning. Rialna sums them
-- up and the digest is kept here, visible to its owner only.
--
-- The script proves who it is with a long random key made in Settings. Only
-- its SHA-256 hash is stored; the key itself is shown once and never again.

create table private.inbox_keys (
  member_id uuid primary key references public.members (id) on delete cascade,
  key_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table public.inbox_digests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  owner_id uuid not null references public.members (id) on delete cascade,
  day date not null,
  account text, -- the Gmail address the script runs in, for "Open in Gmail" links
  summary text not null,
  items jsonb not null default '[]', -- [{id, thread, from, subject, group, title, why, action}]
  mail_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (owner_id, day)
);
alter table public.inbox_digests enable row level security;
revoke all on public.inbox_digests from anon, authenticated;
grant select, delete on public.inbox_digests to authenticated;
-- Always private: even the partner never reads someone else's mail summary.
create policy "owner reads" on public.inbox_digests for select to authenticated using (owner_id = (select auth.uid()));
create policy "owner deletes" on public.inbox_digests for delete to authenticated using (owner_id = (select auth.uid()));

-- Settings → "Create key": returns the new key once and replaces any older one.
create or replace function public.create_inbox_key()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  k text;
begin
  if me is null or not exists (select 1 from public.members where id = me) then
    raise exception 'not a family member';
  end if;
  k := 'efk_' || encode(extensions.gen_random_bytes(32), 'hex');
  insert into private.inbox_keys (member_id, key_hash) values (me, encode(extensions.digest(k, 'sha256'), 'hex'))
  on conflict (member_id) do update set key_hash = excluded.key_hash, created_at = now(), last_used_at = null;
  return k;
end $$;

create or replace function public.revoke_inbox_key()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.inbox_keys where member_id = auth.uid();
$$;

-- Settings shows whether a key exists and when the script last sent mail.
create or replace function public.inbox_key_status()
returns table (created_at timestamptz, last_used_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select created_at, last_used_at from private.inbox_keys where member_id = auth.uid();
$$;

-- Used by /api/inbox before it spends anything on the AI: is this key real?
create or replace function public.inbox_key_ok(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.inbox_keys where key_hash = encode(extensions.digest(p_key, 'sha256'), 'hex'));
$$;

-- Used by /api/inbox to store the digest for the key's owner (one per day).
create or replace function public.save_inbox_digest(p_key text, p_day date, p_account text, p_summary text, p_items jsonb, p_count int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  who uuid;
  hh uuid;
begin
  select k.member_id, m.household_id into who, hh
  from private.inbox_keys k join public.members m on m.id = k.member_id
  where k.key_hash = encode(extensions.digest(p_key, 'sha256'), 'hex');
  if who is null then raise exception 'unknown key'; end if;
  if jsonb_typeof(p_items) <> 'array' or length(p_summary) > 4000 or length(p_items::text) > 200000 then
    raise exception 'digest too large';
  end if;
  insert into public.inbox_digests (household_id, owner_id, day, account, summary, items, mail_count)
  values (hh, who, p_day, left(p_account, 200), p_summary, p_items, greatest(0, p_count))
  on conflict (owner_id, day) do update
    set account = excluded.account, summary = excluded.summary, items = excluded.items, mail_count = excluded.mail_count, created_at = now();
  update private.inbox_keys set last_used_at = now() where member_id = who;
end $$;

revoke all on function public.create_inbox_key(), public.revoke_inbox_key(), public.inbox_key_status() from public, anon;
grant execute on function public.create_inbox_key(), public.revoke_inbox_key(), public.inbox_key_status() to authenticated;
revoke all on function public.inbox_key_ok(text), public.save_inbox_digest(text, date, text, text, jsonb, int) from public;
grant execute on function public.inbox_key_ok(text), public.save_inbox_digest(text, date, text, text, jsonb, int) to anon, authenticated;

-- Digests older than 60 days are removed every night.
select cron.schedule('inbox-digest-prune', '40 3 * * *', $$delete from public.inbox_digests where day < current_date - 60$$);

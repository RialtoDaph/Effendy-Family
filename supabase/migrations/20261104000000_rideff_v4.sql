-- rideff Life v4 (design_handoff_rideff/DATA_MODEL.md, AI_ASSISTANT.md).
-- From one fixed household to many: sign-up creates a household or joins one
-- through an invite. Adds billing, assistant memory and the privacy rules the
-- handoff asks for. Safe on top of the Effendy migrations and on a fresh
-- baseline, so the same file carries the live data over at cutover.

create extension if not exists vector with schema extensions;

-- The old push job pointed at the Effendy project; phase 7 schedules a new one.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'push-reminders') then
    perform cron.unschedule('push-reminders');
  end if;
end $$;

-- households ----------------------------------------------------------------
alter table public.households add column if not exists timezone text not null default 'Europe/Berlin';
alter table public.households alter column name set default 'My household';
alter table public.households alter column home_city drop not null;
alter table public.households alter column home_city drop default;
grant update (timezone) on public.households to authenticated;

-- members -------------------------------------------------------------------
alter table public.members drop constraint if exists members_role_check;
update public.members set role = case when sort = 0 then 'owner' else 'partner' end where role = 'admin';
alter table public.members alter column role set default 'member';
alter table public.members add constraint members_role_check check (role in ('owner', 'partner', 'member'));
-- What this person sees of the household's shared rows. Their own rows are
-- never hidden from them. Changed only through set_member_share().
alter table public.members add column if not exists share jsonb not null
  default '{"money":true,"goals":true,"cal":true,"docs":true,"debts":true,"remit":true}';

-- member_settings -----------------------------------------------------------
alter table public.member_settings drop constraint if exists member_settings_palette_check;
update public.member_settings set palette = 'classic'
  where palette not in ('noir', 'classic', 'mono', 'midnight', 'ocean', 'forest', 'sand', 'rose', 'sunset');
alter table public.member_settings alter column palette set default 'noir';
alter table public.member_settings add constraint member_settings_palette_check
  check (palette in ('noir', 'classic', 'mono', 'midnight', 'ocean', 'forest', 'sand', 'rose', 'sunset'));
alter table public.member_settings
  add column if not exists lang text not null default 'en' check (lang in ('en', 'de', 'id')),
  add column if not exists ai_name text not null default 'Clopar' check (length(trim(ai_name)) between 1 and 40),
  add column if not exists voice text not null default 'text' check (voice in ('text', 'audio', 'both')),
  add column if not exists brief_at time not null default '07:00',
  add column if not exists memory_on boolean not null default true,
  add column if not exists memory_shared boolean not null default false;
grant update (lang, ai_name, voice, brief_at, memory_on, memory_shared) on public.member_settings to authenticated;

-- money ---------------------------------------------------------------------
alter table public.recurring
  add column if not exists direction text generated always as (case when amount < 0 then 'out' else 'in' end) stored,
  add column if not exists is_subscription boolean not null default false,
  add column if not exists last_used_at timestamptz;
grant update (is_subscription, last_used_at) on public.recurring to authenticated;

alter table public.transactions drop constraint if exists transactions_source_check;
alter table public.transactions add constraint transactions_source_check
  check (source in ('manual', 'recurring', 'import', 'receipt', 'assistant'));

-- Two households may import the same statement line.
alter table public.transactions drop constraint if exists transactions_import_hash_key;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_household_id_import_hash_key') then
    alter table public.transactions add constraint transactions_household_id_import_hash_key unique (household_id, import_hash);
  end if;
end $$;

-- Journal is always private ---------------------------------------------------
create or replace function private.journal_private()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.visibility := 'private';
  return new;
end $$;
drop trigger if exists journal_private on public.journal_entries;
create trigger journal_private before insert or update on public.journal_entries
  for each row execute function private.journal_private();
update public.journal_entries set visibility = 'private' where visibility <> 'private';
alter table public.journal_entries drop constraint if exists journal_entries_private;
alter table public.journal_entries add constraint journal_entries_private check (visibility = 'private');

-- A goal made private takes its progress with it ------------------------------
create or replace function private.goal_visibility_follow()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.goal_progress set visibility = new.visibility where goal_id = new.id;
  return null;
end $$;
drop trigger if exists goal_visibility_follow on public.yearly_goals;
create trigger goal_visibility_follow after update of visibility on public.yearly_goals
  for each row when (old.visibility is distinct from new.visibility)
  execute function private.goal_visibility_follow();

-- Share settings, enforced here and not in the UI ------------------------------
create or replace function private.shares(area text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((share ->> area)::boolean, true) from public.members where id = auth.uid()
$$;
revoke all on function private.shares(text) from public, anon;
grant execute on function private.shares(text) to authenticated;

do $$
declare
  m record;
begin
  for m in
    select * from (values
      ('transactions', 'money'), ('recurring', 'money'), ('incomes', 'money'), ('subscriptions', 'money'),
      ('assets', 'money'), ('businesses', 'money'), ('business_months', 'money'),
      ('tax_deadlines', 'money'), ('tax_deductions', 'money'),
      ('goals', 'goals'), ('yearly_goals', 'goals'), ('goal_progress', 'goals'),
      ('events', 'cal'), ('week_priorities', 'cal'),
      ('files', 'docs'), ('debts', 'debts'), ('remittances', 'remit')
    ) as v(tbl, area)
  loop
    execute format('drop policy if exists "read family or own" on public.%I', m.tbl);
    execute format($p$
      create policy "read family or own" on public.%I for select to authenticated
        using (household_id = (select private.my_household())
               and (owner_id = (select auth.uid())
                    or (visibility = 'family' and (select private.shares(%L)))))
    $p$, m.tbl, m.area);
  end loop;
end $$;

-- Billing -----------------------------------------------------------------------
create table if not exists public.subscriptions_billing (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null unique references public.households (id) on delete cascade,
  plan text not null default 'together' check (plan in ('life', 'plus', 'together')),
  interval text not null default 'month' check (interval in ('month', 'year')),
  status text not null default 'trial' check (status in ('trial', 'active', 'past_due', 'cancelled')),
  seats smallint not null default 4 check (seats between 1 and 4),
  provider_ref text,
  current_period_end timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage (
  member_id uuid not null references public.members (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  ai_messages integer not null default 0,
  voice_seconds integer not null default 0,
  extra_voice_seconds integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (member_id, month)
);

-- Security -----------------------------------------------------------------------
-- No client access at all: PIN hashes are checked on the server (phase 7).
create table if not exists public.security (
  member_id uuid primary key references public.members (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  pin_hash text,
  pin_salt text,
  failed_count smallint not null default 0,
  locked_until timestamptz,
  auto_lock_min smallint not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.passkeys (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  sign_count bigint not null default 0,
  device_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists passkeys_member_idx on public.passkeys (member_id);

-- Assistant ----------------------------------------------------------------------
create table if not exists public.ai_sessions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.my_household() references public.households (id) on delete cascade,
  member_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  mode text not null default 'text' check (mode in ('voice', 'text')),
  seconds integer not null default 0,
  tool_calls jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_sessions_member_idx on public.ai_sessions (member_id, started_at desc);

create table if not exists public.ai_memories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.my_household() references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  scope text not null default 'private' check (scope in ('private', 'shared')),
  kind text not null default 'fact' check (kind in ('fact', 'preference', 'plan', 'person')),
  text text not null check (length(trim(text)) between 1 and 500),
  source text not null default 'manual' check (source in ('voice', 'chat', 'manual')),
  source_session_id uuid references public.ai_sessions (id) on delete set null,
  last_used_at timestamptz,
  embedding extensions.vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_memories_household_idx on public.ai_memories (household_id, scope);
create index if not exists ai_memories_owner_idx on public.ai_memories (owner_id);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.my_household() references public.households (id) on delete cascade,
  member_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  text text not null,
  cards jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_messages_member_idx on public.ai_messages (member_id, created_at desc);

create table if not exists public.ai_pending_actions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.my_household() references public.households (id) on delete cascade,
  member_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  tool text not null,
  args jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'saved', 'undone', 'skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_pending_member_idx on public.ai_pending_actions (member_id, status);

-- member_settings is readable by its owner only, so the memory rule asks through here.
create or replace function private.memory_shared_on(p_owner uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select memory_shared from public.member_settings where member_id = p_owner), false)
$$;
revoke all on function private.memory_shared_on(uuid) from public, anon;
grant execute on function private.memory_shared_on(uuid) to authenticated;

-- Invites ------------------------------------------------------------------------
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  invited_by uuid references public.members (id) on delete set null,
  name text not null check (length(trim(name)) between 1 and 60),
  role text not null default 'partner' check (role in ('partner', 'member')),
  share jsonb not null default '{"money":true,"goals":true,"cal":true,"docs":true,"debts":true,"remit":true}',
  token_hash text not null unique,
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  used_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists invites_household_idx on public.invites (household_id);

-- RLS on the new tables --------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['subscriptions_billing','usage','security','passkeys','ai_sessions','ai_memories','ai_messages','ai_pending_actions','invites'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('drop trigger if exists %1$s_updated_at on public.%1$I', t);
    execute format('create trigger %1$s_updated_at before update on public.%1$I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

grant select (id, household_id, plan, interval, status, seats, current_period_end) on public.subscriptions_billing to authenticated;
create policy "household reads plan" on public.subscriptions_billing for select to authenticated
  using (household_id = (select private.my_household()));

grant select on public.usage to authenticated;
create policy "own usage" on public.usage for select to authenticated using (member_id = (select auth.uid()));

grant select (id, household_id, member_id, device_name, created_at), delete on public.passkeys to authenticated;
create policy "own passkeys: read" on public.passkeys for select to authenticated using (member_id = (select auth.uid()));
create policy "own passkeys: remove" on public.passkeys for delete to authenticated using (member_id = (select auth.uid()));

grant select, insert on public.ai_sessions to authenticated;
create policy "own sessions: read" on public.ai_sessions for select to authenticated using (member_id = (select auth.uid()));
create policy "own sessions: add" on public.ai_sessions for insert to authenticated
  with check (member_id = (select auth.uid()) and household_id = (select private.my_household()));

grant select, insert, delete on public.ai_messages to authenticated;
create policy "own messages: read" on public.ai_messages for select to authenticated using (member_id = (select auth.uid()));
create policy "own messages: add" on public.ai_messages for insert to authenticated
  with check (member_id = (select auth.uid()) and household_id = (select private.my_household()));
create policy "own messages: remove" on public.ai_messages for delete to authenticated using (member_id = (select auth.uid()));

grant select, insert on public.ai_pending_actions to authenticated;
grant update (status) on public.ai_pending_actions to authenticated;
create policy "own actions: read" on public.ai_pending_actions for select to authenticated using (member_id = (select auth.uid()));
create policy "own actions: add" on public.ai_pending_actions for insert to authenticated
  with check (member_id = (select auth.uid()) and household_id = (select private.my_household()));
create policy "own actions: answer" on public.ai_pending_actions for update to authenticated
  using (member_id = (select auth.uid())) with check (member_id = (select auth.uid()));

-- Private: the owner only. Shared: the household, only while its owner shares memory.
grant select, insert, delete on public.ai_memories to authenticated;
grant update (scope, kind, text, last_used_at) on public.ai_memories to authenticated;
create policy "read own or shared" on public.ai_memories for select to authenticated
  using (household_id = (select private.my_household())
         and (owner_id = (select auth.uid())
              or (scope = 'shared' and private.memory_shared_on(owner_id))));
create policy "add as self" on public.ai_memories for insert to authenticated
  with check (household_id = (select private.my_household()) and owner_id = (select auth.uid()));
create policy "owner edits" on public.ai_memories for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "owner forgets" on public.ai_memories for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Everyone in the household sees who is invited. The token hash is never readable.
grant select (id, household_id, invited_by, name, role, share, expires_at, used_at, created_at) on public.invites to authenticated;
create policy "household reads invites" on public.invites for select to authenticated
  using (household_id = (select private.my_household()));

-- Sign-up: join through an invite, or start a new household ---------------------------
create or replace function private.invite_hash(p_token text)
returns text language sql immutable set search_path = '' as $$
  select encode(extensions.digest(p_token, 'sha256'), 'hex')
$$;

create or replace function private.seats_taken(p_household uuid)
returns integer language sql stable set search_path = '' as $$
  select count(*)::int from public.members where household_id = p_household
$$;

-- Everything in raw_user_meta_data comes from the browser. An invite counts only
-- if its token is real, unused and in date, and a seat is free. Otherwise the
-- person simply gets a household of their own.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}');
  who text := left(coalesce(nullif(trim(meta ->> 'display_name'), ''), initcap(split_part(new.email, '@', 1)), 'You'), 60);
  lang text := case when meta ->> 'lang' in ('en', 'de', 'id') then meta ->> 'lang' else 'en' end;
  inv public.invites;
  hh uuid;
  my_role text := 'owner';
  my_share jsonb := '{"money":true,"goals":true,"cal":true,"docs":true,"debts":true,"remit":true}';
  n int := 0;
begin
  if nullif(meta ->> 'invite_token', '') is not null then
    select * into inv from public.invites
    where token_hash = private.invite_hash(meta ->> 'invite_token')
      and used_at is null and expires_at > now()
    for update;
    if inv.id is not null
       and private.seats_taken(inv.household_id) < (select seats from public.subscriptions_billing where household_id = inv.household_id) then
      hh := inv.household_id;
      my_role := inv.role;
      my_share := inv.share;
      n := private.seats_taken(hh);
    end if;
  end if;

  if hh is null then
    insert into public.households (name)
    values (left(coalesce(nullif(trim(meta ->> 'household_name'), ''), who), 80))
    returning id into hh;
    insert into public.subscriptions_billing (household_id) values (hh);
    insert into public.debt_settings (household_id) values (hh);
  end if;

  insert into public.members (id, household_id, display_name, email, role, sort, share)
  values (new.id, hh, who, new.email, my_role, n, my_share);
  insert into public.member_settings (member_id, household_id, lang) values (new.id, hh, lang);
  insert into public.security (member_id, household_id) values (new.id, hh);

  if inv.id is not null and hh = inv.household_id then
    update public.invites set used_at = now(), used_by = new.id where id = inv.id;
  end if;
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Invite functions ---------------------------------------------------------------------
-- Returns the token once; only its hash is kept.
create or replace function public.create_invite(p_name text, p_role text default 'partner', p_share jsonb default null)
returns text language plpgsql security definer set search_path = '' as $$
declare
  me public.members;
  open_invites int;
  token text;
begin
  select * into me from public.members where id = auth.uid();
  if me.id is null or me.role not in ('owner', 'partner') then raise exception 'not_allowed'; end if;
  select count(*) into open_invites from public.invites
    where household_id = me.household_id and used_at is null and expires_at > now();
  if private.seats_taken(me.household_id) + open_invites
     >= (select seats from public.subscriptions_billing where household_id = me.household_id) then
    raise exception 'no_seats';
  end if;
  token := 'rl_' || encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.invites (household_id, invited_by, name, role, share, token_hash)
  values (me.household_id, me.id, p_name, coalesce(p_role, 'partner'),
          coalesce(p_share, '{"money":true,"goals":true,"cal":true,"docs":true,"debts":true,"remit":true}'),
          private.invite_hash(token));
  return token;
end $$;

create or replace function public.revoke_invite(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.invites i
  where i.id = p_id and i.used_at is null
    and i.household_id = (select household_id from public.members where id = auth.uid() and role in ('owner', 'partner'));
end $$;

-- What the join page shows before anyone signs in. Needs the secret token.
create or replace function public.invite_preview(p_token text)
returns table (household text, inviter text, invitee text, role text, share jsonb)
language sql stable security definer set search_path = '' as $$
  select h.name, m.display_name, i.name, i.role, i.share
  from public.invites i
  join public.households h on h.id = i.household_id
  left join public.members m on m.id = i.invited_by
  where i.token_hash = private.invite_hash(p_token) and i.used_at is null and i.expires_at > now()
$$;

-- The owner decides what each person sees of the shared rows.
create or replace function public.set_member_share(p_member uuid, p_share jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.members where id = auth.uid() and role = 'owner'
                 and household_id = (select household_id from public.members where id = p_member)) then
    raise exception 'not_allowed';
  end if;
  update public.members set share = p_share where id = p_member and role <> 'owner';
end $$;

-- Supabase grants new functions to anon directly, so "from public" alone is not enough.
revoke all on function public.create_invite(text, text, jsonb), public.revoke_invite(uuid),
  public.invite_preview(text), public.set_member_share(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_invite(text, text, jsonb), public.revoke_invite(uuid),
  public.set_member_share(uuid, jsonb) to authenticated;
grant execute on function public.invite_preview(text) to anon, authenticated;

-- Chat history is kept 90 days (AI_ASSISTANT.md section 5).
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'ai-messages-prune') then
    perform cron.schedule('ai-messages-prune', '50 3 * * *', $c$delete from public.ai_messages where created_at < now() - interval '90 days'$c$);
  end if;
end $$;

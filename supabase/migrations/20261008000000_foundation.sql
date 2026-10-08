-- Phase 0: foundation. One household, max 2 members, per-member settings.
-- Convention for later tables: household_id + owner_id (= members.id = auth.uid())
-- + visibility ('family' | 'private'), guarded by my_household().

create extension if not exists pgcrypto;

-- updated_at helper -------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- households --------------------------------------------------------------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Effendy Family',
  home_city text not null default 'Eichstätt',
  currency text not null default 'EUR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- members: one row per sign-in account; id is the auth user id ------------
create table public.members (
  id uuid primary key references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  display_name text not null,
  email text,
  role text not null default 'admin' check (role in ('admin', 'member')),
  avatar_bg text,
  avatar_fg text,
  sort smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index members_household_idx on public.members (household_id);

-- member_settings ---------------------------------------------------------
create table public.member_settings (
  member_id uuid primary key references public.members (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  theme text not null default 'auto' check (theme in ('light', 'dark', 'auto')),
  palette text not null default 'mono' check (palette in ('mono', 'blue', 'lime', 'teal', 'violet')),
  default_visibility jsonb not null default
    '{"journal":"private","gym":"family","learning":"family","ygoals":"family","transactions":"family","assets":"family","debts":"family"}',
  notif jsonb not null default
    '{"bills":true,"tax":true,"shifts":true,"budget":true,"goals":true,"time":"07:00"}',
  warn_pct smallint not null default 80 check (warn_pct between 50 and 100),
  ef_months smallint not null default 6 check (ef_months in (3, 4, 6)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger households_updated_at before update on public.households
  for each row execute function public.set_updated_at();
create trigger members_updated_at before update on public.members
  for each row execute function public.set_updated_at();
create trigger member_settings_updated_at before update on public.member_settings
  for each row execute function public.set_updated_at();

-- my_household(): household of the signed-in user ------------------------
create or replace function public.my_household()
returns uuid language sql stable security definer set search_path = '' as $$
  select household_id from public.members where id = auth.uid()
$$;
revoke all on function public.my_household() from public, anon;
grant execute on function public.my_household() to authenticated;

-- New auth user -> member of the single household (max 2 members) ---------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  hh uuid;
  n int;
begin
  select id into hh from public.households order by created_at limit 1;
  if hh is null then
    insert into public.households default values returning id into hh;
  end if;

  select count(*) into n from public.members where household_id = hh;
  if n >= 2 then
    raise exception 'This household already has 2 members';
  end if;

  insert into public.members (id, household_id, display_name, email, sort)
  values (
    new.id, hh,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''),
             initcap(split_part(new.email, '@', 1))),
    new.email, n
  );
  insert into public.member_settings (member_id, household_id) values (new.id, hh);
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security ------------------------------------------------------
alter table public.households enable row level security;
alter table public.members enable row level security;
alter table public.member_settings enable row level security;

revoke all on public.households, public.members, public.member_settings from anon;

create policy "read own household" on public.households
  for select to authenticated using (id = (select public.my_household()));
create policy "update own household" on public.households
  for update to authenticated
  using (id = (select public.my_household()))
  with check (id = (select public.my_household()));

create policy "read household members" on public.members
  for select to authenticated using (household_id = (select public.my_household()));
create policy "update own member row" on public.members
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and household_id = (select public.my_household()));

create policy "read own settings" on public.member_settings
  for select to authenticated using (member_id = (select auth.uid()));
create policy "update own settings" on public.member_settings
  for update to authenticated
  using (member_id = (select auth.uid()))
  with check (member_id = (select auth.uid()) and household_id = (select public.my_household()));

-- Members may change their name/avatar, not their household, role or id.
revoke update on public.members from authenticated;
grant update (display_name, avatar_bg, avatar_fg) on public.members to authenticated;
revoke update on public.households from authenticated;
grant update (name, home_city) on public.households to authenticated;
revoke update on public.member_settings from authenticated;
grant update (theme, palette, default_visibility, notif, warn_pct, ef_months)
  on public.member_settings to authenticated;
-- Rows are created by handle_new_user only.
revoke insert, delete on public.households, public.members, public.member_settings from authenticated;

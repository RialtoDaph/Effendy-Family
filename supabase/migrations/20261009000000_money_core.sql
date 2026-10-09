-- Phase 1: money core. Categories (always family), and user-owned rows with
-- owner_id + visibility ('family' | 'private') guarded by RLS:
--   family  -> both members can read and change it
--   private -> only the owner can read or change it
-- Money is numeric(12,2) EUR. "Budget month" = calendar month, Europe/Berlin.

-- Helpers ---------------------------------------------------------------------
create or replace function private.berlin_today()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'Europe/Berlin')::date
$$;
grant execute on function private.berlin_today() to authenticated;

-- categories ------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.my_household() references public.households (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  icon text not null default 'tag',
  monthly_limit numeric(12,2) not null default 0 check (monthly_limit >= 0),
  is_fixed boolean not null default false,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index categories_household_idx on public.categories (household_id, sort);

-- recurring (before transactions, which reference it) -------------------------
create table public.recurring (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.my_household() references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  visibility text not null default 'family' check (visibility in ('family', 'private')),
  name text not null check (length(trim(name)) > 0),
  icon text not null default 'repeat',
  amount numeric(12,2) not null check (amount <> 0),
  category_id uuid references public.categories (id) on delete set null,
  paid_by uuid references public.members (id) on delete set null, -- null = Family
  day_of_month smallint not null check (day_of_month between 1 and 28),
  active boolean not null default true,
  last_posted_month text check (last_posted_month ~ '^\d{4}-\d{2}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recurring_household_idx on public.recurring (household_id);

-- transactions ----------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.my_household() references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  visibility text not null default 'family' check (visibility in ('family', 'private')),
  date date not null default private.berlin_today(),
  amount numeric(12,2) not null check (amount <> 0), -- negative = money out
  payee text not null check (length(trim(payee)) > 0),
  category_id uuid references public.categories (id) on delete set null,
  paid_by uuid references public.members (id) on delete set null, -- null = Family
  source text not null default 'manual' check (source in ('manual', 'recurring', 'import', 'receipt')),
  recurring_id uuid references public.recurring (id) on delete set null,
  posted_month text check (posted_month ~ '^\d{4}-\d{2}$'),
  import_hash text unique,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recurring_id, posted_month)
);
create index transactions_household_date_idx on public.transactions (household_id, date desc);
create index transactions_category_idx on public.transactions (category_id);

-- incomes ---------------------------------------------------------------------
create table public.incomes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.my_household() references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  visibility text not null default 'family' check (visibility in ('family', 'private')),
  name text not null check (length(trim(name)) > 0),
  member_id uuid references public.members (id) on delete set null, -- whose income; null = Family
  kind text not null default 'Salary' check (kind in ('Salary', 'Business', 'Other')),
  monthly_amount numeric(12,2) not null default 0 check (monthly_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- goals -----------------------------------------------------------------------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.my_household() references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  visibility text not null default 'family' check (visibility in ('family', 'private')),
  name text not null check (length(trim(name)) > 0),
  icon text not null default 'target',
  target numeric(12,2) not null default 0 check (target >= 0),
  current numeric(12,2) not null default 0 check (current >= 0),
  monthly numeric(12,2) not null default 0 check (monthly >= 0),
  deadline date,
  is_emergency_fund boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- alerts_state: per person, which computed alerts were dismissed / done ------
create table public.alerts_state (
  member_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  alert_key text not null,
  dismissed_at timestamptz,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (member_id, alert_key)
);

-- updated_at triggers -----------------------------------------------------------
create trigger categories_updated_at before update on public.categories for each row execute function public.set_updated_at();
create trigger recurring_updated_at before update on public.recurring for each row execute function public.set_updated_at();
create trigger transactions_updated_at before update on public.transactions for each row execute function public.set_updated_at();
create trigger incomes_updated_at before update on public.incomes for each row execute function public.set_updated_at();
create trigger goals_updated_at before update on public.goals for each row execute function public.set_updated_at();

-- A new recurring item whose day has already passed this month counts as
-- posted for this month (README → Recurring).
create or replace function private.recurring_mark_current()
returns trigger language plpgsql set search_path = '' as $$
declare
  today date := private.berlin_today();
begin
  if new.last_posted_month is null and new.day_of_month <= extract(day from today) then
    new.last_posted_month := to_char(today, 'YYYY-MM');
  end if;
  return new;
end $$;
create trigger recurring_mark_current before insert on public.recurring
  for each row execute function private.recurring_mark_current();

-- Row Level Security --------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.recurring enable row level security;
alter table public.transactions enable row level security;
alter table public.incomes enable row level security;
alter table public.goals enable row level security;
alter table public.alerts_state enable row level security;

revoke all on public.categories, public.recurring, public.transactions, public.incomes, public.goals, public.alerts_state from anon;

-- categories: shared by the household
create policy "household reads categories" on public.categories for select to authenticated
  using (household_id = (select private.my_household()));
create policy "household adds categories" on public.categories for insert to authenticated
  with check (household_id = (select private.my_household()));
create policy "household edits categories" on public.categories for update to authenticated
  using (household_id = (select private.my_household()))
  with check (household_id = (select private.my_household()));
create policy "household deletes categories" on public.categories for delete to authenticated
  using (household_id = (select private.my_household()));

-- owned tables: the same four policies each
do $$
declare t text;
begin
  foreach t in array array['recurring', 'transactions', 'incomes', 'goals'] loop
    execute format($p$
      create policy "read family or own" on public.%1$I for select to authenticated
        using (household_id = (select private.my_household())
               and (visibility = 'family' or owner_id = (select auth.uid())));
      create policy "add as self" on public.%1$I for insert to authenticated
        with check (household_id = (select private.my_household())
                    and owner_id = (select auth.uid()));
      create policy "edit family or own" on public.%1$I for update to authenticated
        using (household_id = (select private.my_household())
               and (visibility = 'family' or owner_id = (select auth.uid())))
        with check (household_id = (select private.my_household())
                    and (visibility = 'family' or owner_id = (select auth.uid())));
      create policy "delete family or own" on public.%1$I for delete to authenticated
        using (household_id = (select private.my_household())
               and (visibility = 'family' or owner_id = (select auth.uid())));
    $p$, t);
  end loop;
end $$;

-- Nobody moves a row to another household or owner after it exists: UPDATE
-- is granted column by column, without id / household_id / owner_id.
revoke update on public.recurring, public.transactions, public.incomes, public.goals, public.categories from authenticated;
grant update (name, icon, monthly_limit, is_fixed, sort) on public.categories to authenticated;
grant update (visibility, name, icon, amount, category_id, paid_by, day_of_month, active) on public.recurring to authenticated;
grant update (visibility, date, amount, payee, category_id, paid_by, note) on public.transactions to authenticated;
grant update (visibility, name, member_id, kind, monthly_amount) on public.incomes to authenticated;
grant update (visibility, name, icon, target, current, monthly, deadline) on public.goals to authenticated;

create policy "own alert state" on public.alerts_state for all to authenticated
  using (member_id = (select auth.uid()))
  with check (member_id = (select auth.uid()));

-- Recurring posting -----------------------------------------------------------------
-- Inserts one transaction per active item whose day has come this month and
-- that was not posted yet. unique (recurring_id, posted_month) makes a second
-- run in the same month a no-op. Runs hourly; does nothing before 05:00 Berlin.
create or replace function private.post_recurring(force boolean default false)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  now_berlin timestamp := now() at time zone 'Europe/Berlin';
  today date := now_berlin::date;
  ym text := to_char(today, 'YYYY-MM');
  posted integer;
begin
  if not force and extract(hour from now_berlin) < 5 then
    return 0;
  end if;

  with due as (
    select r.* from public.recurring r
    where r.active
      and r.day_of_month <= extract(day from today)
      and r.last_posted_month is distinct from ym
    for update skip locked
  ), ins as (
    insert into public.transactions
      (household_id, owner_id, visibility, date, amount, payee, category_id, paid_by,
       source, recurring_id, posted_month)
    select household_id, owner_id, visibility,
           make_date(extract(year from today)::int, extract(month from today)::int, day_of_month),
           amount, name, category_id, paid_by, 'recurring', id, ym
    from due
    on conflict (recurring_id, posted_month) do nothing
    returning recurring_id
  ), upd as (
    update public.recurring r set last_posted_month = ym
    from due where r.id = due.id
    returning r.id
  )
  select count(*) into posted from ins;
  return posted;
end $$;
revoke all on function private.post_recurring(boolean) from public, anon, authenticated;

create extension if not exists pg_cron;
select cron.schedule('post-recurring', '7 * * * *', $$select private.post_recurring()$$);

-- Starting data for the existing household ----------------------------------
insert into public.categories (household_id, name, icon, monthly_limit, is_fixed, sort)
select h.id, c.name, c.icon, c.lim, c.fixed, c.sort
from (select id from public.households order by created_at limit 1) h
cross join (values
  ('Rent & utilities',   'house',         1335, true,  1),
  ('Insurance & health', 'shield',         325, true,  2),
  ('Transport',          'train-front',    130, true,  3),
  ('Business tools',     'laptop',         220, true,  4),
  ('Streaming',          'tv',              60, true,  5),
  ('Groceries',          'shopping-cart',  620, false, 6),
  ('Online shopping',    'package',        250, false, 7),
  ('Eating out',         'utensils',       200, false, 8),
  ('Tobacco & drinks',   'cigarette',      100, false, 9),
  ('Personal & gifts',   'gift',           150, false, 10)
) as c(name, icon, lim, fixed, sort);

insert into public.goals (household_id, owner_id, visibility, name, icon, is_emergency_fund)
select m.household_id, m.id, 'family', 'Emergency fund', 'life-buoy', true
from (select id, household_id from public.members order by sort limit 1) m;

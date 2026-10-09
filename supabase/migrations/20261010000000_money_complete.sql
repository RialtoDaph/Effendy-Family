-- Phase 2: debts, subscriptions, remittances, businesses + monthly totals with
-- report files, taxes, assets. Same Private/Family rules as phase 1.

-- Owned tables ----------------------------------------------------------------
create table public.debts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.my_household() references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  visibility text not null default 'family' check (visibility in ('family', 'private')),
  name text not null check (length(trim(name)) > 0),
  icon text not null default 'credit-card',
  lender text,
  balance numeric(12,2) not null default 0 check (balance >= 0),
  original numeric(12,2) not null default 0 check (original >= 0),
  rate_pct numeric(5,2) not null default 0 check (rate_pct >= 0 and rate_pct < 100),
  monthly_payment numeric(12,2) not null default 0 check (monthly_payment >= 0),
  member_id uuid references public.members (id) on delete set null, -- whose debt; null = Family
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.my_household() references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  visibility text not null default 'family' check (visibility in ('family', 'private')),
  name text not null check (length(trim(name)) > 0),
  monthly_price numeric(12,2) not null default 0 check (monthly_price >= 0),
  for_whom uuid references public.members (id) on delete set null, -- null = Family
  status text not null default 'active' check (status in ('active', 'cancelled')),
  cancelled_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.remittances (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.my_household() references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  visibility text not null default 'family' check (visibility in ('family', 'private')),
  to_name text not null check (length(trim(to_name)) > 0),
  eur numeric(12,2) not null check (eur > 0),
  fee_eur numeric(12,2) not null default 0 check (fee_eur >= 0),
  rate_idr_per_eur numeric(12,2) not null check (rate_idr_per_eur > 0),
  idr_received numeric(16,0) not null check (idr_received >= 0),
  provider text not null default 'Wise',
  purpose text,
  date date not null default private.berlin_today(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.my_household() references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  visibility text not null default 'family' check (visibility in ('family', 'private')),
  name text not null check (length(trim(name)) > 0),
  member_id uuid references public.members (id) on delete set null, -- who runs it
  vat_mode text not null default 'none' check (vat_mode in ('none', 'monthly', 'quarterly')), -- none = Kleinunternehmer
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.my_household() references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  visibility text not null default 'family' check (visibility in ('family', 'private')),
  storage_path text not null unique,
  name text not null,
  kind text not null check (kind in ('receipt', 'statement', 'business_report', 'roster')),
  mime text,
  size bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_months (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.my_household() references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  visibility text not null default 'family' check (visibility in ('family', 'private')),
  business_id uuid not null references public.businesses (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  revenue numeric(12,2) not null default 0 check (revenue >= 0),
  costs numeric(12,2) not null default 0 check (costs >= 0),
  tax_set_aside numeric(12,2) not null default 0 check (tax_set_aside >= 0),
  file_id uuid references public.files (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, month)
);

create table public.tax_deadlines (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.my_household() references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  visibility text not null default 'family' check (visibility in ('family', 'private')),
  title text not null check (length(trim(title)) > 0),
  due_date date not null,
  amount numeric(12,2),
  kind text not null default 'other' check (kind in ('vat', 'prepayment', 'return', 'other')),
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tax_deductions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.my_household() references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  visibility text not null default 'family' check (visibility in ('family', 'private')),
  year smallint not null,
  title text not null check (length(trim(title)) > 0),
  amount numeric(12,2) not null default 0 check (amount >= 0),
  collected boolean not null default false, -- receipts / proof are in hand
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.my_household() references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  visibility text not null default 'family' check (visibility in ('family', 'private')),
  name text not null check (length(trim(name)) > 0),
  icon text not null default 'piggy-bank',
  location text, -- "where": bank, broker, place
  orig_currency text not null default 'EUR' check (orig_currency in ('EUR', 'IDR')),
  orig_value numeric(16,2) not null default 0 check (orig_value >= 0), -- in orig_currency
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Household-wide tables (no Private) -------------------------------------------
create table public.debt_settings (
  household_id uuid primary key default private.my_household() references public.households (id) on delete cascade,
  strategy text not null default 'avalanche' check (strategy in ('avalanche', 'snowball')),
  extra_per_month numeric(12,2) not null default 0 check (extra_per_month between 0 and 400),
  updated_at timestamptz not null default now()
);

create table public.fx_rates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.my_household() references public.households (id) on delete cascade,
  date date not null default private.berlin_today(),
  idr_per_eur numeric(12,2) not null check (idr_per_eur > 0),
  source text not null default 'manual',
  created_at timestamptz not null default now()
);
create index fx_rates_household_idx on public.fx_rates (household_id, created_at desc);

create table public.tax_years (
  household_id uuid not null default private.my_household() references public.households (id) on delete cascade,
  year smallint not null,
  refund_estimate numeric(12,2), -- entered by hand (Steuerberater / ELSTER)
  note text,
  updated_at timestamptz not null default now(),
  primary key (household_id, year)
);

-- updated_at --------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['debts', 'subscriptions', 'remittances', 'businesses', 'files', 'business_months',
                           'tax_deadlines', 'tax_deductions', 'assets', 'debt_settings', 'tax_years'] loop
    execute format('create trigger %1$s_updated_at before update on public.%1$I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- Row Level Security --------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['debts', 'subscriptions', 'remittances', 'businesses', 'files', 'business_months',
                           'tax_deadlines', 'tax_deductions', 'assets'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
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
    execute format('revoke update on public.%I from authenticated', t);
  end loop;

  foreach t in array array['debt_settings', 'fx_rates', 'tax_years'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format($p$
      create policy "household reads" on public.%1$I for select to authenticated
        using (household_id = (select private.my_household()));
      create policy "household adds" on public.%1$I for insert to authenticated
        with check (household_id = (select private.my_household()));
      create policy "household edits" on public.%1$I for update to authenticated
        using (household_id = (select private.my_household()))
        with check (household_id = (select private.my_household()));
      create policy "household deletes" on public.%1$I for delete to authenticated
        using (household_id = (select private.my_household()));
    $p$, t);
  end loop;
end $$;

-- UPDATE column by column: never id / household_id / owner_id.
grant update (visibility, name, icon, lender, balance, original, rate_pct, monthly_payment, member_id) on public.debts to authenticated;
grant update (visibility, name, monthly_price, for_whom, status, cancelled_on) on public.subscriptions to authenticated;
grant update (visibility, to_name, eur, fee_eur, rate_idr_per_eur, idr_received, provider, purpose, date) on public.remittances to authenticated;
grant update (visibility, name, member_id, vat_mode, sort) on public.businesses to authenticated;
grant update (visibility, name) on public.files to authenticated;
grant update (visibility, revenue, costs, tax_set_aside, file_id) on public.business_months to authenticated;
grant update (visibility, title, due_date, amount, kind, done) on public.tax_deadlines to authenticated;
grant update (visibility, year, title, amount, collected) on public.tax_deductions to authenticated;
grant update (visibility, name, icon, location, orig_currency, orig_value, note) on public.assets to authenticated;
revoke update on public.debt_settings, public.tax_years, public.fx_rates from authenticated;
grant update (strategy, extra_per_month) on public.debt_settings to authenticated;
grant update (refund_estimate, note) on public.tax_years to authenticated;

-- A month row may only point to a file of the same household.
create or replace function private.check_business_month_file()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.file_id is not null and not exists (
    select 1 from public.files f where f.id = new.file_id and f.household_id = new.household_id
  ) then
    raise exception 'file belongs to another household';
  end if;
  return new;
end $$;
create trigger business_months_file_check before insert or update on public.business_months
  for each row execute function private.check_business_month_file();

-- Storage: private bucket, path = <household_id>/<owner_id>/<file name> -----
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('files', 'files', false, 20971520, array[
  'application/pdf', 'text/csv', 'text/plain', 'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg', 'image/png', 'image/heic', 'image/webp'
])
on conflict (id) do nothing;

-- Read an object only when its files row is visible to the reader (Private/Family via RLS).
create policy "read files the reader may see" on storage.objects for select to authenticated
  using (bucket_id = 'files' and exists (
    select 1 from public.files f where f.storage_path = storage.objects.name
  ));
-- Upload only into your own folder of your own household.
create policy "upload into own folder" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'files'
    and (storage.foldername(name))[1] = (select private.my_household())::text
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );
create policy "delete own uploads" on storage.objects for delete to authenticated
  using (
    bucket_id = 'files'
    and (storage.foldername(name))[1] = (select private.my_household())::text
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- Starting data -----------------------------------------------------------------------
insert into public.debt_settings (household_id)
select id from public.households order by created_at limit 1;

insert into public.businesses (household_id, owner_id, name, member_id, vat_mode, sort)
select m.household_id, m.id, b.name, case when b.sort = 1 then m.id end, 'none', b.sort
from (select id, household_id from public.members order by sort limit 1) m
cross join (values ('Rialto Studio', 1), ('Amnah Atelier', 2)) as b(name, sort);

insert into public.tax_deadlines (household_id, owner_id, title, due_date, kind)
select m.household_id, m.id, 'Income tax return 2026 (joint)', date '2027-07-31', 'return'
from (select id, household_id from public.members order by sort limit 1) m;

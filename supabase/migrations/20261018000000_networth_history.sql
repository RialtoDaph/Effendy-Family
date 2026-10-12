-- One family net-worth point per day, saved by the app when it is opened, so
-- Home can draw the line over time. Family rows only: private assets and
-- debts never count here.
create table public.networth_history (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.my_household() references public.households (id) on delete cascade,
  day date not null,
  assets numeric(14, 2) not null default 0,
  debts numeric(14, 2) not null default 0,
  net numeric(14, 2) not null default 0,
  updated_at timestamptz not null default now(),
  unique (household_id, day)
);
alter table public.networth_history enable row level security;
revoke all on public.networth_history from anon;
create policy "read household" on public.networth_history for select to authenticated
  using (household_id = (select private.my_household()));
create policy "add household" on public.networth_history for insert to authenticated
  with check (household_id = (select private.my_household()));
create policy "edit household" on public.networth_history for update to authenticated
  using (household_id = (select private.my_household()))
  with check (household_id = (select private.my_household()));
revoke update on public.networth_history from authenticated;
-- day is included because an upsert (insert … on conflict update) sets every sent column.
grant update (day, assets, debts, net, updated_at) on public.networth_history to authenticated;

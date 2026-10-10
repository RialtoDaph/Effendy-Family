-- Phase 3D: bank CSV import.
--   import_mappings  which column is date / amount / payee … per bank (asked once)
--   merchant_rules   "this payee → this category", learned from your corrections
-- Both are shared by the household. Imported rows go into transactions with
-- source = 'import' and import_hash (unique), so the same row never comes in twice.

create table public.import_mappings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.my_household() references public.households (id) on delete cascade,
  bank text not null check (length(trim(bank)) > 0),
  mapping jsonb not null,
  updated_at timestamptz not null default now(),
  unique (household_id, bank)
);

create table public.merchant_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.my_household() references public.households (id) on delete cascade,
  pattern text not null check (length(trim(pattern)) > 0),
  category_id uuid not null references public.categories (id) on delete cascade,
  updated_at timestamptz not null default now(),
  unique (household_id, pattern)
);
create index on public.merchant_rules (category_id);

alter table public.import_mappings enable row level security;
alter table public.merchant_rules enable row level security;
revoke all on public.import_mappings, public.merchant_rules from anon;

do $$
declare t text;
begin
  foreach t in array array['import_mappings', 'merchant_rules'] loop
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

revoke update on public.import_mappings, public.merchant_rules from authenticated;
grant update (mapping, updated_at) on public.import_mappings to authenticated;
grant update (category_id, updated_at) on public.merchant_rules to authenticated;

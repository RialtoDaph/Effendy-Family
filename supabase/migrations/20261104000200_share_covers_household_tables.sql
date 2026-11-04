-- Share toggles also cover the household-wide tables: net worth history, tax
-- years and budget limits are money, even though they have no owner or visibility.
do $$
declare m record;
begin
  for m in
    select * from (values
      ('networth_history', 'read household', 'money'), ('tax_years', 'household reads', 'money'),
      ('categories', 'household reads', 'money'), ('merchant_rules', 'household reads', 'money'),
      ('import_mappings', 'household reads', 'money'), ('debt_settings', 'household reads', 'debts'),
      ('fx_rates', 'household reads', 'remit')
    ) as v(tbl, pol, area)
  loop
    execute format('drop policy if exists %I on public.%I', m.pol, m.tbl);
    execute format('create policy %I on public.%I for select to authenticated using (household_id = (select private.my_household()) and (select private.shares(%L)))', m.pol, m.tbl, m.area);
  end loop;
end $$;

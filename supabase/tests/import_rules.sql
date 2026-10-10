-- Phase 3D checks: bank import. Needs two members (A, B). Everything is rolled back.
begin;
create temp table r(check_name text, ok boolean) on commit drop;
grant all on r to authenticated, anon;

do $$
declare
  a uuid := (select id from public.members order by sort limit 1);
  b uuid := (select id from public.members order by sort offset 1 limit 1);
  n int;
begin
  -- A imports a row, then the same row again (ON CONFLICT DO NOTHING, as the app does).
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.transactions (date, amount, payee, source, import_hash, visibility)
    values ('2026-10-03', -48.17, 'REWE', 'import', 'test-hash-1', 'family');
  insert into public.transactions (date, amount, payee, source, import_hash, visibility)
    values ('2026-10-03', -48.17, 'REWE', 'import', 'test-hash-1', 'family')
    on conflict (import_hash) do nothing;
  select count(*) into n from public.transactions where import_hash = 'test-hash-1';
  insert into r values ('the same row is never imported twice', n = 1);

  insert into public.import_mappings (bank, mapping) values ('sparkasse', '{"delimiter":";"}');
  insert into public.merchant_rules (pattern, category_id)
    select 'rewe markt gmbh', id from public.categories where name = 'Groceries' limit 1;
  reset role;

  -- B shares the column choices and rules, and can update them.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.import_mappings where bank = 'sparkasse';
  insert into r values ('column choices are shared in the household', n = 1);
  select count(*) into n from public.merchant_rules where pattern = 'rewe markt gmbh';
  insert into r values ('category rules are shared in the household', n = 1);
  update public.import_mappings set mapping = '{"delimiter":","}' where bank = 'sparkasse';
  insert into r values ('the partner can correct the columns',
    (select mapping ->> 'delimiter' from public.import_mappings where bank = 'sparkasse') = ',');
  begin
    update public.import_mappings set household_id = gen_random_uuid() where bank = 'sparkasse';
    insert into r values ('household of a mapping cannot be changed', false);
  exception when insufficient_privilege then
    insert into r values ('household of a mapping cannot be changed', true);
  end;
  -- The partner importing the same file (shared account) also gets no double row.
  insert into public.transactions (date, amount, payee, source, import_hash, visibility)
    values ('2026-10-03', -48.17, 'REWE', 'import', 'test-hash-1', 'private')
    on conflict (import_hash) do nothing;
  reset role;
  select count(*) into n from public.transactions where import_hash = 'test-hash-1';
  insert into r values ('both partners importing the same file: still one row', n = 1);

  begin
    set local role anon;
    select count(*) into n from public.import_mappings;
    reset role;
    insert into r values ('signed-out visitors see no column choices', n = 0);
  exception when insufficient_privilege then
    reset role;
    insert into r values ('signed-out visitors see no column choices', true);
  end;
exception when others then
  reset role;
  insert into r values ('unexpected error: ' || sqlerrm, false);
end $$;

select * from r order by check_name;
rollback;

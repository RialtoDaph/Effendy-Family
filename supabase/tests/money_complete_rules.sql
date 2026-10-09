-- Phase 2 checks: Private/Family on debts, assets, transfers, subscriptions,
-- files and business months. Rolled back at the end; nothing is kept.
begin;
create temp table r(check_name text, ok boolean) on commit drop;
grant all on r to authenticated;
insert into auth.users (instance_id, id, aud, role, email)
values ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'partner-test@example.invalid');
do $$
declare
  a uuid := (select id from public.members order by sort limit 1);
  b uuid := 'bbbbbbbb-0000-4000-8000-00000000000b';
  hh uuid := (select household_id from public.members order by sort limit 1);
  biz uuid := (select id from public.businesses order by sort limit 1);
  n int;
  f uuid;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.debts (name, balance, monthly_payment, visibility) values ('Secret loan', 900, 50, 'private');
  insert into public.assets (name, orig_value, visibility) values ('Secret savings', 5000, 'private');
  insert into public.remittances (to_name, eur, rate_idr_per_eur, idr_received, visibility) values ('Secret', 100, 18000, 1800000, 'private');
  insert into public.subscriptions (name, monthly_price, visibility) values ('Secret sub', 9.99, 'private');
  insert into public.files (storage_path, name, kind, visibility) values (hh || '/' || b || '/secret.pdf', 'secret.pdf', 'business_report', 'private') returning id into f;
  insert into public.business_months (business_id, month, revenue, visibility, file_id) values (biz, '2026-09', 1000, 'private', f);
  insert into public.business_months (business_id, month, revenue, visibility) values (biz, '2026-08', 800, 'family');
  update public.debt_settings set extra_per_month = 100 where household_id = hh;
  get diagnostics n = row_count;
  insert into r values ('partner can change shared debt settings', n = 1);
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into r select 'private debt hidden', not exists (select 1 from public.debts where name = 'Secret loan');
  insert into r select 'private asset hidden', not exists (select 1 from public.assets where name = 'Secret savings');
  insert into r select 'private transfer hidden', not exists (select 1 from public.remittances where to_name = 'Secret');
  insert into r select 'private subscription hidden', not exists (select 1 from public.subscriptions where name = 'Secret sub');
  insert into r select 'private file row hidden', not exists (select 1 from public.files where name = 'secret.pdf');
  insert into r select 'private business month not in partner totals',
    (select coalesce(sum(revenue), 0) from public.business_months where business_id = biz) = 800;
  insert into r select 'net worth inputs exclude private',
    (select coalesce(sum(orig_value), 0) from public.assets) = 0 and (select coalesce(sum(balance), 0) from public.debts) = 0;
  update public.debts set balance = 1 where name = 'Secret loan';
  get diagnostics n = row_count;
  insert into r values ('cannot change partner private debt', n = 0);
  begin
    insert into public.business_months (business_id, month, revenue, file_id) values (biz, '2026-07', 1, f);
    insert into r values ('cannot link a month to a hidden file', false);
  exception when others then insert into r values ('cannot link a month to a hidden file', true); end;
  reset role;
end $$;
select * from r order by check_name;
rollback;

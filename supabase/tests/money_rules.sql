-- Phase 1 checks: Private/Family on money rows, totals, and recurring posting.
-- Needs at least one member. A temporary second member is created inside the
-- transaction; everything is rolled back at the end, nothing is kept.
begin;
create temp table r(check_name text, ok boolean) on commit drop;
grant all on r to authenticated;

-- Temporary partner "B" next to the first real member "A".
insert into auth.users (instance_id, id, aud, role, email)
values ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'partner-test@example.invalid');

do $$
declare
  a uuid := (select id from public.members order by sort limit 1);
  b uuid := 'bbbbbbbb-0000-4000-8000-00000000000b';
  groceries uuid := (select id from public.categories where name = 'Groceries' limit 1);
  rec uuid;
  n int;
  total numeric;
  posted int;
begin
  -- B adds one private and one family grocery purchase, plus a private recurring item.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.transactions (amount, payee, category_id, visibility) values (-50, 'Secret gift', groceries, 'private');
  insert into public.transactions (amount, payee, category_id, visibility) values (-20, 'Rewe', groceries, 'family');
  insert into public.recurring (name, amount, category_id, day_of_month, visibility)
    values ('Private gym', -30, groceries, 1, 'private') returning id into rec;
  insert into public.goals (name, target, visibility) values ('Surprise trip', 900, 'private');
  reset role;

  -- A's view.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.transactions where payee = 'Secret gift';
  insert into r values ('partner cannot see a private transaction', n = 0);
  select coalesce(sum(-amount), 0) into total from public.transactions
    where category_id = groceries and owner_id = b;
  insert into r values ('private amount is not in the partner''s totals', total = 20);
  select count(*) into n from public.goals where name = 'Surprise trip';
  insert into r values ('partner cannot see a private goal', n = 0);
  select count(*) into n from public.recurring where id = rec;
  insert into r values ('partner cannot see a private recurring item', n = 0);

  update public.transactions set amount = -1 where payee = 'Secret gift';
  get diagnostics n = row_count;
  insert into r values ('partner cannot change a private transaction', n = 0);
  delete from public.transactions where payee = 'Secret gift';
  get diagnostics n = row_count;
  insert into r values ('partner cannot delete a private transaction', n = 0);

  begin
    update public.transactions set visibility = 'private' where payee = 'Rewe';
    insert into r values ('partner cannot make someone else''s row private', false);
  exception when insufficient_privilege then
    insert into r values ('partner cannot make someone else''s row private', true);
  end;

  begin
    insert into public.transactions (amount, payee, owner_id) values (-5, 'Pretend to be B', b);
    insert into r values ('cannot add a row as someone else', false);
  exception when others then insert into r values ('cannot add a row as someone else', true); end;
  begin
    update public.transactions set owner_id = a where payee = 'Rewe';
    insert into r values ('cannot take over a row', false);
  exception when insufficient_privilege then insert into r values ('cannot take over a row', true); end;
  update public.transactions set note = 'checked' where payee = 'Rewe';
  get diagnostics n = row_count;
  insert into r values ('partner can edit a family transaction', n = 1);
  reset role;

  -- Recurring: a new item whose day already passed counts as posted this month.
  insert into r select 'new recurring with a past day counts as posted',
    (select last_posted_month from public.recurring where id = rec) = to_char(private.berlin_today(), 'YYYY-MM');

  -- Pretend it was not posted yet, then run the job twice.
  update public.recurring set last_posted_month = null where id = rec;
  posted := private.post_recurring(true);
  insert into r values ('recurring posts once', posted >= 1
    and (select count(*) from public.transactions where recurring_id = rec) = 1);
  posted := private.post_recurring(true);
  insert into r values ('second run in the same month posts nothing',
    (select count(*) from public.transactions where recurring_id = rec) = 1);
  update public.recurring set last_posted_month = null where id = rec;
  posted := private.post_recurring(true);
  insert into r values ('even with the marker cleared it never posts twice',
    (select count(*) from public.transactions where recurring_id = rec) = 1);
  insert into r values ('posted copy stays private',
    (select visibility from public.transactions where recurring_id = rec) = 'private');
end $$;

select * from r order by check_name;
rollback;

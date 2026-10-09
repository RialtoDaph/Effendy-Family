-- Phase 3B checks: what reminders go out, when, to whom, and only once.
-- Needs two members (A = first, B = second). Everything is rolled back.
begin;
create temp table r(check_name text, ok boolean) on commit drop;
create temp table sent(run text, member_id uuid, key text, title text, body text, url text) on commit drop;
grant all on r, sent to authenticated;

do $$
declare
  a uuid := (select id from public.members order by sort limit 1);
  b uuid := (select id from public.members order by sort offset 1 limit 1);
  rent uuid; secret uuid; tax uuid; cat uuid;
  n int;
begin
  insert into public.push_subscriptions (member_id, endpoint, p256dh, auth)
  values (a, 'https://push.example.invalid/a', 'k', 's'), (b, 'https://push.example.invalid/b', 'k', 's');
  update public.member_settings set notif = notif || '{"time":"08:00","bills":true,"tax":true,"budget":true,"goals":true}', warn_pct = 80 where member_id = a;
  update public.member_settings set notif = notif || '{"bills":false}' where member_id = b;

  -- Monday 12 Oct 2026: rent tomorrow (family), B's private bill tomorrow, tax due Thursday.
  insert into public.recurring (owner_id, household_id, name, amount, day_of_month, visibility)
    select a, household_id, 'Test rent', -100, 13, 'family' from public.members where id = a returning id into rent;
  insert into public.recurring (owner_id, household_id, name, amount, day_of_month, visibility)
    select b, household_id, 'B secret', -10, 13, 'private' from public.members where id = b returning id into secret;
  update public.recurring set last_posted_month = null where id in (rent, secret);
  insert into public.tax_deadlines (owner_id, household_id, title, due_date, amount)
    select a, household_id, 'Test VAT', '2026-10-15', 250 from public.members where id = a returning id into tax;
  insert into public.categories (household_id, name, monthly_limit, is_fixed)
    select household_id, 'Test flex', 100, false from public.members where id = a returning id into cat;
  insert into public.transactions (owner_id, household_id, date, amount, payee, category_id, visibility)
    select a, household_id, '2026-10-05', -85, 'Shop', cat, 'family' from public.members where id = a;
  insert into public.transactions (owner_id, household_id, date, amount, payee, category_id, visibility)
    select b, household_id, '2026-10-06', -50, 'Private shop', cat, 'private' from public.members where id = b;
  insert into public.goals (owner_id, household_id, name, target, current, visibility)
    select a, household_id, 'Test trip', 1000, 250, 'family' from public.members where id = a;

  insert into sent select '06:00', * from private.push_due('2026-10-12 06:00 Europe/Berlin');
  insert into sent select '08:05', * from private.push_due('2026-10-12 08:05 Europe/Berlin');
  insert into sent select '09:05', * from private.push_due('2026-10-12 09:05 Europe/Berlin');
  insert into sent select '09:20', * from private.push_due('2026-10-12 09:20 Europe/Berlin');
  insert into sent select 'sun', * from private.push_due('2026-10-18 19:05 Europe/Berlin');

  insert into r values ('nothing for A before the summary time',
    not exists (select 1 from sent where run = '06:00' and member_id = a));
  insert into r values ('summary at the chosen time lists rent and tax',
    exists (select 1 from sent where run = '08:05' and member_id = a and key = 'summary:2026-10-12'
            and body like '%Test rent tomorrow (€100)%' and body like '%Test VAT due 15 Oct%'));
  insert into r values ('budget warning when a category passes warn% (private spending not counted)',
    exists (select 1 from sent where run = '08:05' and member_id = a and key = 'near:' || cat || ':2026-10'
            and title = 'Test flex is at 85%'));
  insert into r values ('bill reminder the day before',
    exists (select 1 from sent where run = '09:05' and member_id = a and key = 'bill:' || rent || ':2026-10-13'
            and title = 'Test rent goes out tomorrow'));
  insert into r values ('tax reminder 3 days before',
    exists (select 1 from sent where run = '09:05' and member_id = a and key = 'tax:' || tax));
  insert into r values ('nothing is sent twice',
    not exists (select 1 from sent where run in ('09:05', '09:20') and member_id = a and key like 'summary:%')
    and not exists (select 1 from sent where run = '09:20' and member_id = a));
  insert into r values ('a private bill is never sent to the partner',
    not exists (select 1 from sent where member_id = a and (title like '%B secret%' or body like '%B secret%')));
  insert into r values ('bills switched off: no bill reminder',
    not exists (select 1 from sent where member_id = b and key like 'bill:%'));
  insert into r values ('goals on Sunday evening',
    exists (select 1 from sent where run = 'sun' and member_id = a and key = 'goals:2026-10-18' and body like '%Test trip 25%%'));

  -- Signed in as A: only A's own phones are visible; saving takes a phone over.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.push_subscriptions;
  insert into r values ('only your own phones are visible', n = 1);
  perform public.save_push_subscription('https://push.example.invalid/b', 'k2', 's2');
  begin
    perform private.push_due();
    insert into r values ('the app cannot run push_due', false);
  exception when insufficient_privilege then
    insert into r values ('the app cannot run push_due', true);
  end;
  reset role;
  insert into r values ('a phone that changes hands moves to the new person',
    (select member_id from public.push_subscriptions where endpoint = 'https://push.example.invalid/b') = a);
end $$;

select * from r order by check_name;
rollback;

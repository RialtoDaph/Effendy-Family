-- Phase 4 checks: shift reminders 2 hours before, private journal, goal
-- progress, Together events. Needs two members (A, B). Everything is rolled back.
begin;
create temp table r(check_name text, ok boolean) on commit drop;
create temp table sent(run text, member_id uuid, key text, title text, body text, url text) on commit drop;
grant all on r, sent to authenticated;

do $$
declare
  a uuid := (select id from public.members order by sort limit 1);
  b uuid := (select id from public.members order by sort offset 1 limit 1);
  shift uuid; ev uuid; goal uuid; secret_goal uuid;
  n int;
  v numeric;
begin
  insert into public.push_subscriptions (member_id, endpoint, p256dh, auth)
  values (a, 'https://push.example.invalid/a', 'k', 's'), (b, 'https://push.example.invalid/b', 'k', 's');
  update public.member_settings set notif = notif || '{"shifts":true}' where member_id = a;

  -- A works a shift on Wed 14 Oct 2026, 18:00–01:00 (Berlin).
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.events (kind, title, date, start_time, end_time, who)
    values ('shift', 'Bar shift', '2026-10-14', '18:00', '01:00', a) returning id into shift;
  -- The same shift again (reading the roster twice) is refused.
  begin
    insert into public.events (kind, title, date, start_time, end_time, who)
      values ('shift', 'Bar shift', '2026-10-14', '18:00', '01:00', a);
    insert into r values ('the same shift is never saved twice', false);
  exception when unique_violation then
    insert into r values ('the same shift is never saved twice', true);
  end;
  -- A Together date night at 19:00 with a 60-minute reminder.
  insert into public.events (title, date, start_time, remind_min)
    values ('Date night', '2026-10-16', '19:00', 60) returning id into ev;
  -- A writes a journal entry (private by default) and a family goal.
  insert into public.journal_entries (text) values ('Tired after the lecture');
  insert into public.yearly_goals (name, target, unit) values ('Gym sessions', 156, 'sessions') returning id into goal;
  insert into public.yearly_goals (name, target, unit, visibility) values ('Secret', 10, 'x', 'private') returning id into secret_goal;
  insert into public.goal_progress (goal_id, amount) values (goal, 3);
  reset role;

  insert into sent select '15:30', * from private.push_due('2026-10-14 15:30 Europe/Berlin');
  insert into sent select '16:05', * from private.push_due('2026-10-14 16:05 Europe/Berlin');
  insert into sent select '16:20', * from private.push_due('2026-10-14 16:20 Europe/Berlin');
  insert into sent select 'fri', * from private.push_due('2026-10-16 18:05 Europe/Berlin');

  insert into r values ('no shift reminder earlier than 2 hours before',
    not exists (select 1 from sent where run = '15:30' and key like 'shift:%'));
  insert into r values ('shift reminder 2 hours before, to the person working',
    exists (select 1 from sent where run = '16:05' and member_id = a and key like 'shift:' || shift || '%'
            and title = 'Shift at 18:00' and body like 'Bar shift · 18:00–01:00%'));
  insert into r values ('the shift reminder is sent once',
    not exists (select 1 from sent where run = '16:20' and key like 'shift:%'));
  insert into r values ('the partner gets no reminder for your shift',
    not exists (select 1 from sent where member_id = b and key like 'shift:%'));
  insert into r values ('a Together event reminds both of you',
    (select count(distinct member_id) from sent where run = 'fri' and key like 'event:' || ev || '%') = 2);

  -- B (the partner).
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.journal_entries where text = 'Tired after the lecture';
  insert into r values ('a journal entry is private by default: the partner cannot see it', n = 0);
  update public.journal_entries set text = 'changed' where text = 'Tired after the lecture';
  get diagnostics n = row_count;
  insert into r values ('the partner cannot change your journal', n = 0);
  begin
    insert into public.goal_progress (goal_id, amount) values (secret_goal, 1);
    insert into r values ('the partner cannot add progress to your private goal', false);
  exception when others then
    insert into r values ('the partner cannot add progress to your private goal', true);
  end;
  insert into public.goal_progress (goal_id, amount) values (goal, 2);
  reset role;
  select done into v from public.yearly_goals where id = goal;
  insert into r values ('progress from both of you adds up on a family goal', v = 5);
exception when others then
  reset role;
  insert into r values ('unexpected error: ' || sqlerrm, false);
end $$;

select * from r order by check_name;
rollback;

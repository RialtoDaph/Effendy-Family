-- Hourly wage for the Shifts bonus estimate. Personal, like the rest of member_settings.
alter table public.member_settings
  add column if not exists shift_wage numeric(6,2) check (shift_wage is null or shift_wage >= 0);
grant update (shift_wage) on public.member_settings to authenticated;

-- Sample data for the Gym and Learning cards: a membership and two months of study.
create or replace function private.sample_subscriptions()
returns void language sql security invoker set search_path = '' as $$
  insert into public.recurring (name, icon, amount, category_id, day_of_month, is_subscription, last_used_at)
  select v.name, 'tv', v.amount, (select id from public.categories where name = 'Streaming'), v.day, true, now() - make_interval(days => v.ago)
  from (values ('Netflix', -13.99, 3, 2), ('Spotify Duo', -14.99, 8, 1), ('DAZN', -34.99, 15, 60), ('Disney+', -9.99, 20, 52)) as v(name, amount, day, ago);
  insert into public.recurring (name, icon, amount, day_of_month, is_subscription, last_used_at)
  values ('FitStudio', 'dumbbell', -29.90, 1, true, now());
  insert into public.learning_minutes (date, minutes)
  select current_date - 7 * w, m
  from (values (0, 140), (1, 190), (2, 150), (3, 120), (4, 200), (5, 180), (6, 90), (7, 170)) as v(w, m);
$$;

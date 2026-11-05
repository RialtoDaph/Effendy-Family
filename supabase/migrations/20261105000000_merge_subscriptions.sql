-- Subscriptions are rows in recurring with is_subscription = true (DATA_MODEL.md).
-- The separate table and the triggers that kept the two in step are gone.
-- A free subscription (price 0) has nothing to book, so it does not carry over.
alter table public.recurring add column if not exists cancelled_on date;
grant update (cancelled_on) on public.recurring to authenticated;

update public.recurring r set is_subscription = true, cancelled_on = s.cancelled_on
from public.subscriptions s where s.recurring_id = r.id;

insert into public.recurring
  (household_id, owner_id, visibility, name, amount, category_id, paid_by, day_of_month, active, is_subscription, cancelled_on)
select household_id, owner_id, visibility, name, -monthly_price, category_id, for_whom, day_of_month,
       status = 'active', true, cancelled_on
from public.subscriptions where recurring_id is null and monthly_price > 0;

drop table public.subscriptions;
drop function if exists private.subscription_sync();
drop function if exists private.subscription_unlink();

-- 05:00 in each household's own timezone. pg_cron runs in UTC, so the job runs
-- hourly and each household waits for its own 05:00; DST needs no special case.
create or replace function private.post_recurring(force boolean default false)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  posted integer;
begin
  with due as (
    select r.*, l.loc::date as today, to_char(l.loc, 'YYYY-MM') as ym
    from public.recurring r
    join public.households h on h.id = r.household_id
    cross join lateral (select now() at time zone h.timezone as loc) l
    where r.active
      and (force or extract(hour from l.loc) >= 5)
      and r.day_of_month <= extract(day from l.loc)
      and r.last_posted_month is distinct from to_char(l.loc, 'YYYY-MM')
    for update of r skip locked
  ), ins as (
    insert into public.transactions
      (household_id, owner_id, visibility, date, amount, payee, category_id, paid_by, source, recurring_id, posted_month)
    select household_id, owner_id, visibility,
           make_date(extract(year from today)::int, extract(month from today)::int, day_of_month),
           amount, name, category_id, paid_by, 'recurring', id, ym
    from due
    on conflict (recurring_id, posted_month) do nothing
    returning recurring_id
  ), upd as (
    update public.recurring r set last_posted_month = due.ym from due where r.id = due.id returning r.id
  )
  select count(*) into posted from ins;
  return posted;
end $$;
revoke all on function private.post_recurring(boolean) from public, anon, authenticated;

select cron.unschedule('post-recurring');
select cron.schedule('post-recurring', '0 * * * *', $$select private.post_recurring()$$);

-- Sample subscriptions, as in the prototype.
create or replace function private.sample_subscriptions()
returns void language sql security invoker set search_path = '' as $$
  insert into public.recurring (name, icon, amount, category_id, day_of_month, is_subscription, last_used_at)
  select v.name, 'tv', v.amount, (select id from public.categories where name = 'Streaming'), v.day, true, now() - make_interval(days => v.ago)
  from (values ('Netflix', -13.99, 3, 2), ('Spotify Duo', -14.99, 8, 1), ('DAZN', -34.99, 15, 60), ('Disney+', -9.99, 20, 52)) as v(name, amount, day, ago)
$$;
grant execute on function private.sample_subscriptions() to authenticated;

do $$
declare src text;
begin
  select pg_get_functiondef('public.load_sample_data()'::regprocedure) into src;
  if position('sample_subscriptions' in src) = 0 then
    execute replace(src, 'insert into public.fx_rates', 'perform private.sample_subscriptions();
  insert into public.fx_rates');
  end if;
end $$;

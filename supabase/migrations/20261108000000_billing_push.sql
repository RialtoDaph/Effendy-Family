-- Phase 7: plan changes, Stripe's status, reset, and reminders on this project.

-- Billing -----------------------------------------------------------------------
-- During the free trial the owner picks the plan here. A paid plan changes only
-- through Stripe (the webhook writes with the server key).
create or replace function public.plan_choose(p_plan text, p_interval text default 'month')
returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.members;
  b public.subscriptions_billing;
  new_seats smallint;
begin
  select * into me from public.members where id = auth.uid();
  if me.id is null or me.role <> 'owner' then raise exception 'not_allowed'; end if;
  if p_plan not in ('life', 'plus', 'together') or p_interval not in ('month', 'year') then raise exception 'bad_plan'; end if;
  select * into b from public.subscriptions_billing where household_id = me.household_id for update;
  if b.id is null or b.status <> 'trial' then raise exception 'use_billing'; end if;
  new_seats := case when p_plan = 'together' then 4 else 1 end;
  if private.seats_taken(me.household_id)
     + (select count(*) from public.invites i where i.household_id = me.household_id and i.used_at is null and i.expires_at > now())
     > new_seats then
    raise exception 'seats_in_use';
  end if;
  update public.subscriptions_billing set plan = p_plan, interval = p_interval, seats = new_seats, updated_at = now() where id = b.id;
end $$;
revoke all on function public.plan_choose(text, text) from public, anon;
grant execute on function public.plan_choose(text, text) to authenticated;

-- Reset -------------------------------------------------------------------------
-- Removes what this person entered, never a partner's rows. A row another row still
-- points to goes on a later pass.
create or replace function public.reset_my_data()
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  t record;
  pass int;
begin
  if not exists (select 1 from public.members where id = me) then raise exception 'not_allowed'; end if;
  for pass in 1..3 loop
    for t in
      select c.table_name from information_schema.columns c
      join information_schema.tables x using (table_schema, table_name)
      where c.table_schema = 'public' and c.column_name = 'owner_id' and x.table_type = 'BASE TABLE'
    loop
      begin
        execute format('delete from public.%I where owner_id = $1', t.table_name) using me;
      exception when foreign_key_violation then null;
      end;
    end loop;
  end loop;
end $$;
revoke all on function public.reset_my_data() from public, anon;
grant execute on function public.reset_my_data() to authenticated;

-- Reminders ---------------------------------------------------------------------
-- Text goes out in each person's language; the briefing follows brief_at.
create or replace function private.pt(p_lang text, p_en text, p_de text, p_id text)
returns text language sql immutable set search_path = '' as $$
  select case p_lang when 'de' then p_de when 'id' then p_id else p_en end
$$;

create or replace function private.push_due(p_now timestamptz default now())
returns table (member_id uuid, key text, title text, body text, url text)
language sql security definer set search_path = '' as $$
with clock as (
  select (p_now at time zone 'Europe/Berlin') as loc
),
c as (
  select loc, loc::date as today, loc::time as hm, to_char(loc, 'YYYY-MM') as ym,
         date_trunc('month', loc)::date as m0
  from clock
),
mem as (
  select m.id, m.household_id,
         coalesce(s.notif, '{}'::jsonb) as notif,
         coalesce(s.warn_pct, 80) as warn_pct,
         coalesce(s.lang, 'en') as lang,
         coalesce(s.brief_at, '07:00') as at
  from public.members m
  left join public.member_settings s on s.member_id = m.id
  where exists (select 1 from public.push_subscriptions p where p.member_id = m.id)
),
flag as (
  select id, household_id, warn_pct, notif, lang, at,
         coalesce((notif ->> 'bills')::boolean, true) as bills,
         coalesce((notif ->> 'tax')::boolean, true) as tax,
         coalesce((notif ->> 'budget')::boolean, true) as budget,
         coalesce((notif ->> 'goals')::boolean, true) as goals,
         coalesce((notif ->> 'shifts')::boolean, true) as shifts
  from mem
),
-- Recurring payments that leave tomorrow and are not posted yet.
bills as (
  select f.id as member_id, r.id, r.name, r.amount
  from flag f, c, public.recurring r
  where r.household_id = f.household_id and (r.visibility = 'family' or r.owner_id = f.id)
    and r.active and r.amount < 0
    and r.day_of_month = extract(day from c.today + 1)
    and r.last_posted_month is distinct from to_char(c.today + 1, 'YYYY-MM')
),
taxes as (
  select f.id as member_id, t.id, t.title, t.amount, t.due_date
  from flag f, c, public.tax_deadlines t
  where t.household_id = f.household_id and (t.visibility = 'family' or t.owner_id = f.id)
    and not t.done and t.due_date between c.today and c.today + 7
),
-- Family budget, same rules as the app: family transactions this month.
spend as (
  select f.id as member_id, k.id, k.name, k.monthly_limit, k.is_fixed,
         coalesce((select sum(-x.amount) from public.transactions x, c
                   where x.category_id = k.id and x.visibility = 'family'
                     and x.date >= c.m0 and x.date < (c.m0 + interval '1 month')::date), 0) as spent
  from flag f join public.categories k on k.household_id = f.household_id
),
cats as (
  select s.*, f.warn_pct, case when s.monthly_limit > 0 then s.spent / s.monthly_limit * 100 else 0 end as pct
  from spend s join flag f on f.id = s.member_id
),
cand as (
  -- Morning summary (window of 2 hours after the chosen time, once a day).
  select f.id as member_id, 'summary:' || c.today as key,
    case when n.cnt = 0 then private.pt(f.lang, 'All calm today', 'Heute alles ruhig', 'Hari ini tenang')
         else n.cnt || private.pt(f.lang, case when n.cnt = 1 then ' thing to know today' else ' things to know today' end, ' Dinge für heute', ' hal untuk hari ini') end as title,
    concat_ws(' · ', n.items, private.eur(greatest(fl.left_, 0)) || private.pt(f.lang, ' flexible money left', ' frei verfügbar', ' uang fleksibel tersisa')) as body,
    '/' as url
  from flag f cross join c
  cross join lateral (
    select count(*)::int as cnt, string_agg(t, ' · ') filter (where rn <= 3) as items
    from (
      select row_number() over () as rn, t from (
        select b.name || private.pt(f.lang, ' tomorrow (', ' morgen (', ' besok (') || private.eur(b.amount) || ')' as t from bills b where b.member_id = f.id
        union all
        select x.title || private.pt(f.lang, ' due ', ' fällig ', ' jatuh tempo ') || to_char(x.due_date, 'DD.MM.') from taxes x where x.member_id = f.id
        union all
        select k.name || private.pt(f.lang, ' over budget', ' über Budget', ' melebihi anggaran') from cats k where k.member_id = f.id and not k.is_fixed and k.pct > 100
      ) items
    ) numbered
  ) n
  cross join lateral (
    select coalesce(sum(k.monthly_limit - k.spent), 0) as left_
    from cats k where k.member_id = f.id and not k.is_fixed
  ) fl
  where c.hm >= f.at and (c.hm < f.at + interval '2 hours' or f.at >= '22:00')

  union all
  -- Bills: the day before, from 09:00.
  select b.member_id, 'bill:' || b.id || ':' || (c.today + 1),
    b.name || private.pt(f.lang, ' goes out tomorrow', ' wird morgen abgebucht', ' keluar besok'), private.eur(b.amount) || ' · ' || to_char(c.today + 1, 'DD.MM.'), '/recur'
  from bills b join flag f on f.id = b.member_id cross join c
  where f.bills and c.hm >= '09:00' and c.hm < '21:00'

  union all
  -- Tax deadlines: 3 days before, from 09:00.
  select x.member_id, 'tax:' || x.id, private.pt(f.lang, 'Tax deadline in 3 days', 'Steuerfrist in 3 Tagen', 'Tenggat pajak 3 hari lagi'),
    x.title || coalesce(' · ' || private.eur(x.amount), '') || ' · ' || to_char(x.due_date, 'DD.MM.'), '/tax'
  from taxes x join flag f on f.id = x.member_id cross join c
  where f.tax and x.due_date = c.today + 3 and c.hm >= '09:00' and c.hm < '21:00'

  union all
  -- Budget: a flexible category crosses warn% or its limit (daytime only).
  select k.member_id,
    (case when k.pct > 100 then 'over:' else 'near:' end) || k.id || ':' || c.ym,
    case when k.pct > 100 then k.name || private.pt(f.lang, ' is over budget', ' ist über Budget', ' melebihi anggaran') else k.name || private.pt(f.lang, ' is at ', ' liegt bei ', ' sudah ') || round(k.pct) || '%' end,
    private.eur(k.spent) || private.pt(f.lang, ' of ', ' von ', ' dari ') || private.eur(k.monthly_limit) || private.pt(f.lang, ' spent this month', ' diesen Monat ausgegeben', ' terpakai bulan ini'), '/budget'
  from cats k join flag f on f.id = k.member_id cross join c
  where f.budget and not k.is_fixed and k.monthly_limit > 0 and k.pct >= k.warn_pct
    and c.hm >= '08:00' and c.hm < '21:00'

  union all
  -- Goals: Sunday from 19:00.
  select f.id, 'goals:' || c.today, private.pt(f.lang, 'Your goals this week', 'Deine Ziele diese Woche', 'Targetmu minggu ini'), g.body, '/'
  from flag f cross join c
  cross join lateral (
    select string_agg(g.name || ' ' || round(least(g.current / g.target, 1) * 100) || '%', ' · ' order by g.name) as body
    from public.goals g
    where g.household_id = f.household_id and (g.visibility = 'family' or g.owner_id = f.id)
      and not g.is_emergency_fund and g.target > 0
  ) g
  where f.goals and g.body is not null and extract(isodow from c.today) = 7
    and c.hm >= '19:00' and c.hm < '21:00'
  union all
  -- Shifts: 2 hours before the start, to the person working it.
  select e.owner_id, 'shift:' || e.id || ':' || e.date,
    private.pt(f.lang, 'Shift at ', 'Schicht um ', 'Shift pukul ') || to_char(e.start_time, 'HH24:MI'),
    e.title || ' · ' || to_char(e.start_time, 'HH24:MI') || coalesce('–' || to_char(e.end_time, 'HH24:MI'), ''), '/shifts'
  from public.events e join flag f on f.id = e.owner_id
  where e.kind = 'shift' and f.shifts and e.start_time is not null
    and p_now >= ((e.date + e.start_time) at time zone 'Europe/Berlin') - interval '2 hours'
    and p_now < ((e.date + e.start_time) at time zone 'Europe/Berlin')

  union all
  -- Calendar events with a reminder: to the person it is for, or both if Together.
  select f.id, 'event:' || e.id || ':' || e.date, e.title,
    private.pt(f.lang, 'At ', 'Um ', 'Pukul ') || to_char(e.start_time, 'HH24:MI') || ' · ' || to_char(e.date, 'DD.MM.'), '/week'
  from public.events e join flag f on f.household_id = e.household_id
  where e.kind = 'event' and e.remind_min is not null and e.start_time is not null
    and (e.visibility = 'family' or e.owner_id = f.id)
    and (e.who is null or e.who = f.id)
    and p_now >= ((e.date + e.start_time) at time zone 'Europe/Berlin') - make_interval(mins => e.remind_min)
    and p_now < ((e.date + e.start_time) at time zone 'Europe/Berlin')
),
claimed as (
  insert into private.push_log (member_id, key)
  select cand.member_id, cand.key from cand
  on conflict do nothing
  returning push_log.member_id, push_log.key
)
select cand.member_id, cand.key, cand.title, cand.body, cand.url
from cand join claimed on claimed.member_id = cand.member_id and claimed.key = cand.key
$$;
revoke execute on function private.push_due(timestamptz) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'push-reminders') then
    perform cron.unschedule('push-reminders');
  end if;
end $$;

select cron.schedule(
  'push-reminders',
  '*/15 * * * *',
  $$select net.http_post(
      url := 'https://jfvgfbmilavkkdjohmcl.supabase.co/functions/v1/push',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{"action": "run"}'::jsonb,
      timeout_milliseconds := 30000
    )$$
);

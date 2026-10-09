-- Phase 3B: Web Push reminders.
--   push_subscriptions  one row per phone/browser, only its owner can see it
--   private.push_keys   the VAPID key pair (made once by the push function)
--   private.push_log    what was sent, so nothing is sent twice
--   private.push_due()  everything that should be sent now
-- pg_cron calls the `push` Edge Function every 15 minutes.

create extension if not exists pg_net with schema extensions;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%'),
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index on public.push_subscriptions (member_id);
alter table public.push_subscriptions enable row level security;

create policy "own subscriptions: read" on public.push_subscriptions
  for select to authenticated using (member_id = (select auth.uid()));
create policy "own subscriptions: remove" on public.push_subscriptions
  for delete to authenticated using (member_id = (select auth.uid()));
revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;

-- Saving goes through this function so a phone that changes hands (sign out,
-- the other person signs in) moves to the new person instead of failing.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_agent text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.push_subscriptions (member_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_agent, 200))
  on conflict (endpoint) do update
    set member_id = excluded.member_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, created_at = now();
end $$;
revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

create table private.push_keys (
  id smallint primary key default 1 check (id = 1),
  public_key text not null,
  private_jwk jsonb not null,
  created_at timestamptz not null default now()
);

create table private.push_log (
  member_id uuid not null references public.members (id) on delete cascade,
  key text not null,
  sent_at timestamptz not null default now(),
  primary key (member_id, key)
);

create or replace function private.eur(v numeric)
returns text language sql immutable set search_path = '' as $$
  select '€' || case when abs(v) = trunc(abs(v)) then to_char(abs(v), 'FM999G999G990') else to_char(abs(v), 'FM999G999G990D00') end
$$;

-- What should go out now. Claims each item in push_log in the same statement,
-- so two runs at once cannot send the same reminder twice.
-- Times are Europe/Berlin. README → Reminders:
--   morning summary at the chosen time · bills 1 day before · tax 3 days before
--   budget when a flexible category crosses warn% (and 100%) · goals Sunday 19:00
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
         coalesce(s.warn_pct, 80) as warn_pct
  from public.members m
  left join public.member_settings s on s.member_id = m.id
  where exists (select 1 from public.push_subscriptions p where p.member_id = m.id)
),
flag as (
  select id, household_id, warn_pct, notif,
         coalesce((notif ->> 'bills')::boolean, true) as bills,
         coalesce((notif ->> 'tax')::boolean, true) as tax,
         coalesce((notif ->> 'budget')::boolean, true) as budget,
         coalesce((notif ->> 'goals')::boolean, true) as goals,
         coalesce(nullif(notif ->> 'time', ''), '07:00')::time as at
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
    case when n.cnt = 0 then 'All calm today'
         else n.cnt || case when n.cnt = 1 then ' thing' else ' things' end || ' to know today' end as title,
    concat_ws(' · ', n.items, private.eur(greatest(fl.left_, 0)) || ' flexible money left') as body,
    '/' as url
  from flag f cross join c
  cross join lateral (
    select count(*)::int as cnt, string_agg(t, ' · ') filter (where rn <= 3) as items
    from (
      select row_number() over () as rn, t from (
        select b.name || ' tomorrow (' || private.eur(b.amount) || ')' as t from bills b where b.member_id = f.id
        union all
        select x.title || ' due ' || to_char(x.due_date, 'DD Mon') from taxes x where x.member_id = f.id
        union all
        select k.name || ' over budget' from cats k where k.member_id = f.id and not k.is_fixed and k.pct > 100
      ) items
    ) numbered
  ) n
  cross join lateral (
    select coalesce(sum(k.monthly_limit - k.spent), 0) as left_
    from cats k where k.member_id = f.id and not k.is_fixed
  ) fl
  where c.hm >= f.at and c.hm < f.at + interval '2 hours'

  union all
  -- Bills: the day before, from 09:00.
  select b.member_id, 'bill:' || b.id || ':' || (c.today + 1),
    b.name || ' goes out tomorrow', private.eur(b.amount) || ' · ' || to_char(c.today + 1, 'Dy DD Mon'), '/recur'
  from bills b join flag f on f.id = b.member_id cross join c
  where f.bills and c.hm >= '09:00' and c.hm < '21:00'

  union all
  -- Tax deadlines: 3 days before, from 09:00.
  select x.member_id, 'tax:' || x.id, 'Tax deadline in 3 days',
    x.title || coalesce(' · ' || private.eur(x.amount), '') || ' · ' || to_char(x.due_date, 'Dy DD Mon'), '/tax'
  from taxes x join flag f on f.id = x.member_id cross join c
  where f.tax and x.due_date = c.today + 3 and c.hm >= '09:00' and c.hm < '21:00'

  union all
  -- Budget: a flexible category crosses warn% or its limit (daytime only).
  select k.member_id,
    (case when k.pct > 100 then 'over:' else 'near:' end) || k.id || ':' || c.ym,
    case when k.pct > 100 then k.name || ' is over budget' else k.name || ' is at ' || round(k.pct) || '%' end,
    private.eur(k.spent) || ' of ' || private.eur(k.monthly_limit) || ' spent this month', '/budget'
  from cats k join flag f on f.id = k.member_id cross join c
  where f.budget and not k.is_fixed and k.monthly_limit > 0 and k.pct >= k.warn_pct
    and c.hm >= '08:00' and c.hm < '21:00'

  union all
  -- Goals: Sunday from 19:00.
  select f.id, 'goals:' || c.today, 'Your goals this week', g.body, '/'
  from flag f cross join c
  cross join lateral (
    select string_agg(g.name || ' ' || round(least(g.current / g.target, 1) * 100) || '%', ' · ' order by g.name) as body
    from public.goals g
    where g.household_id = f.household_id and (g.visibility = 'family' or g.owner_id = f.id)
      and not g.is_emergency_fund and g.target > 0
  ) g
  where f.goals and g.body is not null and extract(isodow from c.today) = 7
    and c.hm >= '19:00' and c.hm < '21:00'
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

-- Every 15 minutes: ask the push function to send what is due.
select cron.schedule(
  'push-reminders',
  '*/15 * * * *',
  $$select net.http_post(
      url := 'https://fmdbgxtdkzzmdnlekhth.supabase.co/functions/v1/push',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{"action": "run"}'::jsonb,
      timeout_milliseconds := 30000
    )$$
);

-- Keep the log small.
select cron.schedule('push-log-prune', '30 3 * * *', $$delete from private.push_log where sent_at < now() - interval '120 days'$$);

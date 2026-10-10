-- Phase 4: time & life. Week board and calendar (events), bar shifts, week
-- priorities, yearly goals with weekly progress, learning, gym, journal
-- (private by default), date nights and ideas. Same Private/Family rules as
-- the money tables. Reminders: shifts 2 hours before, events when asked.

create table public.events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.my_household() references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  visibility text not null default 'family' check (visibility in ('family', 'private')),
  kind text not null default 'event' check (kind in ('event', 'shift')),
  title text not null check (length(trim(title)) > 0),
  date date not null,
  start_time time,
  end_time time, -- earlier than start = ends after midnight
  who uuid references public.members (id) on delete set null, -- null = Together
  remind_min smallint check (remind_min between 0 and 1440),
  source text not null default 'manual' check (source in ('manual', 'roster')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_household_date_idx on public.events (household_id, date);
-- The same shift is never saved twice (reading a roster again is safe).
create unique index events_shift_once on public.events (owner_id, date, start_time) where kind = 'shift';

create table public.week_priorities (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.my_household() references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  visibility text not null default 'family' check (visibility in ('family', 'private')),
  week_start date not null check (extract(isodow from week_start) = 1), -- Monday
  title text not null check (length(trim(title)) > 0),
  who uuid references public.members (id) on delete set null,
  done boolean not null default false,
  sort smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.week_priorities (household_id, week_start);

create table public.yearly_goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.my_household() references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  visibility text not null default 'family' check (visibility in ('family', 'private')),
  year smallint not null default extract(year from private.berlin_today())::smallint,
  name text not null check (length(trim(name)) > 0),
  icon text not null default 'target',
  target numeric(12,2) not null check (target > 0),
  unit text not null default '',
  done numeric(12,2) not null default 0 check (done >= 0),
  step text, -- this week's step
  who uuid references public.members (id) on delete set null, -- null = Together
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.goal_progress (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.my_household() references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  visibility text not null default 'family' check (visibility in ('family', 'private')),
  goal_id uuid not null references public.yearly_goals (id) on delete cascade,
  date date not null default private.berlin_today(),
  amount numeric(12,2) not null check (amount <> 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.goal_progress (goal_id, date);

create table public.learning_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.my_household() references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  visibility text not null default 'family' check (visibility in ('family', 'private')),
  track text not null default 'General',
  title text not null check (length(trim(title)) > 0),
  type text not null default 'course' check (type in ('book', 'course', 'other')),
  who uuid references public.members (id) on delete set null, -- null = Together
  pct smallint not null default 0 check (pct between 0 and 100),
  next text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.learning_minutes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.my_household() references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  visibility text not null default 'family' check (visibility in ('family', 'private')),
  date date not null default private.berlin_today(),
  minutes smallint not null check (minutes between 1 and 1440),
  item_id uuid references public.learning_items (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.learning_minutes (household_id, date);

create table public.gym_sessions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.my_household() references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  visibility text not null default 'family' check (visibility in ('family', 'private')),
  type text not null default 'Strength',
  icon text not null default 'dumbbell',
  date date not null default private.berlin_today(),
  time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.gym_sessions (household_id, date);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.my_household() references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  visibility text not null default 'private' check (visibility in ('family', 'private')), -- README: private by default
  date date not null default private.berlin_today(),
  text text not null check (length(trim(text)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.journal_entries (household_id, date desc);

create table public.date_ideas (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.my_household() references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  visibility text not null default 'family' check (visibility in ('family', 'private')),
  name text not null check (length(trim(name)) > 0),
  short text,
  icon text not null default 'heart',
  cost numeric(12,2) check (cost >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.date_nights (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.my_household() references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  visibility text not null default 'family' check (visibility in ('family', 'private')),
  name text not null check (length(trim(name)) > 0),
  icon text not null default 'heart',
  date date not null,
  cost numeric(12,2) check (cost >= 0),
  rating smallint check (rating between 1 and 5),
  note text,
  idea_id uuid references public.date_ideas (id) on delete set null,
  event_id uuid references public.events (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.date_nights (household_id, date desc);

-- Weekly targets per person.
alter table public.member_settings
  add column learn_week_min smallint not null default 180 check (learn_week_min between 0 and 5000),
  add column gym_week_goal smallint not null default 3 check (gym_week_goal between 0 and 14);
grant update (learn_week_min, gym_week_goal) on public.member_settings to authenticated;

-- Row Level Security: the same four policies as the money tables.
do $$
declare t text;
begin
  foreach t in array array['events', 'week_priorities', 'yearly_goals', 'goal_progress', 'learning_items',
                           'learning_minutes', 'gym_sessions', 'journal_entries', 'date_ideas', 'date_nights'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format($p$
      create policy "read family or own" on public.%1$I for select to authenticated
        using (household_id = (select private.my_household())
               and (visibility = 'family' or owner_id = (select auth.uid())));
      create policy "add as self" on public.%1$I for insert to authenticated
        with check (household_id = (select private.my_household())
                    and owner_id = (select auth.uid()));
      create policy "edit family or own" on public.%1$I for update to authenticated
        using (household_id = (select private.my_household())
               and (visibility = 'family' or owner_id = (select auth.uid())))
        with check (household_id = (select private.my_household())
                    and (visibility = 'family' or owner_id = (select auth.uid())));
      create policy "delete family or own" on public.%1$I for delete to authenticated
        using (household_id = (select private.my_household())
               and (visibility = 'family' or owner_id = (select auth.uid())));
    $p$, t);
    execute format('revoke update on public.%I from authenticated', t);
  end loop;
end $$;

grant update (visibility, kind, title, date, start_time, end_time, who, remind_min, note, updated_at) on public.events to authenticated;
grant update (visibility, title, who, done, sort, updated_at) on public.week_priorities to authenticated;
grant update (visibility, year, name, icon, target, unit, done, step, who, updated_at) on public.yearly_goals to authenticated;
grant update (date, amount, updated_at) on public.goal_progress to authenticated;
grant update (visibility, track, title, type, who, pct, next, updated_at) on public.learning_items to authenticated;
grant update (visibility, date, minutes, item_id, updated_at) on public.learning_minutes to authenticated;
grant update (visibility, type, icon, date, time, updated_at) on public.gym_sessions to authenticated;
grant update (visibility, date, text, updated_at) on public.journal_entries to authenticated;
grant update (visibility, name, short, icon, cost, updated_at) on public.date_ideas to authenticated;
grant update (visibility, name, icon, date, cost, rating, note, idea_id, event_id, updated_at) on public.date_nights to authenticated;

-- Progress follows its goal: same visibility, and the goal's total moves with it.
create or replace function private.goal_progress_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
declare g public.yearly_goals;
begin
  if tg_op = 'INSERT' then
    select * into g from public.yearly_goals where id = new.goal_id;
    if g.id is null or g.household_id <> new.household_id
       or (g.visibility = 'private' and g.owner_id <> new.owner_id) then
      raise exception 'goal not found';
    end if;
    new.visibility := g.visibility;
    return new;
  end if;
  return null;
end $$;
create trigger goal_progress_visibility before insert on public.goal_progress
  for each row execute function private.goal_progress_sync();

create or replace function private.goal_progress_total()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    update public.yearly_goals set done = greatest(0, done + new.amount), updated_at = now() where id = new.goal_id;
  end if;
  if tg_op in ('DELETE', 'UPDATE') then
    update public.yearly_goals set done = greatest(0, done - old.amount), updated_at = now() where id = old.goal_id;
  end if;
  return null;
end $$;
create trigger goal_progress_total after insert or update or delete on public.goal_progress
  for each row execute function private.goal_progress_total();

-- Reminders: add shifts (2 hours before) and calendar events with a reminder.
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
         coalesce((notif ->> 'shifts')::boolean, true) as shifts,
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
  union all
  -- Shifts: 2 hours before the start, to the person working it.
  select e.owner_id, 'shift:' || e.id || ':' || e.date,
    'Shift at ' || to_char(e.start_time, 'HH24:MI'),
    e.title || ' · ' || to_char(e.start_time, 'HH24:MI') || coalesce('–' || to_char(e.end_time, 'HH24:MI'), ''), '/shifts'
  from public.events e join flag f on f.id = e.owner_id
  where e.kind = 'shift' and f.shifts and e.start_time is not null
    and p_now >= ((e.date + e.start_time) at time zone 'Europe/Berlin') - interval '2 hours'
    and p_now < ((e.date + e.start_time) at time zone 'Europe/Berlin')

  union all
  -- Calendar events with a reminder: to the person it is for, or both if Together.
  select f.id, 'event:' || e.id || ':' || e.date, e.title,
    'At ' || to_char(e.start_time, 'HH24:MI') || ' · ' || to_char(e.date, 'Dy DD Mon'), '/week'
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

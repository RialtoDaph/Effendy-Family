-- Subscriptions are charged every month like Recurring (bug report
-- "recurring sama subscribe"). Each subscription now owns one linked
-- recurring payment: same name, price, day and category. post_recurring()
-- then books it on its day; "Stopped" pauses it, deleting removes it
-- (past transactions stay). The Recurring screen opens the subscription
-- form for these rows, so the two never drift apart.

alter table public.subscriptions
  add column day_of_month smallint not null default least(28, extract(day from (now() at time zone 'Europe/Berlin'))::int)
    check (day_of_month between 1 and 28),
  add column category_id uuid references public.categories (id) on delete set null,
  add column recurring_id uuid unique references public.recurring (id) on delete set null;
grant update (day_of_month, category_id) on public.subscriptions to authenticated;

create or replace function private.subscription_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_icon text := coalesce((select c.icon from public.categories c where c.id = new.category_id), 'repeat');
begin
  if new.recurring_id is not null and exists (select 1 from public.recurring r where r.id = new.recurring_id) then
    if new.monthly_price > 0 then
      update public.recurring r
      set name = new.name, icon = v_icon, amount = -new.monthly_price, category_id = new.category_id,
          paid_by = new.for_whom, day_of_month = new.day_of_month, visibility = new.visibility,
          active = new.status = 'active'
      where r.id = new.recurring_id;
    else
      update public.recurring r set active = false where r.id = new.recurring_id; -- free for now: nothing to book
    end if;
  elsif new.monthly_price > 0 then
    insert into public.recurring (household_id, owner_id, visibility, name, icon, amount, category_id, paid_by, day_of_month, active)
    values (new.household_id, new.owner_id, new.visibility, new.name, v_icon, -new.monthly_price, new.category_id,
            new.for_whom, new.day_of_month, new.status = 'active')
    returning id into new.recurring_id;
  end if;
  return new;
end $$;

create trigger subscription_sync before insert or update on public.subscriptions
  for each row execute function private.subscription_sync();

create or replace function private.subscription_unlink()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.recurring where id = old.recurring_id;
  return old;
end $$;

create trigger subscription_unlink after delete on public.subscriptions
  for each row execute function private.subscription_unlink();

-- Existing subscriptions: billing day = the day they were added (editable),
-- then create their recurring payment. A day that has already passed this
-- month counts as booked (recurring_mark_current), so nothing is charged twice.
update public.subscriptions set day_of_month = least(28, extract(day from created_at at time zone 'Europe/Berlin')::int);
